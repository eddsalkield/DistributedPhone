export enum Kind {
    UINT = 0,
    NEGATIVE_INT = 1,
    BYTES = 2,
    STRING = 3,
    ARRAY = 4,
    MAP = 5,
    SEMANTIC_TAG = 6,
    SIMPLE = 7,
    FLOAT = 8,
    BREAK = 9,
}

const kinds = [
    "non-negative integer",
    "negative integer",
    "byte string",
    "text string",
    "array",
    "map",
    "semantic tag",
    "simple value",
    "floating-point number",
    "break code",
];

declare const TextEncoder: any;
declare const TextDecoder: any;
declare const console: any;

const TAG_UINT = 0x00;
const TAG_UINT_END = 0x20;
const TAG_NINT = 0x20;
const TAG_NINT_END = 0x40;
const TAG_BYTES = 0x40;
const TAG_BYTES_EXT = 0x5f;
const TAG_BYTES_END = 0x60;
const TAG_STRING = 0x60;
const TAG_STRING_EXT = 0x7f;
const TAG_STRING_END = 0x80;
const TAG_ARRAY = 0x80;
const TAG_ARRAY_EXT = 0x9f;
const TAG_ARRAY_END = 0xa0;
const TAG_MAP = 0xa0;
const TAG_MAP_EXT = 0xbf;
const TAG_MAP_END = 0xc0;
const TAG_SEMANTIC = 0xc0;
const TAG_SEMANTIC_END = 0xe0;
const TAG_SIMPLE = 0xe0;
const TAG_SIMPLE_EXT = 0xe0 + 24;
const TAG_FLOAT16 = 0xe0 + 25;
const TAG_FLOAT32 = 0xe0 + 26;
const TAG_FLOAT64 = 0xe0 + 27;
const TAG_BREAK = 0xff;

export const SIMPLE_FALSE = 20;
export const SIMPLE_TRUE = 21;
export const SIMPLE_NULL = 22;
export const SIMPLE_UNDEFINED = 23;

function isUint(tag: number): boolean {
    return TAG_UINT <= tag && tag < TAG_UINT_END;
}
function isNint(tag: number): boolean {
    return TAG_NINT <= tag && tag < TAG_NINT_END;
}
function isInt(tag: number): boolean {
    return TAG_UINT <= tag && tag < TAG_NINT_END;
}
function isBytes(tag: number): boolean {
    return TAG_BYTES <= tag && tag < TAG_BYTES_END;
}
function isString(tag: number): boolean {
    return TAG_STRING <= tag && tag < TAG_STRING_END;
}
function isArray(tag: number): boolean {
    return TAG_ARRAY <= tag && tag < TAG_ARRAY_END;
}
function isMap(tag: number): boolean {
    return TAG_MAP <= tag && tag < TAG_MAP_END;
}
function isSemanticTag(tag: number): boolean {
    return TAG_SEMANTIC <= tag && tag < TAG_SEMANTIC_END;
}
function isSimple(tag: number): boolean {
    return TAG_SIMPLE <= tag && tag <= TAG_SIMPLE_EXT;
}
function isFloat(tag: number): boolean {
    return tag === TAG_FLOAT16 || tag === TAG_FLOAT32 || tag === TAG_FLOAT64;
}
function isBreak(tag: number): boolean {
    return tag === TAG_BREAK;
}

function kindof(tag: number): Kind {
    if(isUint(tag)) return Kind.UINT;
    if(isNint(tag)) return Kind.NEGATIVE_INT;
    if(isBytes(tag)) return Kind.BYTES;
    if(isString(tag)) return Kind.STRING;
    if(isArray(tag)) return Kind.ARRAY;
    if(isMap(tag)) return Kind.MAP;
    if(isSemanticTag(tag)) return Kind.SEMANTIC_TAG;
    if(isSimple(tag)) return Kind.SIMPLE;
    if(isFloat(tag)) return Kind.FLOAT;
    if(isBreak(tag)) return Kind.BREAK;
    throw new TypeError("Unsupported encoding");
}

