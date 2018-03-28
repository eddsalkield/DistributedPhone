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

export function withRunner<T>(the_api: MockAPI, the_storage: Storage, func: (r: Runner) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const the_stat = new TestStat(reject);
        Runner.create(the_stat, the_api, the_storage).then((r) => {
            return Promise.resolve(r).then(func).finally(() => r.stop());
        }).then((v) => {
            setTimeout(() => {
                if(!the_stat.rejected) resolve(v);
            }, 100);
        }, (e) => {
            if(!the_stat.rejected) reject(e);
        });
    });
}

enum CompareKind {
    PRIMITIVE = 0,
    OBJECT = 1,
    ARRAY = 2,
    MAP = 3,
}

function compareKind(obj: any) {
    if(typeof obj !== "object") return CompareKind.PRIMITIVE;
    if(obj instanceof Array) return CompareKind.ARRAY;
    if(obj instanceof Map) return CompareKind.MAP;
    return CompareKind.OBJECT;
}

export function compare(got: any, want: any, path: string) {
    if(want["@compare@func"] !== undefined) return want["@compare@func"](got);
    const k1 = compareKind(got), k2 = compareKind(want);
    if(k1 !== k2) {
        throw new Error(`got${path} !== want${path}: different types: ${CompareKind[k1]} !== ${CompareKind[k2]}`);
    }
    if(k1 === CompareKind.PRIMITIVE) {
        if(got !== want) {
            throw new Error(`got${path} !== want${path}: primitive values differ: ${got} !== ${want}`);
        }
    } else if(k1 === CompareKind.OBJECT) {
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
    } else if(k1 === CompareKind.ARRAY) {
        const l1: number = got.length, l2: number = want.length;
        if(l1 !== l2) {
            throw new Error(`got${path} !== want${path}: array lengths differ`);
        }
        for(let i = 0; i < l1; i += 1) {
            compare(got[i], want[i], path + "[" + i + "]");
        }
    } else if(k1 === CompareKind.MAP) {
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
    } else {
        throw new Error("WTF");
    }
}

export function runTests(tests: Array<() => Promise<void>>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let i = 0;
        const runner = () => {
            if(i === tests.length) {
                resolve();
                return;
            }
            const test = tests[i];
            document.write("Running test " + test.name + " ... ");
            i += 1;
            new Promise<void>((res,rej) => res(test())).then(() => {
                document.write("Pass<br/>");
            }, (e) => {
                document.write("Error: " + e.message + "<br/>");
            }).then(runner);
        };
        runner();
    });
}
