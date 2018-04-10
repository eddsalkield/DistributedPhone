import Deque from "double-ended-queue";

import * as err from "../err";
import * as stat from "../stat";

import * as api from "./api";
import {Ref, Storage} from "./storage";

interface BlobState {
    ref: Ref;
    available: boolean;
    refcnt: number;

    /* Group position in download queue, -1 if not downloading, or -2 if the
     * the blob will become available by other means. */
    dlqp: number;

    /* Functions to call when the blob becomes available. null if the blob will
     * not become available (so it must be downloaded), or if it is already
     * available. */
    on_available: Array<(_: Error | null) => void> | null;
}

/* BlobRepo implements the bookkeeping related to downloading and storing
 * blobs. It will also be responsible for rate-limiting downloading. */
export class BlobRepo {
    private readonly blobs = new Map<string, BlobState>();

    private readonly dlq = new Deque<BlobState>();
    private dlq_counter: number = 0;
    private dl_cur: number = 0;
    private dl_max: number = 3;

    private local_counter: number = 0;

    private stopping?: () => void;

    constructor(
        private readonly st: stat.Sink,
        private readonly provider: api.WorkProvider,
        private readonly storage: Storage
    ) {}

    /* Delete all unknown blobs, and possibly some unneeded remote blobs. */
    public static create(st: stat.Sink, provider: api.WorkProvider, storage: Storage): Promise<BlobRepo> {
        return storage.list().then((refs) => {
            const repo = new BlobRepo(st, provider, storage);
            for(const ref of refs) {
                if(ref.id.startsWith("local/")) {
                    const num = Number(ref.id.slice(6));
                    if(num === Math.floor(num) && num >= repo.local_counter) {
                        repo.local_counter = num + 1;
                    }
                } else if(ref.id.startsWith("remote/")) {
                    // pass
                } else if(ref.id.startsWith("state/")) {
                    // pass
                }
                repo.createBlobState(ref, true);
            }
            return repo;
        });
    }

    private checkRef(blob: BlobState, ref: Ref): boolean {
        if(blob.ref.size !== ref.size) {
            const e = new err.State("Blob size mismatch", {
                blob_id: ref.id,
                got_size: blob.ref.size,
                want_size: ref.size,
            });
            if(blob.available) {
                throw e;
            } else {
                this.st.reportError(e.attr);
                return false;
            }
        }
        return true;
    }

    private checkWant(blob: BlobState, ref: Ref): boolean {
        const r = this.checkRef(blob, ref);
        if(!blob.available && !blob.ref.id.startsWith("remote/")) {
            throw new err.State("Blob not reachable", {
                blob_id: ref.id,
            });
        }
        return r;
    }

    private checkAvailable(blob: BlobState, ref: Ref): void {
        const r = this.checkWant(blob, ref);
        if(!blob.available) {
            throw new err.State("Blob not available", {
                blob_id: ref.id,
            });
        }
        console.assert(r);
        return;
    }

    public stop(): Promise<void> {
        if(this.stopping) {
            throw new err.State("Already stopping");
        }
        return new Promise((resolve, reject) => {
            this.stopping = resolve;
            this.dl_cur += 1;
            this.dlDone();
        });
    }