const deutf8 = (() => {
    if(typeof TextDecoder !== "undefined") {
        const the_decoder = new TextDecoder("utf-8", {fatal: true});
        return (data: Uint8Array): string => the_decoder.decode(data);
    } else {
        return (data: Uint8Array): string => {
            if(data.every((v) => v < 128)) return String.fromCodePoint(...data);
            throw new TypeError("UTF-8 decoder not available");
        };
    }
})();

const enutf8 = (() => {
    if(typeof TextEncoder !== "undefined") {
        const the_encoder = new TextEncoder();
        return (data: string): Uint8Array => the_encoder.encode(data);
    } else {
        return (data: string): Uint8Array => {
            const l = data.length;
            const res = new Uint8Array(l);
            for(let i = 0; i < l; i += 1) {
                const cc = data.charCodeAt(i);
                if(cc >= 128) throw new TypeError("UTF-8 encoder not available");
                res[i] = cc;
            }
            return res;
        };
    }
})();

const enum StackKind {
    OBJECT = 0,
    ARRAY = 1,
    MAP = 2,
}

const msg_end = [
    "Data already read",
    "End of array",
    "End of map",
];

const msg_more = [
    "Can't end() main object",
    "Array data remaining",
    "Map data remaining",
];

class Stack {
    public readonly par: Stack | null;
    public readonly len: number | undefined;
    public readonly kind: StackKind;
    public index: number;
    public map_mid: boolean = false;

    constructor(par: Stack | null, kind: StackKind, len: number | undefined) {
        this.par = par;
        this.len = len;
        this.kind = kind;
        this.index = 0;
    }

    public canAdvance(): boolean {
        return this.len === undefined || this.index < this.len;
    }

    public advance() {
        console.assert(this.canAdvance());
        if(this.kind === StackKind.MAP) {
            if(!this.map_mid) {
                this.map_mid = true;
                return;
            }
            this.map_mid = false;
        }
        this.index += 1;
    }
}

export class Iterator {
    public readonly at: number;
    public readonly top: Stack;
    public readonly i: number[];

    constructor(at: number, top: Stack, i: number[]) {
        this.at = at;
        this.top = top;
        this.i = i;
    }
}

export class Reader {
    private data: DataView;
    private at: number;
    private top: Stack;

    constructor(data: ArrayBuffer | Uint8Array) {
        if(data instanceof ArrayBuffer) {
            this.data = new DataView(data);
        } else {
            this.data = new DataView(data.buffer, data.byteOffset, data.byteLength);
        }
        this.at = 0;
        this.top = new Stack(null, StackKind.OBJECT, 1);
    }

    private _rTag(): number {
        const tag = this.data.getUint8(this.at);
        this.at += 1;
        return tag;
    }

    private _peekTag(): number {
        return this.data.getUint8(this.at);
    }

    private _skipUint(tag: number): void {
        if(tag < 24) return;
        if(tag === 24) {
            this.at += 1;
        } else if(tag === 25) {
            this.at += 2;
        } else if(tag === 26) {
            this.at += 4;
        } else if(tag === 27) {
            this.at += 8;
        } else {
            throw new TypeError("Unsupported encoding");
        }
    }

    private _rUint(tag: number): number {
        if(tag < 24) return tag;
        if(tag === 24) {
            const v = this.data.getUint8(this.at);
            this.at += 1;
            return v;
        } else if(tag === 25) {
            const v = this.data.getUint16(this.at);
            this.at += 2;
            return v;
        } else if(tag === 26) {
            const v = this.data.getUint32(this.at);
            this.at += 4;
            return v;
        } else if(tag === 27) {
            let v = this.data.getUint32(this.at);
            if(v > 2097152) {
                throw new TypeError("Integer out of JavaScript range");
            }
            v *= 4294967296;
            v += this.data.getUint32(this.at + 4);
            this.at += 8;
            return v;
        } else {
            throw new TypeError("Unsupported encoding");
        }
    }

    private _rDataTag(): number {
        let tag = this._rTag();
        if(tag < TAG_SEMANTIC || tag >= TAG_SEMANTIC_END) return tag;
        this._skipUint(tag - TAG_SEMANTIC);
        tag = this._rTag();
        if(tag < TAG_SEMANTIC || tag >= TAG_SEMANTIC_END) throw new TypeError("Multiple semantic tags");
        return tag;
    }

