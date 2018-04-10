import "../polyfill";

import * as stat from "../stat";

import {arrBuf, b64Buf} from "./test-util";

import * as api from "./api";
import MemStorage from "./mem_storage";
import Runner from "./runner";

import MockAPI from "./mock_api";

class PrintTSDB implements stat.TSDB {
    public table: HTMLElement;
    public table_data: Array<[string, string, HTMLElement]> = [];

    constructor(table: HTMLElement) {
        this.table = table;
    }

    public writeError(time: number, err: api.ErrorData) {
        console.log(err);
    }

    public write(time: number, update: stat.Point[]) {
        const compare = (ka: string, kb: string) => {
            if(ka < kb) return -1;
            if(ka > kb) return 1;
            return 0;
        };

        const lines = update.map(([name, key, value]) => {
            const key_keys = Object.keys(key);
            key_keys.sort();
            if(key_keys.length !== 0) {
                let key_fmt: string = "";
                for(const k of key_keys) {
                    key_fmt += ",";
                    key_fmt += k;
                    key_fmt += "=";
                    key_fmt += key[k];
                }
                name += "[" + key_fmt.slice(1) + "]";
            }
            return [name, "" + value];
        });

        lines.sort((x,y) => compare(x[0], y[0]));

        const tbl = this.table_data;
        let at = 0;

        for(const [k,v] of lines) {
            at -= 1;
            let step = 1;
            while(at+step < tbl.length && compare(tbl[at+step][0], k) < 0) step <<= 1;
            while(step > 1) {
                step >>= 1;
                if(at+step < tbl.length && compare(tbl[at+step][0], k) < 0) at += step;
            }
            at += 1;
            console.assert(at === tbl.length || compare(tbl[at][0], k) >= 0);
            if(at < tbl.length && compare(tbl[at][0], k) === 0) {
                if(v === null) {
                    this.table.removeChild(tbl[at][2].parentNode!);
                    tbl.splice(at, 1);
                } else if(v !== tbl[at][1]) {
                    tbl[at][1] = v;
                    const cv = tbl[at][2];
                    while(cv.firstChild) cv.removeChild(cv.firstChild);
                    cv.appendChild(self.document.createTextNode(v));
                }
            } else if(v !== null) {
                const ck = self.document.createElement("td");
                ck.appendChild(self.document.createTextNode(k));
                const cv = self.document.createElement("td");
                cv.appendChild(self.document.createTextNode(v));
                const row = self.document.createElement("tr");
                row.appendChild(ck);
                row.appendChild(cv);

                if(at === tbl.length) {
                    this.table.appendChild(row);
                } else {
                    this.table.insertBefore(row, tbl[at][2].parentNode);
                }
                tbl.splice(at, 0, [k, v, cv]);
            } else {
                /* pass */
            }
        }
    }
}

function fibtask(i: number, n: number): api.Task {
    let ns = "" + n, is = "" + i;
    if(ns.length === 1) ns = "0" + ns;
    if(is.length === 1) is = "0" + is;
    return {
        id: `fib${ns}.${is}`,
        project: "test",
        program: "prog-fib",
        in_control: arrBuf([n & 255, n >> 8, 0, 0, 0, 0, 0, 0]),
        in_blobs: [],
    };
}

function range(k: number, n?: number): number[] {
    if(n === undefined) {
        n = k;
        k = 0;
    }
    const res = [];
    for(let i = k; i < n; i += 1) res.push(i);
    return res;
}

function shuffle<T>(a: T[]): T[] {
    let i = a.length;
    while(i !== 1) {
        i -= 1;
        const j = Math.random() * i | 0;
        const v = a[i];
        a[i] = a[j];
        a[j] = v;
    }
    return a;
}