    /* Make the blobs available, call f() with them available. The blobs will
     * be available until the promise returned by f() is resolved, and that will
     * be the final result. */
    public withBlobs<T>(refs: Ref[], f: () => Promise<T>): Promise<T> {
        const blobs: BlobState[] = [];
        const unavail: Array<[BlobState, number]> = [];
        try {
            for(const ref of refs) {
                const blob = this.getBlobState(ref);
                blobs.push(blob);
                this.checkWant(blob, ref);
                if(!blob.available) {
                    unavail.push([blob, ref.size]);
                }
            }
        } catch(e) {
            return Promise.reject(e);
        }

        // TODO: If there isn't enough space for the blobs in `unavail`, add the
        // request to some sort of queue instead.

        for(const blob of blobs) {
            blob.refcnt += 1;
        }

        return new Promise<T>((resolve, reject) => {
            let pending = 1 + unavail.length;
            const cb = (e: Error | null) => {
                if(pending === -1) return;
                if(e) {
                    pending = -1;
                    reject(e);
                    return;
                }

                pending -= 1;
                if(pending !== 0) return;
                let res: Promise<T>;
                try {
                    res = f();
                } catch(e) {
                    reject(e);
                    return;
                }
                resolve(res);
            };

            const will_download: BlobState[] = [];
            for(const [blob,want_size] of unavail) {
                const cb_this = (e: Error | null) => {
                    console.assert(e !== null || blob.available);
                    if(!e && blob.ref.size !== want_size) {
                        e = new err.State("Blob size mismatch", {
                            blob_id: blob.ref.id,
                            got_size: blob.ref.size,
                            want_size: want_size,
                        });
                    }
                    cb(e);
                };

                if(!blob.on_available) {
                    will_download.push(blob);
                    blob.on_available = [cb_this];
                } else {
                    blob.on_available.push(cb_this);
                }
            }

            cb(null);

            this.download(will_download);
        }).finally(() => {
            for(const blob of blobs) {
                console.assert(blob.refcnt > 0);
                blob.refcnt -= 1;
            }
        });
    }

    /* Read a blob that is known to be available. */
    public read(ref: Ref): Promise<ArrayBuffer> {
        const blob = this.blobs.get(ref.id);
        if(!blob) {
            return Promise.reject(new err.State("Unknown blob", {
                blob_id: ref.id,
            }));
        }
        try {
            this.checkAvailable(blob, ref);
        } catch(e) {
            return Promise.reject(e);
        }
        console.assert(blob.refcnt > 0);
        return this.storage.get(blob.ref.id).then((data) => {
            if(data.byteLength !== ref.size) {
                throw new err.State("Blob size conflict", {
                    blob_id: ref.id,
                    got_size: data.byteLength,
                    want_size: ref.size,
                });
            }
            return data;
        });
    }

    /* Do some deduplication on `Ref`s, and log inconsistencies. Calling this
     * function is not strictly necessary, but can help with spotting some
     * issues. */
    public resolve(ref: Ref): Ref {
        const blob = this.getBlobState(ref);
        if(this.checkWant(blob, ref)) return blob.ref;
        else return ref;
    }

    /* Load a blob from the API. */
    public fromAPI(id: string, info: api.BlobInfo): Ref {
        return this.resolve({
            id: "remote/" + id,
            size: info.size,
        });
    }

    /* Create a new local blob with the given data, and pin() it. */
    public create(data: ArrayBuffer): [Ref, Promise<void>] {
        const i = this.local_counter;
        this.local_counter = i+1;
        console.assert(
            i === Math.floor(i) &&
            this.local_counter === Math.floor(this.local_counter) &&
            this.local_counter !== i
        );

        const blob = this.createBlobState({
            id: `local/${i}`,
            size: data.byteLength,
        }, true);

        blob.refcnt += 1;

        return [blob.ref, this.storage.set(blob.ref.id, new Uint8Array(data)).then(() => {
            blob.available = true;
            return;
        })];
    }

    /* Mark the given blob as needed. */
    public pin(ref: Ref): Ref {
        const blob = this.getBlobState(ref);
        this.checkAvailable(blob, ref);
        blob.refcnt += 1;
        return blob.ref;
    }

    /* Mark the given blob as no longer needed. */
    public unpin(ref: Ref): void {
        const blob = this.getBlobState(ref);
        console.assert(blob.refcnt > 0);
        blob.refcnt -= 1;
    }

    public readState(name: string): Promise<ArrayBuffer | null> {
        const blob = this.blobs.get("state/" + name);
        if(!blob) return Promise.resolve(null);
        if(!blob.available) {
            throw new err.State("State not available");
        }
        blob.refcnt += 1;
        return this.read(blob.ref).finally(() => {
            blob.refcnt -= 1;
        });
    }

