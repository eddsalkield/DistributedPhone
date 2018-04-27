import * as err from "@/err";
import {Ref, Storage} from "./storage";

export default class MemStorage implements Storage {
    public readonly blobs: Map<string, ArrayBuffer>;

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
            const bl = new ArrayBuffer(data.byteLength);
            new Uint8Array(bl).set(data);
            this.blobs.set(id, bl);
            resolve();
        });
    }
}
