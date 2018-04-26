import "@/polyfill";

import * as stat from "@/stat";

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
    const but_more = self.document.getElementById("but_more")!;
    const but_start = self.document.getElementById("but_start")!;

    const st = new stat.Root(new PrintTSDB(tbody));
    const the_api = new MockAPI(st);

    the_api.blobs.set("prog-fib", b64Buf(
        "AGFzbQEAAAABHgZgAX8AYAAAYAF/AX9gAn9/AGADf39/AGACf38BfwITAQNlbnYLcHB0dzFfYWJv" +
        "cnQAAAMLCgECAwQCAgQAAAUFAwEAAgYVA38BQaCPBAt/AEGgjwQLfwBBkQ8LB10HBm1lbW9yeQIA" +
        "C19faGVhcF9iYXNlAwEKX19kYXRhX2VuZAMCCnBwdHcxX2luaXQAAQ1wcHR3MV9jbGVhbnVwAAEJ" +
        "cHB0dzFfcnVuAAIMcHB0dzFfbWFsbG9jAAUK/RcKAwABC+gCAgR/AX4jAEEQayICIQQgAiQAAkAg" +
        "ACgCBEEIRgRAIAAoAgAiATEAAUIIhiABMQAAhCABMQACQhCGhCABMQADQhiGhCIFIAExAARCIIaE" +
        "IAExAAVCKIaEIAExAAZCMIaEIAExAAdCOIaEQn98QtoAWg0BIAIgBaciA0ERakFwcWsiASQAIAFB" +
        "ACADQQJqEARCACEFAkAgASADaiICQX9qIgMtAABFBEADQCACLQAADQIgAUEAEAMgBUIBfCEFIAMt" +
        "AABFDQALCyAAKAIAIgEEQCABEAgLQQgQBSEBIAAQCCABIAVCCIg8AAEgASAFPAAAIAEgBUIQiDwA" +
        "AiABIAVCGIg8AAMgASAFQiCIPAAEIAEgBUIoiDwABSABIAVCMIg8AAYgASAFQjiIPAAHQQwQBSIC" +
        "IAE2AgwgAkEBNgIAIAJBCDYCECAEQRBqJAAgBEEMag8LQa4KEAAAC0GACBAAAAtBlQkQAAALgAEB" +
        "An8DQCAAIAFBASABGyICaiIBLQAABEAgAUEAOgAAQQIhASACQQFGDQEgACACQX5qEAMgAkEBaiEB" +
        "DAELIAFBf2oiAy0AAARAIANBADoAACACQQFqIQEMAQsgAUEBaiIDLQAABEAgA0EAOgAAIAJBAmoh" +
        "AQwBCwsgAUEBOgAAC3YBAX8CQAJAIAJBCE8EQCAAQQNxRQ0CA0AgACADaiICIAE6AAAgA0EBaiED" +
        "IAJBAWpBA3ENAAsgA0EERg0BCwNAIAAgA2ogAToAACADQQFqIgNBBEcNAAsLDwsgACABQf8BcSID" +
        "QQh0IANyIgNBEHQgA3I2AgALlgEBBX8CfyAAQQdqQQN2QQFqIgEQBiIARQRAAn9BjA0oAgAiAgRA" +
        "IAIgAkEEaigCAEF4cWoMAQtBoI8ECyIAIAFBA3QiBGoiA0GIDSgCACIFSwRAQQAiASAFIAMQCkUN" +
        "AhpBiA0gAzYCAAsgACACNgIAQYwNIAA2AgAgACAEQQZyNgIEQQAiASAARQ0BGgsgAEEIagsiAQvm" +
        "AwEFfwJAAkACQAJAAkACQAJAAkAgAEEDTwRAAn8gAEF/aiIBQYCAAU8EQCABQQR2IQFBIgwBCyAB" +
        "QQh2IAEgAUH/B0siAhshAUEWQX4gAhsLIgJBDGogAiABQT9LIgMbIgJBBmogAiABQQR2IAEgAxsi" +
        "AUEPSyIDGyICQQNqIAIgAUECdiABIAMbIgFBB0siAxsgASADdiIBQQYgAUEGSRtqQQFqIgJBPUsN" +
        "AQtBPyACayEBIAJBAnRBjAtqIQIDQCABQX9qIQEgAkEEaiICKAIAIgNFDQALIAFFDQEgAygCCCIB" +
        "BEAgAUEEaigCAEEHcUEFRw0FIAFBDGpBADYCAAsgAiABNgIAIAMgA0EEaigCAEEDdiAAEAcgAw8L" +
        "QYQNKAIAIgNFDQAgAyEBA0AgAUEEaigCACICQQdxQQVHDQMgAkEDdiICIABPDQIgASgCCCIBDQAL" +
        "C0EADwsgASgCCCEEAkACQCABQQxqKAIAIgUEQCAFQQRqKAIAQQdxQQVHDQUgBSAENgIIIAQNAQwC" +
        "CyADIAFHDQYgBEUNAQsgBEEEaigCAEEHcUEFRw0EIARBDGogBTYCAAsgASACIAAQByABDwtBxQkQ" +
        "AAALQcUJEAAAC0HFCRAAAAtBxQkQAAALQdgKEAAAC/UCAQZ/AkACQAJAAkBBjA0oAgAgAEcEQCAB" +
        "IAJJDQECQCACQQJqIAFLBEAgASECDAELIAAgASACEAcgACACQQN0aiIFIAA2AgAgACABQQN0aiAF" +
        "NgIAQYwNKAIAIAVGDQMgASACayIBQQFNDQQCfyABQYCAAU8EQCABQQR2IQNBIgwBCyABQQh2IAEg" +
        "AUH/B0siBBshA0EWQX4gBBsLIQQgA0EEdiADIANBP0siBhsiA0ECdiADIANBD0siBxsiAyADQQdL" +
        "IgN2IghBBiAIQQZJGyAEQQxqIAQgBhsiBEEGaiAEIAcbIgRBA2ogBCADG2pBAnRBkAtqIgQoAgAh" +
        "AyAEIAU2AgAgACACQQN0aiIEQQRqIAFBA3RBBXI2AgAgBCADNgIIIANFDQAgA0EEaigCAEEHcUEF" +
        "Rw0FIANBDGogBTYCAAsgACACQQN0QQZyNgIEDwtBkA0QAAALQcUNEAAAC0H2DRAAAAtBtggQAAAL" +
        "QcUJEAAACwkAIABBeGoQCQvBCgEKfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIABB" +
        "BGooAgAiAUEHcUEGRgRAAkACfwJAAn8CQAJAAn8CQAJAAkBBjA0oAgAgAEcEQCABQQN2IgchASAA" +
        "IgIgACgCACIDQQRqKAIAIgRBB3FBBUcNBxogAygCCCECIANBDGooAgAiBUUNASAFQQRqKAIAQQdx" +
        "QQVHDQ8gBSACNgIIIARBA3YgB2ohASACDQUMBgsgACgCACIAQQRqKAIAIgJBB3FBBUYEQCAAKAII" +
        "IQEgACgCACEHIABBDGooAgAiA0UNAiADQQRqKAIAQQdxQQVHDRMgAyABNgIIIAENCgwbC0GMDSAA" +
        "NgIADwsgBEEPTQ0SIARBgIAISQ0BQSIhBiAEQQd2DAILIAJBD00NFiACQYCACEkNBUEiIQQgAkEH" +
        "dgwGC0EWQX4gBEH/P0siARshBiAEQQtBAyABG3YLIgFBBHYgASABQT9LIggbIgFBAnYgASABQQ9L" +
        "IgkbIgEgAUEHSyIBdiIKQQYgCkEGSRsgBkEMaiAGIAgbIgZBBmogBiAJGyIGQQNqIAYgARtqQQJ0" +
        "QZALaiIBKAIAIANHDRAgASADNgIAIARBA3YgB2ohASACRQ0BCyACQQRqKAIAQQdxQQVHDQogAkEM" +
        "aiAFNgIACyADCyECIAAgB0EDdCIEaiEDIAAgBGpBBGooAgAiBEEHcUEFRgRAIAAgB0EDdGoiBygC" +
        "CCEAAkACQCAHQQxqKAIAIgcEQCAHQQRqKAIAQQdxQQVHDQ0gByAANgIIIAANAQwCCyAEQQ9NDREC" +
        "fyAEQYCACE8EQEEiIQYgBEEHdgwBC0EWQX4gBEH/P0siBRshBiAEQQtBAyAFG3YLIgVBBHYgBSAF" +
        "QT9LIggbIgVBAnYgBSAFQQ9LIgkbIgUgBUEHSyIFdiIKQQYgCkEGSRsgBkEMaiAGIAgbIgZBBmog" +
        "BiAJGyIGQQNqIAYgBRtqQQJ0QZALaiIFKAIAIANHDRIgBSADNgIAIABFDQELIABBBGooAgBBB3FB" +
        "BUcNDCAAQQxqIAc2AgALIARBA3YiACABaiEBIAMgAEEDdGohAwsgAyACNgIAQYwNKAIAIAJGDQQg" +
        "AUEBTQ0FAn8gAUGAgAFPBEAgAUEEdiEAQSIMAQsgAUEIdiABIAFB/wdLIgMbIQBBFkF+IAMbCyED" +
        "IABBBHYgACAAQT9LIgcbIgBBAnYgACAAQQ9LIgQbIgAgAEEHSyIAdiIFQQYgBUEGSRsgA0EMaiAD" +
        "IAcbIgNBBmogAyAEGyIDQQNqIAMgABtqQQJ0QZALaiIDKAIAIQAgAyACNgIAIAJBBGogAUEDdEEF" +
        "cjYCACACIAA2AgggAARAIABBBGooAgBBB3FBBUcNByAAQQxqIAI2AgALDwtBFkF+IAJB/z9LIgUb" +
        "IQQgAkELQQMgBRt2CyICQQR2IAIgAkE/SyIFGyICQQJ2IAIgAkEPSyIGGyICIAJBB0siAnYiCEEG" +
        "IAhBBkkbIARBDGogBCAFGyIEQQZqIAQgBhsiBEEDaiAEIAIbakECdEGQC2oiAigCACAARw0QIAIg" +
        "ADYCACABRQ0RCyABQQRqKAIAQQdxQQVHDQ0gAUEMaiADNgIAQYwNIAc2AgAPC0GtDhAAAAtB9g0Q" +
        "AAALQbYIEAAAC0HFCRAAAAtBxQkQAAALQcUJEAAAC0HFCRAAAAtBxQkQAAALQcUJEAAAC0G2CBAA" +
        "AAtB3w4QAAALQbYIEAAAC0HfDhAAAAtBxQkQAAALQbYIEAAAC0HfDhAAAAtBjA0gBzYCAAtQAAJA" +
        "IAAgAU0EQAJAIAFB//8DakEQdiAAQf//A2pBEHYiAWsiAARAIABAACIAQX9GDQEgACABRw0DC0EB" +
        "DwtBAA8LQeIIEAAAC0H2CRAAAAsLvwUJAEGACAuUAUFzc2VydGlvbiBgcmVxLT5jb250cm9sLnNp" +
        "emUgPT0gOCcgZmFpbGVkIGF0IGZpYi5jOjU1AEFzc2VydGlvbiBgc2l6ZSA+PSAyJyBmYWlsZWQg" +
        "YXQgbWFsbG9jLmM6OTYAQXNzZXJ0aW9uIGBvbGRfaGVhcCA8PSBuZXdfaGVhcCcgZmFpbGVkIGF0" +
        "IG1lbS5jOjcAQZUJC5gBQXNzZXJ0aW9uIGBpID4gMCAmJiBpIDw9IDkwJyBmYWlsZWQgYXQgZmli" +
        "LmM6NTgAQXNzZXJ0aW9uIGBoZHJfaXNfZnJlZShoKScgZmFpbGVkIGF0IG1hbGxvYy5jOjUxAEFz" +
        "c2VydGlvbiBgZ3Jvd19yZXN1bHQgPT0gb2xkX3BhZ2VzJyBmYWlsZWQgYXQgbWVtLmM6MTQAQa4K" +
        "C1tBc3NlcnRpb24gYCFoYXZlW2krMV0nIGZhaWxlZCBhdCBmaWIuYzo2NgBBc3NlcnRpb24gYGJr" +
        "dHNbYmt0XSA9PSBoJyBmYWlsZWQgYXQgbWFsbG9jLmM6MTU0AEGIDQsDoAcBAEGQDQs0QXNzZXJ0" +
        "aW9uIGBoICE9IGJrdHNbQktUUysxXScgZmFpbGVkIGF0IG1hbGxvYy5jOjE5NQBBxQ0LMEFzc2Vy" +
        "dGlvbiBgcnNpemUgPj0gc2l6ZScgZmFpbGVkIGF0IG1hbGxvYy5jOjE5NgBB9g0LNkFzc2VydGlv" +
        "biBgaCAhPSBia3RzW0JLVFMgKyAxXScgZmFpbGVkIGF0IG1hbGxvYy5jOjE4NQBBrQ4LMUFzc2Vy" +
        "dGlvbiBgaGRyX2lzX2FsbG9jKGgpJyBmYWlsZWQgYXQgbWFsbG9jLmM6NTUAQd8OCzFBc3NlcnRp" +
        "b24gYGJrdHNbYmt0XSA9PSBoJyBmYWlsZWQgYXQgbWFsbG9jLmM6MTQ0"
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
