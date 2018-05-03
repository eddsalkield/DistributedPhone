import * as err from "@/err";
import {Ref, Storage} from "./storage";

export default class MemStorage implements Storage {
    public readonly blobs: Map<string, Uint8Array>;

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

    public get(id: string): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            const bl = this.blobs.get(id);
            if(bl) resolve(new Uint8Array(bl));
            else reject(new err.State("Blob not found", {blob_id: id}));
        });
    }

    public delete(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.blobs.delete(id);
            resolve();
        });
    }

    public set(id: string, data: Uint8Array): Promise<void> {
        return new Promise((resolve, reject) => {
            this.blobs.set(id, new Uint8Array(data));
            resolve();
        });
    }
}