    private _peekDataTag(): number {
        let tag = this._peekTag();
        if(tag < TAG_SEMANTIC || tag >= TAG_SEMANTIC_END) return tag;
        const at = this.at;
        this.at = at + 1;
        this._skipUint(tag);
        tag = this._peekTag();
        this.at = at;
        if(tag < TAG_SEMANTIC || tag >= TAG_SEMANTIC_END) throw new TypeError("Multiple semantic tags");
        return tag;
    }

    private _rBytes1(tag: number): Uint8Array {
        const len = this._rUint(tag);
        const r = new Uint8Array(this.data.buffer, this.data.byteOffset + this.at, len);
        this.at += len;
        return r;
    }

    private _rBytesv(tag_base: number, tag: number): Uint8Array[] {
        const s: Uint8Array[] = [];
        while(true) {
            const t2 = this.data.getUint8(this.at);
            if(t2 === TAG_BREAK) break;
            if(t2 < tag_base || t2 >= tag_base + 31) throw new TypeError("Invalid encoding");
            const b = this._rBytes1(tag - tag_base);
            if(b.byteLength !== 0) s.push(b);
        }
        return s;
    }

    private _skipBytes(tag_base: number, tag: number): void {
        if(tag !== tag_base + 31) {
            this.at += this._rUint(tag - tag_base);
            return;
        }
        while(true) {
            const t2 = this.data.getUint8(this.at);
            if(t2 === TAG_BREAK) break;
            if(t2 < tag_base || t2 >= tag_base + 31) throw new TypeError("Invalid encoding");
            this.at += this._rUint(tag - tag_base);
        }
    }

    private _unknown(tag: number, expected: string): never {
        const kind = kindof(tag);
        let got: string = kinds[kind];
        if(kind === Kind.SIMPLE) {
            if(tag === TAG_SIMPLE + SIMPLE_TRUE || tag === TAG_SIMPLE + SIMPLE_TRUE) got = "boolean";
            else if(tag === TAG_SIMPLE + SIMPLE_NULL) got = "null";
            else if(tag === TAG_SIMPLE + SIMPLE_UNDEFINED) got = "undefined";
        }
        throw new TypeError(`Unexpected ${got}, wanted ${expected}`);
    }

    private _semanticTag(tag: number): number {
        if(isSemanticTag(tag)) return this._rUint(tag - TAG_SEMANTIC);
        return this._unknown(tag, "semantic tag");
    }

    private _int(tag: number): number {
        if(isUint(tag)) return this._rUint(tag - TAG_UINT);
        if(isNint(tag)) {
            const v = this._rUint(tag - TAG_NINT);
            if(v === 9007199254740992) {
                throw new TypeError("Integer out of JavaScript range");
            }
            return -1 - v;
        }
        return this._unknown(tag, "integer");
    }

    private _uint(tag: number): number {
        if(isUint(tag)) return this._rUint(tag - TAG_UINT);
        return this._unknown(tag, "non-negative integer");
    }

    private _bytes(tag: number): Uint8Array {
        if(!isBytes(tag)) return this._unknown(tag, "byte string");
        if(tag !== TAG_BYTES_EXT) {
            return this._rBytes1(tag - TAG_BYTES);
        }
        const s = this._rBytesv(TAG_BYTES, tag);
        if(s.length === 0) return new Uint8Array();
        if(s.length === 1) return s[0];
        let l = 0;
        for(const b of s) l += b.byteLength;
        const r = new Uint8Array(l);
        let at = 0;
        for(const b of s) {
            r.set(b, at);
            at += b.byteLength;
        }
        console.assert(at === l);
        return r;
    }

    private _string(tag: number): string {
        if(!isString(tag)) return this._unknown(tag, "text string");
        if(tag !== TAG_STRING_EXT) {
            return deutf8(this._rBytes1(tag - TAG_STRING));
        }
        return this._rBytesv(TAG_STRING, tag).map(deutf8).join("");
    }

    private _array(tag: number): number | undefined {
        if(!isArray(tag)) return this._unknown(tag, "array");
        let len: number | undefined;
        if(tag === TAG_ARRAY_EXT) len = undefined;
        else len = this._rUint(tag - TAG_ARRAY);
        this.top = new Stack(this.top, StackKind.ARRAY, len);
        return len;
    }

