import * as api from "./api";
import {Stat} from "./stat";
import {Ref, Storage} from "./storage";

declare interface Entry {
    "id": string;
    "size_nl_id": string;
    "data": ArrayBuffer;
}

function idbReject(reject: (e: Error) => void): (event: Event) => void {
    return (event) => {
        const err = (event.target as IDBRequest).error;
        if(err instanceof Error) reject(err);
        reject(new api.RuntimeError(`Operation failed: ${err}`));
    };
}

export default class IDBStorage implements Storage {
    public readonly stat: Stat;
    private readonly db: IDBDatabase;

    private constructor(stat: Stat, db: IDBDatabase) {
        this.stat = stat;
        this.db = db;
        db.onversionchange = () => {
            db.close();
        };
    }

    public static create(stat: Stat, name: string): Promise<IDBStorage> {
        return new Promise<IDBStorage>((resolve, reject) => {
            const req = indexedDB.open(name, 1);
            req.onerror = idbReject(reject);
            req.onsuccess = () => resolve(new IDBStorage(stat, req.result));
            req.onblocked = () => {
                reject(new api.RuntimeError("Database in use by other process but upgrade needed"));
            };
            req.onupgradeneeded = (ev) => {
                const db = req.result;

                if(ev.oldVersion < 1) {
                    const store = db.createObjectStore("blobs", {keyPath: "id"});
                    store.createIndex("size_nl_id", "size_nl_id");
                }
            };
        });
    }

    public static delete(name: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase(name);
            req.onerror = idbReject(reject);
            req.onsuccess = () => resolve();
        });
    }

    public stop(): Promise<void> {
        this.db.close();
        return Promise.resolve();
    }

    public list(): Promise<Ref[]> {
        return new Promise<Ref[]>((resolve, reject) => {
            const tr = this.db.transaction(["blobs"], "readonly");
            tr.onerror = idbReject(reject);

            const req = tr.objectStore("blobs").index("size_nl_id").openKeyCursor();
            req.onerror = idbReject(reject);

            const res: Ref[] = [];
            req.onsuccess = (event) => {
                const cursor: IDBCursor | undefined = req.result;
                if(!cursor) {
                    resolve(res);
                    return;
                }
                const k = cursor.key;
                try {
                    if(typeof k !== "string") {
                        throw new api.StateError("Invalid data in IDBStorage: size_nl_id key is not string");
                    }
                    const i = k.indexOf("\n");
                    if(i === -1) {
                        throw new api.StateError("Invalid data in IDBStorage: size_nl_key invalid");
                    }
                    const size = Number(k.slice(0, i));
                    const id = k.slice(i+1);
                    if(size !== Math.floor(size) || size < 0 || id !== cursor.primaryKey) {
                        throw new api.StateError("Invalid data in IDBStorage: size_nl_key invalid");
                    }
                    res.push({
                        id: id,
                        size: size,
                    });
                } catch(e) {
                    this.stat.reportError(e);
                }
                try {
                    cursor.continue();
                } catch(e) {
                    reject(e);
                }
            };
        });
    }

    public get(id: string): Promise<ArrayBuffer> {
        return new Promise<ArrayBuffer>((resolve, reject) => {
            const tr = this.db.transaction(["blobs"], "readonly");
            tr.onerror = idbReject(reject);

            const req = tr.objectStore("blobs").get(IDBKeyRange.only(id));
            req.onerror = idbReject(reject);

            req.onsuccess = (event) => {
                const res = req.result;
                if(res === undefined) {
                    reject(new api.StateError("Blob not found"));
                    return;
                }
                const data = res["data"];
                if(!(data instanceof ArrayBuffer)) {
                    reject(new api.StateError("Invalid data in IDBStorage: data not ArrayBuffer DEBUG:" + data));
                    return;
                }
                resolve(data);
            };
        });
    }

    public set(id: string, d: Uint8Array): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const data = new ArrayBuffer(d.length);
            new Uint8Array(data).set(d);

            let deleted = false;
            let ok = false;

            const tr = this.db.transaction(["blobs"], "readwrite");
            tr.onerror = idbReject(reject);
            tr.oncomplete = () => {
                if(ok) resolve(deleted);
                else reject(tr.error || new api.RuntimeError("Transaction failed"));
            };
            tr.onerror = () => {
                reject(tr.error);
            };

            const store = tr.objectStore("blobs");
            const req = store.count(IDBKeyRange.only(id));
            req.onerror = idbReject(reject);

            const doIns = () => {
                try {
                    const obj: Entry = {
                        "id": id,
                        "size_nl_id": `${data.byteLength}\n${id}`,
                        "data": data,
                    };
                    const r2 = store.add(obj);
                    r2.onerror = idbReject(reject);
                    r2.onsuccess = () => {
                        ok = true;
                    };
                } catch(e) {
                    reject(e);
                    tr.abort();
                }
            };

            req.onsuccess = () => {
                if((req.result as number) !== 0) {
                    deleted = true;
                    try {
                        const r2 = store.delete(IDBKeyRange.only(id));
                        r2.onerror = idbReject(reject);
                        r2.onsuccess = () => doIns();
                    } catch(e) {
                        reject(e);
                        tr.abort();
                    }
                } else {
                    doIns();
                }
            };
        });
    }

    public delete(id: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            let deleted = false;
            let ok = false;

            const tr = this.db.transaction(["blobs"], "readwrite");
            tr.onerror = idbReject(reject);
            tr.oncomplete = () => {
                if(ok) resolve(deleted);
                else reject(tr.error || new api.RuntimeError("Transaction failed"));
            };

            const store = tr.objectStore("blobs");
            const req = store.count(IDBKeyRange.only(id));
            req.onerror = idbReject(reject);

            req.onsuccess = () => {
                if((req.result as number) !== 0) {
                    deleted = true;
                    try {
                        const r2 = store.delete(IDBKeyRange.only(id));
                        r2.onerror = idbReject(reject);
                        r2.onsuccess = () => {
                            ok = true;
                        };
                    } catch(e) {
                        reject(e);
                        tr.abort();
                    }
                } else {
                    ok = true;
                }
            };
        });
    }
}
