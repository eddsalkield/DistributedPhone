import * as api from "./api";
import {Ref, Storage} from "./storage";

export default class MemStorage implements Storage {
    private blobs: Map<string, ArrayBuffer>;

    constructor() {
        this.blobs = new Map();
    }

    public list(): Promise<Ref[]> {
        return Promise.resolve(Array.from(this.blobs.entries()).map(([key, data]) => {
            return {
                id: key,
                size: data.byteLength,
            };
        }));
    }

    public get(id: string): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const bl = this.blobs.get(id);
            if(bl) resolve(bl.slice(0));
            else reject(new api.StateError("Blob not found", {blob_id: id}));
        });
    }

    public delete(id: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            resolve(this.blobs.delete(id));
        });
    }

    public set(id: string, data: Uint8Array): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if(this.blobs.get(id)) {
                resolve(true);
            } else {
                resolve(false);
            }
            const bl = new ArrayBuffer(data.byteLength);
            (new Uint8Array(bl)).set(data);
            this.blobs.set(id, bl);
        });
    }
}
