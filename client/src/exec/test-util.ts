import Runner from "./runner";

import * as api from "./api";
import MockAPI from "./mock_api";
import {Stat} from "./stat";
import {Storage} from "./storage";

export class TestStat implements Stat {
    public rejected: boolean;
    public readonly reject: (_: Error) => void;

    constructor(reject: (_: Error) => void) {
        this.rejected = false;
        this.reject = reject;
    }

    public report(key: string, value: string | number | null): void {}

    public reportError(e: api.ErrorData): void {
        if(this.rejected) return;
        this.rejected = true;
        this.reject(api.BaseError.fromData(e));
    }
}

export function arrBuf(data: number[]): ArrayBuffer {
    const buf = new ArrayBuffer(data.length);
    new Uint8Array(buf).set(data);
    return buf;
}

export function b64Buf(data: string): ArrayBuffer {
    return strBuf(self.atob(data));
}

/* ISO 8859-1 encoder */
export function strBuf(data: string) {
    const arr: number[] = [];
    for(let i = 0; i < data.length; i += 1) {
        arr.push(data.charCodeAt(i));
    }
    return arrBuf(arr);
}

export function writeText(text: string) {
    self.document.body.appendChild(self.document.createTextNode(text));
}
export function writeLine(text: string) {
    self.document.body.appendChild(self.document.createTextNode(text));
    self.document.body.appendChild(self.document.createElement("br"));
}

export function withStat<T>(f: (s: Stat) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const the_stat = new TestStat(reject);
        Promise.resolve(the_stat).then(f).then((v) => {
            setTimeout(() => {
                if(!the_stat.rejected) resolve(v);
            }, 500);
        }, (e) => {
            if(!the_stat.rejected) {
                the_stat.rejected = true;
                reject(e);
            }
        });
    });
}

export function withRunner<T>(the_api: MockAPI, the_storage: Storage, func: (r: Runner) => Promise<T>): Promise<T> {
    return withStat((the_stat) => Runner.create(the_stat, the_api, the_storage).then((r) => {
        return Promise.resolve(r).then(func).finally(() => r.stop());
    }));
}

enum CompareKind {
    PRIMITIVE = 0,
    OBJECT = 1,
    ARRAY = 2,
    MAP = 3,
    ARRAY_BUFFER = 4,
}

function typename(obj: any) {
    return Object.getPrototypeOf(obj).constructor.name;
}

function compareKind(obj: any) {
    if(typeof obj !== "object") return CompareKind.PRIMITIVE;
    if(obj instanceof Array) return CompareKind.ARRAY;
    if(obj instanceof Map) return CompareKind.MAP;
    if(obj instanceof ArrayBuffer) return CompareKind.ARRAY_BUFFER;
    if(Object.getPrototypeOf(obj) === Object.prototype) return CompareKind.OBJECT;
    throw new Error(`Don't know how to compare ${typename(obj)}`);
}

function diffArrayBuffer(a1: ArrayBuffer, a2: ArrayBuffer): number {
    const v1 = new Uint8Array(a1), v2 = new Uint8Array(a2);
    const l = Math.min(v1.length, v2.length);
    for(let i = 0; i < l; i += 1) {
        if(v1[i] !== v2[i]) return l;
    }
    if(v1.length !== v2.length) return l;
    return -1;
}

export function compare(got: any, want: any, path: string) {
    if(want["@compare@func"] !== undefined) return want["@compare@func"](got);
    const kind = compareKind(want);
    if(kind === CompareKind.PRIMITIVE) {
        if(got !== want) {
            throw new Error(`got${path} !== want${path}: primitive values differ: ${got} !== ${want}`);
        }
    } else if(kind === CompareKind.OBJECT) {
        if(Object.getPrototypeOf(got) !== Object.prototype) {
            throw new Error(`got${path} !== want${path}: expected object, got ${typename(got)}`);
        }

        const k_got = Object.keys(got), k_want = Object.keys(want);

        let ignore = (k: string, v?: any) => v === undefined;
        const i = k_want.indexOf("@compare@ignore");
        if(i !== -1) {
            k_want.splice(i, 1);
            const ign = want["@compare@ignore"];
            if(typeof ign === "boolean") ignore = (k: string, v?: any) => ign;
            else if(ign instanceof Array) ignore = (k: string, v?: any) => ign.indexOf(k) === -1;
            else if(ign instanceof Function) ignore = ign;
            else throw new TypeError("Unknown @compare@ignore type");
        }

        for(const p of k_want) {
            if(k_got.indexOf(p) === -1) {
                throw new Error(`got${path} !== want${path}: missing property ${p}`);
            }
        }

        for(const p of k_got) {
            if(want[p] === undefined) {
                if(!ignore(p, got[p])) {
                    throw new Error(`got${path} !== want${path}: additional property ${p}`);
                }
            } else {
                compare(got[p], want[p], path + "." + p);
            }
        }
    } else if(kind === CompareKind.ARRAY) {
        if(!(got instanceof Array)) {
            throw new Error(`got${path} !== want${path}: expected array, got ${typename(got)}`);
        }

        const l1: number = got.length, l2: number = want.length;
        if(l1 !== l2) {
            throw new Error(`got${path} !== want${path}: array lengths differ`);
        }

        for(let i = 0; i < l1; i += 1) {
            compare(got[i], want[i], path + "[" + i + "]");
        }
    } else if(kind === CompareKind.MAP) {
        if(!(got instanceof Map)) {
            throw new Error(`got${path} !== want${path}: expected map, got ${typename(got)}`);
        }

        const k_got = Array.from(got.keys()), k_want = Array.from(want.keys());

        for(const p of k_want) {
            if(k_got.indexOf(p) === -1) {
                throw new Error(`got${path} !== want${path}: missing element ${p}`);
            }
        }

        for(const p of k_got) {
            if(k_want.indexOf(p) === -1) {
                throw new Error(`got${path} !== want${path}: additional member ${p}`);
            } else {
                compare(got.get(p), want.get(p), path + "[" + JSON.stringify(p) + "]");
            }
        }
    } else if(kind === CompareKind.ARRAY_BUFFER) {
        if(!(got instanceof ArrayBuffer)) {
            throw new Error(`got${path} !== want${path}: expected ArrayBuffer, got ${typename(got)}; ${got}`);
        }

        const diff = diffArrayBuffer(got, want);
        if(diff !== -1) {
            let msg = "";
            if(got.byteLength !== want.byteLength) {
                msg = `; got size ${got.byteLength}, want ${want.byteLength}`;
            }
            throw new Error(`got${path} !== want${path}: difference at byte ${diff}${msg}`);
        }
    } else {
        throw new Error("WTF");
    }
}

export function runTests(tests: Array<() => Promise<void>>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let i = 0;
        const runner = () => {
            if(i === tests.length) {
                writeLine("Done");
                resolve();
                return;
            }
            const test = tests[i];
            writeText("Running test " + test.name + " ... ");
            i += 1;
            new Promise<void>((res,rej) => res(test())).then(() => {
                writeLine("Pass");
            }, (e) => {
                writeLine("Error: " + e.message);
            }).then(runner);
        };
        runner();
    });
}
