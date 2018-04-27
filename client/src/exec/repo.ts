import * as err from "@/err";
import * as stat from "@/stat";

import * as api from "./api";
import {Ref, Storage} from "./storage";

function isRemote(ref: Ref): boolean {
    return ref.id.startsWith("remote/");
}

function isLocal(ref: Ref): boolean {
    return ref.id.startsWith("local/");
}

function isState(ref: Ref): boolean {
    return ref.id.startsWith("state/");
}

const enum BlobPresence {
    MISSING = 0,
    WAITING = 1,
    AVAILABLE = 2,
}

interface BlobState {
    ref: Ref;
    present: BlobPresence;
    refcnt: number;

    /* Requests waiting for blob. */
    trackers: Set<BlobTracker>;
}

interface BlobTracker {
    readonly onAvailable: (blob: BlobState) => void;
    readonly onError: (blob: BlobState, e: Error) => void;
    readonly onEviction: (blob: BlobState) => void;
}

interface DownloadRequest {
    readonly blobs: BlobState[];
    readonly onStart: (blob: BlobState) => void;
}

/* BlobRepo implements the bookkeeping related to downloading and storing
 * blobs. It will also be responsible for rate-limiting downloading. */
export class BlobRepo {
    private readonly blobs = new Map<string, BlobState>();

    /* Queue of download requests. */
    private readonly dl_reqs = new Set<DownloadRequest>();
    /* Number of blobs currently being downloaded. */
    private dl_cur: number = 0;
    /* Invariant: 0 <= dl_cur <= dl_max */
    private dl_max: number = 3;

    /* Counter for labelling local blobs. */
    private local_counter: number = 0;

    /* Total size of remote blobs in storage. */
    public cache_used: number = 0;
    /* Should be equal to the total expected size of the blobs being downloaded. */
    public cache_expect: number = 0;

    constructor(
        private readonly st: stat.Sink,
        private readonly provider: api.BlobProvider,
        public readonly storage: Storage
    ) {}

    /* Delete all unknown blobs, and possibly some unneeded remote blobs. */
    public static create(st: stat.Sink, provider: api.BlobProvider, storage: Storage): Promise<BlobRepo> {
        return storage.list().then((refs) => {
            const repo = new BlobRepo(st, provider, storage);
            for(const ref of refs) {
                if(ref.id.startsWith("local/")) {
                    const num = Number(ref.id.slice(6));
                    if(num === Math.floor(num) && num >= repo.local_counter) {
                        repo.local_counter = num + 1;
                    }
                } else if(ref.id.startsWith("remote/")) {
                    repo.cache_used += ref.size;
                } else if(ref.id.startsWith("state/")) {
                    // pass
                }
                repo.createBlobState(ref, BlobPresence.AVAILABLE);
            }
            return repo;
        });
    }

    public get cache_reserved(): number {
        return this.cache_used + this.cache_expect;
    }

    public get cache_max(): number {
        return this.provider.cache_max;
    }

    public get cache_available(): number {
        return this.cache_max - this.cache_reserved;
    }

    /* Make the blobs available, call f() with them available. The blobs will
     * be available until the promise returned by f() is resolved, and that will
     * be the final result. */
    public withBlobs<T>(refs: Ref[], f: () => Promise<T>, cancel?: Promise<err.Cancelled>): Promise<T> {
        return this.withBlobStates(refs.map((ref) => this.getOrCreateBlobState(ref)), f, cancel);
    }