    private _map(tag: number): number | undefined {
        if(!isMap(tag)) return this._unknown(tag, "map");
        let len: number | undefined;
        if(tag === TAG_MAP_EXT) len = undefined;
        else len = this._rUint(tag - TAG_MAP);
        this.top = new Stack(this.top, StackKind.MAP, len);
        return len;
    }

    private _simple(tag: number): number {
        if(TAG_SIMPLE < tag && tag < TAG_SIMPLE_EXT) return tag - TAG_SIMPLE;
        if(tag === TAG_SIMPLE_EXT) return this._rTag();
        return this._unknown(tag, "simple value");
    }

    private _boolean(tag: number) {
        const simp = this._simple(tag);
        if(simp === SIMPLE_FALSE) return false;
        if(simp === SIMPLE_TRUE) return true;
        return this._unknown(tag, "boolean");
    }

    private _null(tag: number): void {
        const simp = this._simple(tag);
        if(simp === SIMPLE_NULL) return;
        this._unknown(tag, "null");
    }

    private _undefined(tag: number): void {
        const simp = this._simple(tag);
        if(simp === SIMPLE_UNDEFINED) return;
        this._unknown(tag, "undefined");
    }

    private _float(tag: number) {
        let r: number;
        if(tag === TAG_FLOAT16) {
            const w = this.data.getUint16(this.at);
            this.at += 2;

            const exp = (w >> 11) & 31;
            const mantissa = w & 2047;

            if(exp === 31) {
                if(mantissa !== 0) return NaN;
                r = Infinity;
            } else if(exp !== 0) {
                r = (2048 + mantissa) * Math.pow(2, exp - 26);
            } else {
                r = mantissa * Math.pow(2, -25);
            }

            if(w & 32768) r = -r;
        } else if(tag === TAG_FLOAT32) {
            r = this.data.getFloat32(this.at);
            this.at += 4;
        } else if(tag === TAG_FLOAT64) {
            r = this.data.getFloat64(this.at);
            this.at += 8;
        } else {
            return this._unknown(tag, "floating-point number");
        }
        return r;
    }

    private _number(tag: number) {
        if(isInt(tag)) return this._int(tag);
        if(isFloat(tag)) return this._float(tag);
        return this._unknown(tag, "number");
    }

    private _checkMaybeData(): boolean {
        const t = this.top;
        if(t.len !== undefined) {
            return t.index !== t.len;
        }
        if(t.map_mid) return true;
        return this._peekTag() !== TAG_BREAK;
    }

    private _checkData(): void {
        if(!this._checkMaybeData()) {
            throw new TypeError(msg_end[this.top.kind]);
        }
    }

    private _onMaybeData(): boolean {
        if(!this._checkMaybeData()) return false;
        this.top.advance();
        return true;
    }

    private _onData(): void {
        if(!this._onMaybeData()) {
            throw new TypeError(msg_end[this.top.kind]);
        }
    }

    public tell(): Iterator {
        const i: number[] = [];
        for(let t: Stack | null = this.top; t !== null; t = t.par) {
            if(t.kind === StackKind.MAP) i.push(2 * t.index + (t.map_mid ? 1 : 0));
            else i.push(t.index);
        }
        return new Iterator(this.at, this.top, i);
    }

    public seek(it: Iterator) {
        this.at = it.at;
        let t: Stack | null = it.top;
        this.top = t!;
        for(const i of it.i) {
            if(t!.kind === StackKind.MAP) {
                t!.index = Math.floor(i / 2);
                t!.map_mid = (i % 2 === 1);
            } else {
                t!.index = i;
            }
            t = t!.par;
        }
        console.assert(t === null);
    }

    public hasNext(): boolean {
        return this._checkMaybeData();
    }

    public get index(): number {
        return this.top.index;
    }

    public get length(): number | undefined {
        return this.top.len;
    }

    public end(): void {
        const t = this.top;
        if(
            t.kind !== StackKind.OBJECT &&
            (t.len !== undefined) ? (t.index === t.len) : (this._rTag() === TAG_BREAK)
        ) {
            this.top = t.par!;
            return;
        }
        throw new TypeError(msg_more[t.kind]);
    }

