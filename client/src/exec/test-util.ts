import Runner from "./runner";

import * as err from "@/err";
import * as stat from "@/stat";

import MockAPI from "./mock_api";
import {Storage} from "./storage";

export class TestTSDB implements stat.TSDB {
    public rejected: boolean;
    public readonly reject: (_: Error) => void;

    constructor(reject: (_: Error) => void) {
        this.rejected = false;
        this.reject = reject;
    }

    public write(at: number, data: stat.Point[]): void {
        for(const d of data) {
            console.log(d);
        }
    }

    public writeError(at: number, e: err.Data): void {
        if(this.rejected) return;
        this.rejected = true;
        this.reject(err.fromData(e));
    }
}

export function arrBuf(data: number[]): Uint8Array {
    const buf = new Uint8Array(data.length);
    buf.set(data);
    return buf;
}

export function b64Buf(data: string): Uint8Array {
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

export async function asyncSleep(ms: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        self.setTimeout(() => resolve(), ms);
    });
}

export function releaser<T = void>(): [Promise<T>, (value?: T) => void] {
    let release!: (value?: T) => void;
    const pr = new Promise<T>((resolve, reject) => {
        release = resolve;
    });
    return [pr, release!];
}

export function withStat<T>(f: (s: stat.Sink) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const the_tsdb = new TestTSDB(reject);
        const the_stat = new stat.Root(the_tsdb);
        Promise.resolve(the_stat).then(f).then((v) => {
            self.setTimeout(() => {
                if(!the_tsdb.rejected) resolve(v);
            }, 500);
        }, (e) => {
            if(!the_tsdb.rejected) {
                the_tsdb.rejected = true;
                reject(e);
            }
        });
    });
}

export function withRunner<T>(the_api: MockAPI, the_storage: Storage, func: (r: Runner) => Promise<T>): Promise<T> {
    return withStat((the_stat) => Runner.create(the_stat, the_api, the_storage, "test@invalid").then((r) => {
        return Promise.resolve(r).then(func).finally(() => r.stop());
    }));
}

enum CompareKind {
    PRIMITIVE = 0,
    OBJECT = 1,
    ARRAY = 2,
    MAP = 3,
    TYPED_ARRAY = 4,
}

function typename(obj: any) {
    return Object.getPrototypeOf(obj).constructor.name;
}

function compareKind(obj: any) {
    if(typeof obj !== "object") return CompareKind.PRIMITIVE;
    if(obj instanceof Array) return CompareKind.ARRAY;
    if(obj instanceof Map) return CompareKind.MAP;
    if(obj instanceof Uint8Array) return CompareKind.TYPED_ARRAY;
    if(Object.getPrototypeOf(obj) === Object.prototype) return CompareKind.OBJECT;
    throw new Error(`Don't know how to compare ${typename(obj)}`);
}

function diffTypedArray<T>(v1: ArrayLike<T>, v2: ArrayLike<T>): number {
    const l = Math.min(v1.length, v2.length);
    for(let i = 0; i < l; i += 1) {
        if(v1[i] !== v2[i]) return i;
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
    } else if(kind === CompareKind.TYPED_ARRAY) {
        if(!(got instanceof Object.getPrototypeOf(want).constructor)) {
            throw new Error(`got${path} !== want${path}: expected ${typename(want)}, got ${typename(got)}; ${got}`);
        }

        const diff = diffTypedArray(got, want);
        if(diff !== -1) {
            let msg = "";
            if(got.lenth !== want.lenth) {
                msg = `; got size ${got.lenth}, want ${want.lenth}`;
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
                writeLine(err.format(e));
                console.error(e);
            }).then(runner);
        };
        runner();
    });
}