    private withBlobStates<T>(blobs: BlobState[], f: () => Promise<T>, cancel?: Promise<err.Cancelled>): Promise<T> {
        const pinned = new Set<BlobState>();

        blobs = Array.from(new Set(blobs));

        const pin = (blob: BlobState) => {
            if(pinned.has(blob)) return;
            this.incref(blob);
            pinned.add(blob);
        };

        return new Promise<T>((resolve, reject) => {
            const remote: BlobState[] = [];
            let done: boolean = false;

            const onDone = (e: Error | null) => {
                done = true;
                this.pull();
                for(const blob of blobs) {
                    blob.trackers.delete(tracker);
                }
                if(e === null) {
                    while(remote.length > 0) {
                        pin(remote.pop()!);
                    }
                    resolve();
                } else {
                    remote.splice(0, remote.length);
                    reject(e);
                }
                this.dl_reqs.delete(req);
            };

            if(cancel !== undefined) {
                cancel.then((e) => {
                    if(done) return;
                    onDone(e);
                });
            }

            let needed: number = blobs.length + 1;

            const tracker: BlobTracker = {
                onAvailable: (blob) => {
                    needed -= 1;
                    if(needed === 0) onDone(null);
                },
                onError: (blob, e) => {
                    onDone(e);
                },
                onEviction: (blob) => {
                    console.assert(isRemote(blob.ref));
                    needed += 1;
                    return;
                },
            };

            const req: DownloadRequest = {
                blobs: remote,
                onStart: pin,
            };

            for(const blob of blobs) {
                blob.trackers.add(tracker);
                if(isRemote(blob.ref)) {
                    remote.push(blob);
                } else {
                    pin(blob);
                }

                switch(blob.present) {
                    case BlobPresence.MISSING:
                        console.assert(isRemote(blob.ref));
                        break;
                    case BlobPresence.WAITING:
                        break;
                    case BlobPresence.AVAILABLE:
                        tracker.onAvailable(blob);
                        break;
                }
            }

            needed -= 1;

            if(needed === 0) {
                onDone(null);
                return;
            }

            if(remote.length !== 0) {
                remote.reverse();
                let total_size = 0;
                for(const blob of remote) {
                    total_size += blob.ref.size;
                }
                if(total_size > this.cache_max) {
                    onDone(new err.Cancelled("Request size above limit"));
                } else {
                    this.dl_reqs.add(req);
                    this.pull();
                }
            }
        }).then(f).finally(() => {
            for(const blob of pinned) {
                this.decref(blob);
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
        if(blob.present !== BlobPresence.AVAILABLE) {
            return Promise.reject(new err.State("Blob not available", {
                blob_id: ref.id,
            }));
        }
        if(blob.ref.size !== ref.size) {
            return Promise.reject(new err.State("Blob size mismatch", {
                blob_id: ref.id,
                got_size: blob.ref.size,
                want_size: ref.size,
            }));
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

    private getOrCreateBlobState(ref: Ref) {
        const blob = this.blobs.get(ref.id);
        if(blob !== undefined) {
            if(blob.ref.size !== ref.size) {
                this.st.reportError(new err.State("Blob size mismatch", {
                    blob_id: ref.id,
                    got_size: blob.ref.size,
                    want_size: ref.size,
                }));
            }
            return blob;
        }
        if(!isRemote(ref) && !isState(ref)) {
            throw new err.State("Blob not found", {
                blob_id: ref.id,
            });
        }
        return this.createBlobState(ref, BlobPresence.MISSING);
    }

    /* Register a blob ref with the repo, and log any inconsistencies */
    public register(ref: Ref): Ref {
        const blob = this.getOrCreateBlobState(ref);
        if(blob.ref.size === ref.size) return blob.ref;
        return ref;
    }

    /* Load a blob from the API. */
    public fromAPI(b: api.BlobRef): Ref {
        return this.register({
            id: "remote/" + b.id,
            size: b.size,
        });
    }

    private setBlobAvailable(blob: BlobState): void {
        const trackers = Array.from(blob.trackers);
        blob.present = BlobPresence.AVAILABLE;
        for(const tracker of trackers) {
            tracker.onAvailable(blob);
        }
    }

    private setBlobError(blob: BlobState, e: Error): void {
        const trackers = Array.from(blob.trackers);
        blob.present = BlobPresence.MISSING;
        for(const tracker of trackers) {
            tracker.onError(blob, e);
        }
    }

    private setBlobEvicted(blob: BlobState): void {
        const trackers = Array.from(blob.trackers);
        blob.present = BlobPresence.MISSING;
        for(const tracker of trackers) {
            tracker.onEviction(blob);
        }
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

        const ref = {
            id: `local/${i}`,
            size: data.byteLength,
        };

        const blob = this.createBlobState(ref, BlobPresence.WAITING);

        this.incref(blob);

        return [ref, this.storage.set(ref.id, new Uint8Array(data)).then(() => {
            this.setBlobAvailable(blob);
            return;
        }, (e) => {
            this.setBlobError(blob, e);
            throw e;
        })];
    }

    private incref(blob: BlobState): void {
        blob.refcnt += 1;
        if(blob.refcnt !== 1) return;
        if(blob.present === BlobPresence.MISSING) {
            blob.refcnt -= 1;
            throw new err.State("Blob missing", {
                "blob_id": blob.ref.id,
            });
        }
    }

    private decref(blob: BlobState): void {
        console.assert(blob.refcnt > 0);
        blob.refcnt -= 1;
        if(blob.refcnt !== 0) return;

        // Eviction possible?
        if(isRemote(blob.ref)) {
            if(blob.present === BlobPresence.AVAILABLE) {
                this.pull();
            }
        } else if(isLocal(blob.ref)) {
            this.blobs.delete(blob.ref.id);
            this.setBlobEvicted(blob);
            this.storage.delete(blob.ref.id).catch((e) => this.st.reportError(e));
        }
    }

    /* Mark the given blob as needed. */
    public pin(ref: Ref): Ref {
        const blob = this.getBlobState(ref);
        if(blob.ref.size !== ref.size) {
            throw new err.State("Blob size mismatch", {
                "blob_id": ref.id,
                "got_size": blob.ref.size,
                "want_size": ref.size,
            });
        }
        this.incref(blob);
        return blob.ref;
    }

    /* Mark the given blob as no longer needed. */
    public unpin(ref: Ref): void {
        const blob = this.getBlobState(ref);
        if(blob.refcnt < 1) {
            throw new err.State("Blob not pinned", {
                blob_id: ref.id,
            });
        }
        if(blob.ref.size !== ref.size) {
            throw new err.State("Blob size mismatch", {
                blob_id: ref.id,
                got_size: blob.ref.size,
                want_size: ref.size,
            });
        }
        this.decref(blob);
    }

    public readState(name: string): Promise<ArrayBuffer | null> {
        const blob = this.blobs.get("state/" + name);
        if(!blob) return Promise.resolve(null);
        return this.withBlobStates([blob], () => this.read(blob.ref));
    }

    public writeState(name: string, data: Uint8Array): Promise<void> {
        const ref = {
            id: "state/" + name,
            size: data.length,
        };
        let blob = this.blobs.get(ref.id);
        let oldState: BlobPresence;
        if(blob === undefined) {
            blob = this.createBlobState(ref, BlobPresence.WAITING);
            oldState = BlobPresence.MISSING;
        } else {
            if(blob.refcnt !== 0) {
                throw new err.State("State is being read");
            }
            oldState = blob.present;
            blob.ref = ref;
            blob.present = BlobPresence.WAITING;
        }

        return this.storage.set(ref.id, data).then(() => {
            this.setBlobAvailable(blob!);
        }, (e) => {
            console.error(e);
            if(oldState === BlobPresence.AVAILABLE) {
                this.setBlobAvailable(blob!);
            } else {
                this.setBlobError(blob!, e);
            }
            throw e;
        });
    }

    private createBlobState(ref: Ref, present: BlobPresence): BlobState {
        const blob: BlobState = {
            ref: ref,
            present: present,
            refcnt: 0,
            trackers: new Set(),
        };
        console.assert(this.blobs.get(ref.id) === undefined);
        this.blobs.set(ref.id, blob);
        return blob;
    }

    /* Get a BlobState from a given Ref. */
    private getBlobState(ref: Ref): BlobState {
        const blob = this.blobs.get(ref.id);
        if(blob) return blob;
        throw new err.State("Blob not found", {
            blob_id: ref.id,
        });
    }

    private pull_scheduled: boolean = false;
    private pull(): void {
        if(this.pull_scheduled) return;
        if(this.dl_cur >= this.dl_max) return;
        this.pull_scheduled = true;
        self.setTimeout(() => this.doPull(), 0);
    }

    private doPull(): void {
        this.pull_scheduled = false;

        for(const req of this.dl_reqs) {
            if(this.dl_cur >= this.dl_max) break;
            while(true) {
                const blob = req.blobs.pop();
                if(blob === undefined) {
                    this.dl_reqs.delete(req);
                    break;
                }
                let dl: boolean = false;
                if(blob.present === BlobPresence.MISSING) {
                    if(blob.ref.size > this.cache_available) {
                        if(!this.evict(blob.ref.size - this.cache_available)) {
                            req.blobs.push(blob);
                            return;
                        }
                    }
                    blob.present = BlobPresence.WAITING;
                    dl = true;
                }
                req.onStart(blob);
                if(dl) {
                    this.dlOne(blob);
                }
            }
        }
    }

    private dlOne(blob: BlobState): void {
        const id = blob.ref.id;
        const expected_size = blob.ref.size;

        // Maybe move most of this function into a field of BlobState set when
        // the blob is added to `dlq` for symmetry.
        const fin = (e: Error | null) => {
            this.dl_cur -= 1;
            this.cache_expect -= expected_size;

            if(e !== null) {
                if(this.blobs.get(id) === blob) {
                    this.blobs.delete(id);
                }
                this.setBlobError(blob, e);
            } else {
                this.setBlobAvailable(blob);
            }

            if(this.dl_cur === 0 && this.cache_expect !== 0) {
                this.st.reportError(new err.State("Expected cache size leak", {
                    "expected_cache_size_leak": this.cache_expect,
                }));
                this.cache_expect = 0;
            }

            this.pull();
        };

        this.dl_cur += 1;
        this.cache_expect += expected_size;

        try {
            console.assert(id.startsWith("remote/"));

            this.provider.getBlob(id.slice(7), expected_size).then((data) => {
                const real_size = data.byteLength;
                if(real_size !== expected_size) {
                    this.st.reportError(new err.State("Blob size changed", {
                        blob_id: id,
                        got_size: real_size,
                        want_size: expected_size,
                    }));
                    blob.ref = {
                        id: id,
                        size: real_size,
                    };
                }
                return this.storage.set(id, new Uint8Array(data)).then(() => {
                    this.cache_used += real_size;
                    return null;
                });
            }).then(fin, fin);
        } catch(e) {
            fin(e);
        }
    }

    private evict(size: number): boolean {
        if(size <= 0) return true;

        const evictable: BlobState[] = [];
        const req_index = new Map<BlobState, number>();

        for(const blob of this.blobs.values()) {
            if(isRemote(blob.ref) && blob.present === BlobPresence.AVAILABLE && blob.refcnt === 0) {
                evictable.push(blob);
            }
        }

        for(const req of this.dl_reqs) {
            const index = req_index.size;
            for(const blob of req.blobs) {
                if(!req_index.has(blob)) req_index.set(blob, index);
            }
        }

        evictable.sort((a, b) => {
            const ia = req_index.get(a);
            const ib = req_index.get(b);
            if(ia !== ib) {
                if(ia === undefined) return -1;
                if(ib === undefined) return 1;
                if(ia > ib) return -1;
                if(ia < ib) return 1;
                console.assert(false);
            }
            return 0;
        });

        for(const blob of evictable) {
            this.setBlobEvicted(blob);
            size -= blob.ref.size;
            this.cache_used -= blob.ref.size;
            this.storage.delete(blob.ref.id).catch((e) => this.st.reportError(e));
            if(size <= 0) return true;
        }

        return false;
    }
}
