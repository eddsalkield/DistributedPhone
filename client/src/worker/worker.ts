import "../polyfill";

import * as workapi from "../exec/workapi";

const blobWait = new Map<string, Array<(data: ArrayBuffer) => void>>();
function readBlob(blob: workapi.Ref): Promise<ArrayBuffer> {
    let arr = blobWait.get(blob.id);
    if(!arr) {
        arr = [];
        blobWait.set(blob.id, arr);
        sendControl({get_blob: blob});
    }
    return new Promise((resolve, reject) => {
        arr!.push((data) => {
            if(data.byteLength === blob.size) {
                resolve(data);
            } else {
                reject(new Error("Blob size mismatch"));
            }
        });
    });
}

declare interface Env {
    [name: string]: ((...args: any[]) => any) | WebAssembly.Memory | number;
}

declare interface ImportObject {
    [name: string]: Env;
}

function abi1(
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

            console.log("Program print()" + getString(new Uint8Array(mem.buffer, ptr, size)));
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
        pr_done.push(readBlob(in_data[i]).then((data) => {
            const size = data.byteLength;
            console.assert(size === in_data[i].size);
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
        sendControl({notify_started: null});
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

function runProgram(prog: WebAssembly.Module, data: workapi.InWork): Promise<workapi.OutResult> {
    return abi1(prog, data.control, data.data);
}

interface CompileCacheItem {
    id: string;
    mod: WebAssembly.Module;
}

/* Keep a 3-element LRU cache */
const compile_cache: CompileCacheItem[] = [];
const compile_cache_size = 3;
function run(data: workapi.InWork): Promise<workapi.OutResult> {
    const prog_ref = data.program;

    for(let i = 0; i < compile_cache.length; i += 1) {
        const ii = compile_cache[i];
        if(ii.id === prog_ref.id) {
            compile_cache.splice(i, 1);
            compile_cache.push(ii);
            return runProgram(ii.mod, data);
        }
    }

    return readBlob(prog_ref).then((code) => {
        const prog_mod = new WebAssembly.Module(code);

        compile_cache.push({id: prog_ref.id, mod: prog_mod});
        if(compile_cache.length > compile_cache_size) {
            compile_cache.splice(0, compile_cache.length - compile_cache_size);
        }

        return runProgram(prog_mod, data);
    });
}

onmessage = (msg) => {
    const data = msg.data as workapi.In;
    if(data.work) {
        run(data.work).then((d) => {
            return {result: d};
        }, (e) => {
            return {error: {
                "kind": "runtime",
                "message": e.message,
            }};
        }).then((out: workapi.Out) => {
            postMessage(out, undefined);
        });
    } else if(data.control) {
        const ctl = data.control;
        if(ctl.get_blob !== undefined) {
            const [blob_id, blob_data] = ctl.get_blob;
            const cbs = blobWait.get(blob_id);
            if(cbs) {
                blobWait.delete(blob_id);
                for(const cb of cbs) {
                    cb(blob_data);
                }
            } else {
                console.log("Not-needed " + blob_id);
            }
        }
    }
};

function sendControl(ctl: workapi.OutControl): void {
    postMessage({control: ctl});
}