export function main() {
    const tbody = self.document.getElementById("stat_main")!;
    const in_cnt = self.document.getElementById("in_cnt") as HTMLInputElement;
    const in_min = self.document.getElementById("in_min") as HTMLInputElement;
    const in_max = self.document.getElementById("in_max") as HTMLInputElement;
    const in_wrk = self.document.getElementById("in_wrk") as HTMLInputElement;
    const but_more = self.document.getElementById("but_more")!;
    const but_start = self.document.getElementById("but_start")!;

    const st = new stat.Root(new PrintTSDB(tbody));
    const the_api = new MockAPI(st);

    the_api.blobs.set("prog-fib", b64Buf(
        "AGFzbQEAAAABHgZgAX8AYAAAYAF/AX9gAn9/AGADf39/AGACf38BfwIhAgNlbnYGbWVtb3J5AgAC" +
        "A2VudgtwcHR3MV9hYm9ydAAAAwsKAQIDBAICBAAABQYVA38BQbCPBAt/AEGwjwQLfwBBoQ8LB2gH" +
        "EV9fd2FzbV9jYWxsX2N0b3JzAAELX19oZWFwX2Jhc2UDAQpfX2RhdGFfZW5kAwIKcHB0dzFfaW5p" +
        "dAABDXBwdHcxX2NsZWFudXAAAQlwcHR3MV9ydW4AAgxwcHR3MV9tYWxsb2MABQruGAoDAAEL1QIC" +
        "BH8BfiMAIgMhBAJAIAAoAgRBCEYEQCAAKAIAIgExAAFCCIYgATEAAIQgATEAAkIQhoQgATEAA0IY" +
        "hoQiBSABMQAEQiCGhCABMQAFQiiGhCABMQAGQjCGhCABMQAHQjiGhEJ/fELaAFoNASADIAWnIgJB" +
        "EWpBcHFrIgEkACABQQAgAkECahAEQgAhBQJAIAEgAmoiAi0AAEUEQCACQQFqIQMDQCADLQAADQIg" +
        "AUEAEAMgBUIBfCEFIAItAABFDQALCyAAKAIAIgEEQCABEAgLQQgQBSEBIAAQCCABIAVCGIg8AAMg" +
        "ASAFQgiIPAABIAEgBTwAACABIAVCEIg8AAIgASAFQiCIPAAEIAEgBUIoiDwABSABIAVCMIg8AAYg" +
        "ASAFQjiIPAAHQZALIAE2AgBBlAtCCDcCACAEJABBkAsPC0GwChAAAAtBgAgQAAALQZYJEAAAC4QC" +
        "AQN/An9BAiAAIAFBASABGyIBaiIDLQAARQ0AGkEACyECA0ACQAJAAkACQAJAAkACQAJAAkACQAJA" +
        "AkAgAg4HAQIDBAUABgYLIARBADoAACAAIAFBAmoiAUEBIAEbIgFqIgMtAABFDQdBACECDAsLIANB" +
        "ADoAACAAIAFBfmoQA0EBIQIMCgsgACABQQFqIgFBASABGyIBaiIDLQAADQRBAiECDAkLIANBf2oi" +
        "BC0AAEUNBkEDIQIMCAsgBEEAOgAADAQLIANBAWoiBC0AAA0FQQYhAgwGCyADQQE6AAAPC0EAIQIM" +
        "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" +
        "DSAHNgIADwtBvQ4QAAALQYYOEAAAC0G3CBAAAAtBxwkQAAALQccJEAAAC0HHCRAAAAtBxwkQAAAL" +
        "QccJEAAAC0HHCRAAAAtBtwgQAAALQe8OEAAAC0G3CBAAAAtB7w4QAAALQccJEAAAC0G3CBAAAAtB" +
        "7w4QAAALQZwNIAc2AgALUAACQCAAIAFNBEACQCABQf//A2pBEHYgAEH//wNqQRB2IgFrIgAEQCAA" +
        "QAAiAEF/Rg0BIAAgAUcNAwtBAQ8LQQAPC0HjCBAAAAtB+AkQAAALC8IFCQBBgAgLlQFBc3NlcnRp" +
        "b24gYHJlcS0+Y29udHJvbC5zaXplID09IDgnIGZhaWxlZCBhdCB0ZXN0LmM6NTMAQXNzZXJ0aW9u" +
        "IGBzaXplID49IDInIGZhaWxlZCBhdCBtYWxsb2MuYzo5NABBc3NlcnRpb24gYG9sZF9oZWFwIDw9" +
        "IG5ld19oZWFwJyBmYWlsZWQgYXQgbWVtLmM6NwBBlgkLmQFBc3NlcnRpb24gYGkgPiAwICYmIGkg" +
        "PD0gOTAnIGZhaWxlZCBhdCB0ZXN0LmM6NTYAQXNzZXJ0aW9uIGBoZHJfaXNfZnJlZShoKScgZmFp" +
        "bGVkIGF0IG1hbGxvYy5jOjQ5AEFzc2VydGlvbiBgZ3Jvd19yZXN1bHQgPT0gb2xkX3BhZ2VzJyBm" +
        "YWlsZWQgYXQgbWVtLmM6MTQAQbAKC1xBc3NlcnRpb24gYCFoYXZlW2krMV0nIGZhaWxlZCBhdCB0" +
        "ZXN0LmM6NjIAQXNzZXJ0aW9uIGBia3RzW2JrdF0gPT0gaCcgZmFpbGVkIGF0IG1hbGxvYy5jOjE1" +
        "MgBBmA0LA7AHAQBBoA0LNEFzc2VydGlvbiBgaCAhPSBia3RzW0JLVFMrMV0nIGZhaWxlZCBhdCBt" +
        "YWxsb2MuYzoxOTMAQdUNCzBBc3NlcnRpb24gYHJzaXplID49IHNpemUnIGZhaWxlZCBhdCBtYWxs" +
        "b2MuYzoxOTQAQYYOCzZBc3NlcnRpb24gYGggIT0gYmt0c1tCS1RTICsgMV0nIGZhaWxlZCBhdCBt" +
        "YWxsb2MuYzoxODMAQb0OCzFBc3NlcnRpb24gYGhkcl9pc19hbGxvYyhoKScgZmFpbGVkIGF0IG1h" +
        "bGxvYy5jOjUzAEHvDgsxQXNzZXJ0aW9uIGBia3RzW2JrdF0gPT0gaCcgZmFpbGVkIGF0IG1hbGxv" +
        "Yy5jOjE0Mg=="
    ));

    let i = -1;
    but_more.onclick = () => {
        let cnt = Number(in_cnt.value);
        while(cnt > 0) {
            cnt -= 1;
            i += 1;
            const n1 = Number(in_min.value);
            const n2 = Number(in_max.value);
            if(n1 !== n1 || n2 !== n2 || n1 > n2 || n1 !== (n1 >>> 0) || n2 !== (n2 >>> 0) || n2 > 200) {
                self.alert("Invalid input");
                return;
            }

            for(const n of shuffle(range(n1, n2 + 1))) {
                the_api.tasks.enqueue(fibtask(i, n));
            }
            the_api.report();
        }
    };

    addRunner(the_api);
    but_start.onclick = () => addRunner(the_api);
    in_wrk.oninput = () => {
        const v = Number(in_wrk.value);
        if(v !== Math.floor(v) || v <= 0) return;
        the_api.workers = v;
    };
}

export function addRunner(the_api: api.WorkProvider) {
    const el_runners = self.document.getElementById("runners")!;

    const el_self = self.document.createElement("div");
    el_runners.appendChild(el_self);

    const but_stop = self.document.createElement("button")!;
    el_self.appendChild(but_stop);

    const table = self.document.createElement("table")!;
    el_self.appendChild(table);

    const tbody = self.document.createElement("tbody")!;
    table.appendChild(tbody);

    const st = new stat.Root(new PrintTSDB(tbody));
    const the_storage = new MemStorage();

    let r: Runner | null;

    const do_stop = () => {
        but_stop.innerHTML = "Stopping";
        but_stop.onclick = () => {};
        r!.stop().then(() => {
            r = null;
            but_stop.innerHTML = "Start";
            but_stop.onclick = do_start;
        });
    };

    const do_start = () => {
        but_stop.innerHTML = "Starting";
        but_stop.onclick = () => {};
        Runner.create(st, the_api, the_storage).then((rv) => {
            r = rv;
            but_stop.innerHTML = "Stop";
            but_stop.onclick = do_stop;
        });
    };

    do_start();
}

self.onload = () => main();
