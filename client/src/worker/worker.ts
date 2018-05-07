import "@/polyfill";

import * as workapi from "@/exec/workapi";

import Executor from "./exec";

const blobs_waiting = new Map<string, Array<(data: Uint8Array) => void>>();

class WorkerExecutor extends Executor {
    public readBlob(blob: workapi.Ref): Promise<Uint8Array> {
        let arr = blobs_waiting.get(blob.id);
        if(!arr) {
            arr = [];
            blobs_waiting.set(blob.id, arr);
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

    public onPrint(msg: string) {
        console.log(msg);
    }

    public onStarted(): void {
        sendControl({notify_started: null});
    }
}

const r = new WorkerExecutor();

onmessage = (msg) => {
    const data = msg.data as workapi.In;
    if(data.work) {
        r.run(data.work).then((d) => {
            return {result: d};
        }, (e) => {
            return {error: {
                "kind": "runtime",
                "message": e.message,
                "stack": e.stack,
            }};
        }).then((out: workapi.Out) => {
            postMessage(out, undefined);
        });
    } else if(data.control) {
        const ctl = data.control;
        if(ctl.get_blob !== undefined) {
            const [blob_id, blob_data] = ctl.get_blob;
            const cbs = blobs_waiting.get(blob_id);
            if(cbs) {
                blobs_waiting.delete(blob_id);
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