    public writeState(name: string, data: Uint8Array): Promise<void> {
        const ref = {
            id: "state/" + name,
            size: data.length,
        };
        const blob = this.getBlobState(ref);
        if(blob.refcnt !== 0) {
            throw new err.State("State is being read");
        }
        blob.ref = ref;
        blob.available = false;
        return this.storage.set(ref.id, data).then(() => {
            blob.available = true;
        });
    }

    private createBlobState(ref: Ref, available: boolean): BlobState {
        const blob: BlobState = {
            ref: ref,
            available: available,
            refcnt: 0,
            dlqp: -1,
            on_available: null,
        };
        console.assert(this.blobs.get(ref.id) === undefined);
        this.blobs.set(ref.id, blob);
        return blob;
    }

    /* Get (or create) a BlobState from a given Ref. */
    private getBlobState(ref: Ref): BlobState {
        const blob = this.blobs.get(ref.id);
        if(blob) return blob;

        if(!ref.id.startsWith("remote/") && !ref.id.startsWith("state/")) {
            throw new err.State("Can't get blob", {blob_id: ref.id});
        }

        return this.createBlobState(ref, false);
    }

    /* Enqueue blobs for downloading */
    private download(blobs: BlobState[]): void {
        if(blobs.length === 0) return;
        if(this.stopping) return;
        const dlqp = this.dlq_counter;
        this.dlq_counter = dlqp + 1;
        for(const blob of blobs) {
            console.assert(!!blob.on_available && blob.dlqp === -1);
            blob.dlqp = dlqp;
            this.dlq.enqueue(blob);
        }
        this.dlPull();
    }

    private dlDone(): void {
        this.dl_cur -= 1;
        if(this.stopping) {
            if(this.dl_cur === 0) {
                this.stopping();
            }
            return;
        }
        this.dlPull();
    }

    private dlPull(): void {
        while(this.dl_cur < this.dl_max) {
            const bl = this.dlq.dequeue();
            if(!bl) break;
            // TODO: check data limit
            this.dlOne(bl);
        }
    }

    private dlOne(blob: BlobState): void {
        const id = blob.ref.id;

        const fin = (e: Error | null) => {
            if(this.dl_cur === 0 && this.dlq.isEmpty()) {
                this.dlq_counter = 0;
            }

            const cbs = blob.on_available!;
            blob.on_available = null;
            blob.dlqp = -1;

            if(e && this.blobs.get(id) === blob) {
                this.blobs.delete(id);
            }

            const p = Promise.resolve(e);
            for(const f of cbs) {
                p.then(f);
            }
        };

        this.dl_cur += 1;

        try {
            console.assert(id.startsWith("remote/"));
            this.provider.getBlob(id.slice(7)).then((data) => {
                const size = data.byteLength;
                if(size !== blob.ref.size) {
                    this.st.reportError({
                        kind: "state",
                        message: "Blob size changed",
                        blob_id: blob.ref.id,
                        got_size: size,
                        want_size: blob.ref.size,
                    });
                    blob.ref = {
                        id: blob.ref.id,
                        size: size,
                    };
                }
                this.storage.set(id, new Uint8Array(data)).then(() => {
                    blob.available = true;
                    fin(null);
                }, (e) => {
                    // Blob storage errors are fatal.
                    fin(e);
                });
            }, (e) => {
                if(e instanceof err.Network) {
                    this.dlRequeue(blob);
                    return;
                }
                fin(e);
            }).finally(() => this.dlDone());
        } catch(e) {
            fin(e);
        }
    }

    private dlRequeue(blob: BlobState): void {
        const deq: BlobState[] = [];
        while((this.dlq.peekFront() || {dlqp: Infinity}).dlqp < blob.dlqp!) {
            deq.push(this.dlq.dequeue()!);
        }
        this.dlq.insertFront(blob);
        while(true) {
            const b = deq.pop();
            if(!b) break;
            this.dlq.insertFront(b);
        }
    }
}