    public peekDataKind(): Kind {
        this._checkData();
        return kindof(this._peekDataTag());
    }

    public hasSemanticTag(): boolean {
        return isSemanticTag(this._peekTag());
    }

    public isInt(): boolean {
        this._checkData();
        return isInt(this._peekDataTag());
    }

    public isUint(): boolean {
        this._checkData();
        return isUint(this._peekDataTag());
    }

    public isBytes(): boolean {
        this._checkData();
        return isBytes(this._peekDataTag());
    }

    public isString(): boolean {
        this._checkData();
        return isString(this._peekDataTag());
    }

    public isArray(): boolean {
        this._checkData();
        return isArray(this._peekDataTag());
    }

    public isMap(): boolean {
        this._checkData();
        return isMap(this._peekDataTag());
    }

    public isSimple(): boolean {
        this._checkData();
        return isSimple(this._peekDataTag());
    }

    public isFloat(): boolean {
        this._checkData();
        return isFloat(this._peekDataTag());
    }

    public isNumber(): boolean {
        this._checkData();
        const t = this._peekDataTag();
        return isInt(t) || isFloat(t);
    }

    public uint(): number {
        this._onData();
        return this._uint(this._rDataTag());
    }

    public int(): number {
        this._onData();
        return this._int(this._rDataTag());
    }

    public bytes(): Uint8Array {
        this._onData();
        return this._bytes(this._rDataTag());
    }

    public string(): string {
        this._onData();
        return this._string(this._rDataTag());
    }

    public array(): number | undefined {
        this._onData();
        return this._array(this._rDataTag());
    }

    public map(): number | undefined {
        this._onData();
        return this._map(this._rDataTag());
    }

    public simple(): number {
        this._onData();
        return this._simple(this._rDataTag());
    }

    public boolean(): boolean {
        this._onData();
        return this._boolean(this._rDataTag());
    }

    public null(): void {
        this._onData();
        this._null(this._rDataTag());
    }

    public undefined(): void {
        this._onData();
        this._undefined(this._rDataTag());
    }

    public number(): number {
        this._onData();
        return this._number(this._rDataTag());
    }

    public skip(): void {
        this._onData();
        const tag = this._rDataTag();
        if(isUint(tag)) this._skipUint(tag - TAG_UINT);
        else if(isNint(tag)) this._skipUint(tag - TAG_NINT);
        else if(isBytes(tag)) this._skipBytes(TAG_BYTES, tag);
        else if(isString(tag)) this._skipBytes(TAG_STRING, tag);
        else if(isArray(tag)) {
            this._array(tag);
            while(this.hasNext()) this.skip();
            this.end();
        } else if(isMap(tag)) {
            this._map(tag);
            while(this.hasNext()) {
                this.skip();
                this.skip();
            }
            this.end();
        } else if(isSimple(tag)) {
            if(tag === TAG_SIMPLE_EXT) this.at += 1;
        } else if(isFloat(tag)) {
            if(tag === TAG_FLOAT16) this.at += 2;
            else if(tag === TAG_FLOAT32) this.at += 4;
            else if(tag === TAG_FLOAT64) this.at += 8;
            else console.assert(false);
        } else {
            this._unknown(tag, "any value");
        }
    }

    public semanticTag(): number | undefined {
        this._checkData();
        const tag = this._peekTag();
        if(!isSemanticTag(tag)) return undefined;
        this.at += 1;
        return this._semanticTag(tag);
    }

    public maybeUint(): null | number {
        if(!this._onMaybeData()) return null;
        return this._uint(this._rDataTag());
    }

    public maybeInt(): null | number {
        if(!this._onMaybeData()) return null;
        return this._int(this._rDataTag());
    }

    public maybeBytes(): null | Uint8Array {
        if(!this._onMaybeData()) return null;
        return this._bytes(this._rDataTag());
    }

    public maybeString(): null | string {
        if(!this._onMaybeData()) return null;
        return this._string(this._rDataTag());
    }

    public maybeArray(): null | number | undefined {
        if(!this._onMaybeData()) return null;
        return this._array(this._rDataTag());
    }

    public maybeMap(): null | number | undefined {
        if(!this._onMaybeData()) return null;
        return this._map(this._rDataTag());
    }

