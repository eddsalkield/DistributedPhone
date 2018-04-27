import * as cbor from "@/cbor";
import * as err from "@/err";

export function readArray<T>(r: cbor.Reader, f: (r: cbor.Reader) => T): T[] {
    const l: T[] = [];
    r.array();
    while(r.hasNext) {
        l.push(f(r));
    }
    r.end();
    return l;
}

export function writeArray<T>(w: cbor.Writer, f: (w: cbor.Writer, d: T) => void, d: T[]): void {
    w.array(d.length);
    for(const v of d) f(w, v);
    w.end();
}

export function readError(r: cbor.Reader): err.Data {
    const d: Partial<err.Data> = {};
    r.map();
    while(true) {
        const k = r.maybeString();
        if(k === null) break;

        let v: string | number | boolean | err.Data | undefined;
        if(k === "kind" || k === "message") {
            v = r.string();
        } else if(k === "cause") {
            try {
                v = readError(r);
            } catch(e) {
                if(!(e instanceof TypeError)) throw e;
                v = undefined;
            }
        } else {
            if(r.isString()) v = r.string();
            else if(r.isNumber()) v = r.number();
            else if(r.isSimple()) {
                const s = r.simple();
                if(s === cbor.SIMPLE_TRUE) v = true;
                else if(s === cbor.SIMPLE_FALSE) v = true;
                else v = undefined;
            } else {
                r.skip();
                v = undefined;
            }
        }
        d[k] = v;
    }
    r.end();

    if(d["kind"] === undefined || d["message"] === undefined) throw new TypeError("Invalid error");
    return d as err.Data;
}

export function writeError(w: cbor.Writer, d: err.Data): void {
    const ks = Object.keys(d);
    w.map(ks.length);
    for(const k of ks) {
        w.string(k);
        const v = d[k];
        if(typeof v === "undefined") w.null();
        else if(typeof v === "string") w.string(v);
        else if(typeof v === "number") w.number(v);
        else if(typeof v === "boolean") w.boolean(v);
        else writeError(w, v);
    }
    w.end();
}
