import "@/polyfill";

import * as workapi from "@/exec/workapi";

import Executor from "@/worker/exec";

declare const process: {
    readonly argv: string[];
};

declare const console: any;
declare const require: any;
declare const Buffer: any;
declare type Buffer = any;

const fs = require('fs');

class NodeExecutor extends Executor {
    public readBlob(blob: workapi.Ref): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            fs.readFile(blob.id, (err: Error, buf: Buffer) => {
                if(err) reject(err);
                else resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
            });
        });
    }

    public onPrint(msg: string) {
        console.log(msg);
    }
}

function resolve(name: string): workapi.Ref {
    return {
        id: name,
        size: fs.statSync(name).size,
    };
}

const r = new NodeExecutor();

r.readBlob(resolve(process.argv[3])).then((control) => {
    return r.run({
        program: resolve(process.argv[2]),
        control: control,
        data: process.argv.slice(4).map(resolve),
    });
}).then((out) => {
    for(let i = 0; i < out.data.length; i += 1) {
        fs.writeFileSync("output-blob-" + i, new Buffer(out.data[i]));
    }
    console.log("Success, wrote " + out.data.length + " blobs.");
}, (err) => {
    console.error(err);
});