    public maybeSimple(): null | number {
        if(!this._onMaybeData()) return null;
        return this._simple(this._rDataTag());
    }

    public maybeBoolean(): null | boolean {
        if(!this._onMaybeData()) return null;
        return this._boolean(this._rDataTag());
    }

    public maybeNull(): null | true {
        if(!this._onMaybeData()) return null;
        this._null(this._rDataTag());
        return true;
    }

    public maybeUndefined(): null | true {
        if(!this._onMaybeData()) return null;
        this._undefined(this._rDataTag());
        return true;
    }

    public maybeNumber(): null | number {
        if(!this._onMaybeData()) return null;
        return this._number(this._rDataTag());
    }

    public maybeSemanticTag(): null | number | undefined {
        if(!this._onMaybeData()) return null;
        const tag = this._peekTag();
        if(!isSemanticTag(tag)) return undefined;
        this.at += 1;
        return this._semanticTag(tag);
    }
}

export class Writer {
    private readonly max_length: number | undefined;
    private top: Stack | null;
    private buf: ArrayBuffer;
    private data: DataView;
    private at: number;

    constructor(max_length?: number) {
        this.max_length = max_length;
        this.top = new Stack(null, StackKind.OBJECT, 1);

        this.buf = new ArrayBuffer(256);
        this.data = new DataView(this.buf);
        this.at = 0;
    }

    private _reserve(l: number) {
        const bl = this.buf.byteLength;
        l += this.at;
        if(l > bl) {
            if(this.max_length !== undefined && l > this.max_length) {
                throw new TypeError("Size limit exceeded");
            }
            const t = bl + (bl >>> 2);
            if(t > l) l = t;
            if(this.max_length !== undefined && l > this.max_length) {
                l = this.max_length;
            }
            const buf2 = new ArrayBuffer(l);
            new Uint8Array(buf2, 0, bl).set(new Uint8Array(this.buf));
            this.buf = buf2;
            this.data = new DataView(buf2);
        }
    }

    private _uint(tag_base: number, val: number) {
        if(val < 0 || val !== Math.floor(val)) {
            throw new TypeError("Cannot store number");
        } else if(val < 24) {
            this._reserve(1);
            this.data.setUint8(this.at, tag_base + val);
            this.at += 1;
        } else if(val < 256) {
            this._reserve(2);
            this.data.setUint8(this.at, tag_base + 24);
            this.data.setUint8(this.at + 1, val);
            this.at += 2;
        } else if(val < 65536) {
            this._reserve(3);
            this.data.setUint8(this.at, tag_base + 25);
            this.data.setUint16(this.at + 1, val);
            this.at += 3;
        } else if(val < 4294967296) {
            this._reserve(5);
            this.data.setUint8(this.at, tag_base + 26);
            this.data.setUint32(this.at + 1, val);
            this.at += 5;
        } else if(val < 18446744073709551616) {
            this._reserve(9);
            this.data.setUint8(this.at, tag_base + 27);
            this.data.setUint32(this.at + 1, val / 4294967296);
            this.data.setUint32(this.at + 5, val % 4294967296);
            this.at += 9;
        } else {
            throw new TypeError("Cannot store number");
        }
    }

    private _indef(tag_base: number) {
        this._reserve(1);
        this.data.setUint8(this.at, tag_base + 31);
        this.at += 1;
    }

    private _bytes(tag_base: number, val: Uint8Array) {
        const l = val.length;
        this._uint(tag_base, l);
        this._reserve(l);
        new Uint8Array(this.buf, this.at, l).set(val);
        this.at += l;
    }

    private _simple(val: number) {
        if(val < 0 || val !== Math.floor(val) || val >= 256 || (val >= 24 && val < 32)) {
            throw new TypeError("Invalid simple value");
        }
        if(val < 24) {
            this._reserve(1);
            this.data.setUint8(this.at, TAG_SIMPLE + val);
            this.at += 1;
        } else {
            this._reserve(2);
            this.data.setUint8(this.at, TAG_SIMPLE_EXT);
            this.data.setUint8(this.at + 1, val);
            this.at += 2;
        }
    }

