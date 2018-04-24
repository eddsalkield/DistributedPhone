import * as workapi from "@/exec/workapi";

declare interface Env {
    [name: string]: ((...args: any[]) => any) | WebAssembly.Memory | number;
}

declare interface ImportObject {
    [name: string]: Env;
}

interface CompileCacheItem {
    id: string;
    mod: WebAssembly.Module;
}

export default class Executor {
    private abi1(
        in_program: WebAssembly.Module,
        in_control: ArrayBuffer, in_data: workapi.Ref[]
    ): Promise<workapi.OutResult> {
        const mem = new WebAssembly.Memory({
            initial: 2,
            maximum: 1024,
        });

        const getString = (view: Uint8Array): string => {
            // if(view.some((c) => ((c < 32 && c != 10) || c == 127))) return " with invalid string.";
            if(view.every((c) => (c < 128))) {
                return ": " + String.fromCharCode(...view);
            } else {
                return " with Unicode string (Decoding hasn't been implemented yet)";
            }
        };

        const import_env: Env = {
            memory: mem,
            pptw1_print: (ptr: any, size: any) => {
                if(typeof ptr !== "number" || ptr !== (ptr | 0)) {
                    throw new Error("Invalid call to print()");
                }
                if(typeof size !== "number" || size !== (size | 0)) {
                    throw new Error("Invalid call to print()");
                }
                if(size < 0) {
                    throw new Error("Invalid call to print()");
                }

                ptr >>>= 0;
                if(ptr + size > mem.buffer.byteLength) {
                    throw new Error("Invalid call to print()");
                }

                this.onPrint("Program print()" + getString(new Uint8Array(mem.buffer, ptr, size)));
            },
            pptw1_abort: (ptr: any) => {
                if(typeof ptr !== "number" || ptr !== (ptr | 0)) {
                    throw new Error("Invalid call to abort()");
                }

                ptr >>>= 0;

                if(ptr === 0) throw new Error("Program abort()");
                if(ptr >= mem.buffer.byteLength) {
                    throw new Error("Invalid call to abort()");
                }

                const view = new Uint8Array(mem.buffer, ptr);

                let i = 0;
                while(true) {
                    const d = view[i];
                    if(d === 0) {
                        throw new Error("Program abort()" + getString(view.subarray(0, i)));
                    }
                    i += 1;
                    if(i === view.length) {
                        throw new Error("Program abort() with non-terminated string");
                    }
                }
            },
        };

        const import_object: ImportObject = {
            env: import_env,
        };
        const inst = new WebAssembly.Instance(in_program, import_object);

        inst.exports.pptw1_init();

        const addr_in = inst.exports.pptw1_malloc((3 + 2*in_data.length) * 4);
        const addr_control = inst.exports.pptw1_malloc(in_control.byteLength);

        const pr_done: Array<Promise<void>> = [];
        for(let i2 = 0; i2 < in_data.length; i2 += 1) {
            const i = i2;
            pr_done.push(this.readBlob(in_data[i]).then((data) => {
                const size = data.byteLength;
                const addr = inst.exports.pptw1_malloc(size);

                const view = new DataView(mem.buffer, addr_in + (3 + 2*i) * 4, 2 * 4);
                view.setUint32(0, addr, true);
                view.setUint32(4, size, true);
                new Uint8Array(mem.buffer, addr, size).set(new Uint8Array(data));
            }));
        }

        {
            const view = new DataView(mem.buffer, addr_in, 3 * 4);
            view.setUint32(0, addr_control, true);
            view.setUint32(4, in_control.byteLength, true);
            view.setUint32(8, in_data.length, true);
        }
        new Uint8Array(mem.buffer, addr_control, in_control.byteLength).set(new Uint8Array(in_control));

        return Promise.all(pr_done).then(() => {
            this.onStarted();
            let res_addr = inst.exports.pptw1_run(addr_in);

            let outc_addr: number;
            let outc_size: number;
            let outc_blobs: number;
            {
                const view = new DataView(mem.buffer, res_addr, 3 * 4);
                res_addr += 3 * 4;
                outc_addr = view.getUint32(0, true);
                outc_size = view.getUint32(4, true);
                outc_blobs = view.getUint32(8, true);
            }

            const res: workapi.OutResult = {
                control: new ArrayBuffer(outc_size),
                data: [],
            };

            new Uint8Array(res.control).set(new Uint8Array(mem.buffer, outc_addr, outc_size));

            for(let i = 0; i < outc_blobs; i += 1) {
                const view = new DataView(mem.buffer, res_addr, 2 * 4);
                res_addr += 2 * 4;
                const blob_addr = view.getUint32(0, true);
                const blob_size = view.getUint32(4, true);

                const blob = new ArrayBuffer(blob_size);
                new Uint8Array(blob).set(new Uint8Array(mem.buffer, blob_addr, blob_size));
                res.data.push(blob);
            }

            inst.exports.pptw1_cleanup();

            return res;
        });
    }

    private runProgram(prog: WebAssembly.Module, data: workapi.InWork): Promise<workapi.OutResult> {
        return this.abi1(prog, data.control, data.data);
    }

    /* Keep a 3-element LRU cache */
    private readonly compile_cache: CompileCacheItem[] = [];
    private readonly compile_cache_size = 3;

    public run(data: workapi.InWork): Promise<workapi.OutResult> {
        const prog_ref = data.program;
        const cc = this.compile_cache;

        for(let i = 0; i < cc.length; i += 1) {
            const ii = cc[i];
            if(ii.id === prog_ref.id) {
                cc.splice(i, 1);
                cc.push(ii);
                return this.runProgram(ii.mod, data);
            }
        }

        return this.readBlob(prog_ref).then((code) => {
            const ccs = this.compile_cache_size;
            const prog_mod = new WebAssembly.Module(code);

            cc.push({id: prog_ref.id, mod: prog_mod});
            if(cc.length > ccs) {
                cc.splice(0, cc.length - ccs);
            }

            return this.runProgram(prog_mod, data);
        });
    }

    public readBlob(blob: workapi.Ref): Promise<ArrayBuffer> {
        return Promise.reject(new Error("readBlob: Not implemented"));
    }
    public onPrint(msg: string) {}
    public onStarted(): void {}
}
