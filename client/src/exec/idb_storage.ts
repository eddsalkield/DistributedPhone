import * as err from "@/err";
import * as stat from "@/stat";

import {Ref, Storage} from "./storage";

declare interface Entry {
    "id": string;
    "size_nl_id": string;
    "data": ArrayBuffer;
}

function idbReject(reject: (e: Error) => void): (event: Event) => void {
    return (event) => {
        const e = (event.target as IDBRequest).error;
        if(e instanceof Error) reject(e);
        reject(new err.Runtime(`Operation failed: ${e}`));
    };
}

export default class IDBStorage implements Storage {
    private constructor(
        private readonly st: stat.Sink,
        private readonly db: IDBDatabase
    ) {
        db.onversionchange = () => {
            db.close();
        };
    }

    public static create(st: stat.Sink, name: string): Promise<IDBStorage> {
        return new Promise<IDBStorage>((resolve, reject) => {
            const req = indexedDB.open(name, 1);
            req.onerror = idbReject(reject);
            req.onsuccess = () => resolve(new IDBStorage(st, req.result));
            req.onblocked = () => {
                reject(new err.Runtime("Database in use by other process but upgrade needed"));
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
                        throw new err.State("Invalid data in IDBStorage: size_nl_id key is not string");
                    }
                    const i = k.indexOf("\n");
                    if(i === -1) {
                        throw new err.State("Invalid data in IDBStorage: size_nl_key invalid");
                    }
                    const size = Number(k.slice(0, i));
                    const id = k.slice(i+1);
                    if(size !== Math.floor(size) || size < 0 || id !== cursor.primaryKey) {
                        throw new err.State("Invalid data in IDBStorage: size_nl_key invalid");
                    }
                    res.push({
                        id: id,
                        size: size,
                    });
                } catch(e) {
                    this.st.reportError(e);
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
                    reject(new err.State("Blob not found"));
                    return;
                }
                const data = res["data"];
                if(!(data instanceof ArrayBuffer)) {
                    reject(new err.State("Invalid data in IDBStorage: data not ArrayBuffer DEBUG:" + data));
                    return;
                }
                resolve(data);
            };
        });
    }

    public set(id: string, d: Uint8Array): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const data = new ArrayBuffer(d.length);
            new Uint8Array(data).set(d);

            let ok = false;

            const tr = this.db.transaction(["blobs"], "readwrite");
            tr.onerror = idbReject(reject);
            tr.oncomplete = () => {
                if(ok) resolve();
                else reject(tr.error || new err.Runtime("Transaction failed"));
            };
            tr.onerror = () => {
                reject(tr.error);
            };

            const store = tr.objectStore("blobs");

            const obj: Entry = {
                "id": id,
                "size_nl_id": `${data.byteLength}\n${id}`,
                "data": data,
            };
            const req = store.put(obj);
            req.onerror = idbReject(reject);
            req.onsuccess = () => {
                ok = true;
            };
        });
    }

    public delete(id: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let ok = false;

            const tr = this.db.transaction(["blobs"], "readwrite");
            tr.onerror = idbReject(reject);
            tr.oncomplete = () => {
                if(ok) resolve();
                else reject(tr.error || new err.Runtime("Transaction failed"));
            };

            const store = tr.objectStore("blobs");

            const req = store.delete(IDBKeyRange.only(id));
            req.onerror = idbReject(reject);
            req.onsuccess = () => {
                ok = true;
            };
        });
    }
}