    private _onData(): void {
        const t = this.top;
        if(t === null) throw new TypeError("done() already called");
        if(!t.canAdvance()) {
            throw new TypeError(msg_end[t.kind]);
        }
        t.advance();
    }

    private _onSemanticTag(): void {
        const t = this.top;
        if(t === null) throw new TypeError("done() already called");
        if(!t.canAdvance()) {
            throw new TypeError(msg_end[t.kind]);
        }
    }

    public end(): void {
        const t = this.top;
        if(t === null) throw new TypeError("done() already called");
        if(t.kind === StackKind.OBJECT) {
            throw new TypeError(msg_more[t.kind]);
            // pass
        } else if(t.len !== undefined) {
            if(t.index !== t.len) {
                throw new TypeError(msg_more[t.kind]);
            }
        } else {
            if(t.map_mid) throw new TypeError(msg_more[t.kind]);
            this._reserve(1);
            this.data.setUint8(this.at, TAG_BREAK);
            this.at += 1;
        }

        this.top = t.par!;
    }

    public uint(val: number) {
        this._onData();
        this._uint(TAG_UINT, val);
    }

    public int(val: number) {
        this._onData();
        if(val < 0) this._uint(TAG_NINT, 1 - val);
        else this._uint(TAG_UINT, val);
    }

    public bytes(val: Uint8Array) {
        this._onData();
        this._bytes(TAG_BYTES, val);
    }

    public string(val: string) {
        this._onData();
        this._bytes(TAG_STRING, enutf8(val));
    }

    public array(len?: number) {
        this._onData();
        if(len === undefined) this._indef(TAG_ARRAY);
        else this._uint(TAG_ARRAY, len);
        this.top = new Stack(this.top, StackKind.ARRAY, len);
    }

    public map(len?: number) {
        this._onData();
        if(len === undefined) this._indef(TAG_MAP);
        else this._uint(TAG_MAP, len);
        this.top = new Stack(this.top, StackKind.MAP, len);
    }

    public semanticTag(val: number) {
        this._onSemanticTag();
        this._uint(TAG_SEMANTIC, val);
    }

    public boolean(val: boolean) {
        this._onData();
        this._simple(val ? SIMPLE_TRUE : SIMPLE_FALSE);
    }

    public null() {
        this._onData();
        this._simple(SIMPLE_NULL);
    }

    public undefined() {
        this._onData();
        this._simple(SIMPLE_UNDEFINED);
    }

    public float(val: number) {
        if(val !== val) {
            this._reserve(3);
            this.data.setUint8(this.at, TAG_FLOAT16);
            this.data.setUint16(this.at + 1, 0x7e00);
            this.at += 3;
        } else if(val === Infinity) {
            this._reserve(3);
            this.data.setUint8(this.at, TAG_FLOAT16);
            this.data.setUint16(this.at + 1, 0x7c00);
            this.at += 3;
        } else if(val === -Infinity) {
            this._reserve(3);
            this.data.setUint8(this.at, TAG_FLOAT16);
            this.data.setUint16(this.at + 1, 0xfc00);
            this.at += 3;
        } else if(val === 0) {
            this._reserve(3);
            this.data.setUint8(this.at, TAG_FLOAT16);
            if(1/val > 0) {
                this.data.setUint16(this.at + 1, 0);
            } else {
                this.data.setUint16(this.at + 1, 0x8000);
            }
        } else if(val === Math.fround(val)) {
            this._reserve(5);
            this.data.setUint8(this.at, TAG_FLOAT32);
            this.data.setFloat32(this.at + 1, val);
            this.at += 5;
        } else {
            this._reserve(9);
            this.data.setUint8(this.at, TAG_FLOAT64);
            this.data.setFloat64(this.at + 1, val);
            this.at += 9;
        }
    }

    public number(val: number) {
        if(Math.abs(val) <= 9007199254740992) this.int(val);
        else this.float(val);
    }

    public done(): Uint8Array {
        const t = this.top;
        if(t === null) throw new TypeError("done() already called");
        if(t.kind !== StackKind.OBJECT) throw new TypeError("Unclosed container");
        if(t.index !== 1) throw new TypeError("Nothing written");
        this.top = null;
        return new Uint8Array(this.buf, 0, this.at);
    }
}
