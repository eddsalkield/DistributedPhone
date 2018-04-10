// Totally not Borgmon.

import * as err from "./err";

export type Scalar = string | number | boolean;

export declare interface Key {
    readonly [k: string]: Scalar;
}

export type Point = [string, Key, Scalar];

export interface TSDB {
    writeError(ts: number, data: err.Data): void;
    write(ts: number, data: Point[]): void;
}

interface Base {
    readonly key: Key;
    readonly parent: Sink | null;
    readonly root: Root | null;
    readonly root_key: Key | null;
}

export interface Sink extends Base {
    readonly children: Set<Metric>;
    readonly direct_children: Set<Child>;

    reportError(e: err.Data): void;
}

export class Root implements Sink {
    public readonly key: Key = {};
    public readonly parent = null;
    public readonly root = this;
    public readonly root_key: Key = {};
    public readonly direct_children = new Set<Metric>();
    public readonly children = new Set<Metric>();
    public readonly children_dirty = new Set<Metric>();
    public readonly tsdb: TSDB;

    constructor(tsdb: TSDB) {
        this.tsdb = tsdb;
    }

    private _dirty: boolean = false;
    public setDirty() {
        if(this._dirty) return;
        this._dirty = true;
        setTimeout(this._changed.bind(this), 0);
    }

    private _changed(): void {
        const now = new Date().getTime() / 1000;
        const cld = Array.from(this.children_dirty);
        this.children_dirty.clear();
        this._dirty = false;

        const data: Array<[string, Key, Scalar]> = [];
        for(const c of cld) {
            if(c.value === undefined) continue;
            data.push([c.name, c.root_key!, c.value]);
            c.written();
        }
        this.tsdb.write(now, data);
    }

    public reportError(e: err.Data): void {
        const now = new Date().getTime() / 1000;
        this.tsdb.writeError(now, e);
    }
}

class Child implements Base {
    public readonly key: Key;

    private _parent: Sink | null;
    private _root: Root | null;
    private _root_key: Key | null;

    constructor(key: Key) {
        this.key = key;
        this._parent = null;
        this._root = null;
        this._root_key = null;
    }

    get parent(): Sink | null {
        return this._parent;
    }

    get root(): Root | null {
        return this._root;
    }

    get root_key(): Key | null {
        return this._root_key;
    }

    public attach(par: Sink | null): this {
        const opar = this._parent;
        if(par === opar) return this;

        if(opar !== null) {
            opar.direct_children.delete(this);
            this.addChildren(opar.children);
            for(let p = opar.parent; p !== null; p = p.parent) {
                this.discardChildren(p.children);
            }
        }
        if(par !== null) {
            par.direct_children.add(this);
            this.addChildren(par.children);
            for(let p = par.parent; p !== null; p = p.parent) {
                this.addChildren(p.children);
            }
        }
        this._parent = par;

        const ort = this._root;
        if(ort !== null) this.discardChildren(ort.children_dirty);

        this.reroot();

        const rt = this._root;
        if(rt !== null) {
            this.addChildren(rt.children_dirty);
            rt.setDirty();
        }
        return this;
    }

    protected addChildren(s: Set<Metric>): void {}
    protected discardChildren(s: Set<Metric>): void {}

    public reroot() {
        const par = this._parent;
        if(par !== null) {
            const rt = par.root;
            if(rt !== null) {
                this._root = rt;
                this._root_key = Object.assign({}, this.key, par.root_key!);
                return;
            }
        }
        this._root = null;
        this._root_key = null;
    }
}

export class Metric<T extends Scalar = Scalar> extends Child {
    public readonly name: string;

    constructor(name: string, key?: Key) {
        super(key || {});
        this.name = name;
    }

    private _value: T | undefined;

    public get value(): T | undefined {
        return this._value;
    }

    public set(v: T): void {
        if(this._value !== v) {
            this._value = v;
            this._touch();
        }
    }

    private _touch(): void {
        const r = this.root;
        if(r === null) return;
        if(r.children_dirty.size === 0) {
            r.setDirty();
        }
        r.children_dirty.add(this);
    }

    public written(): void {}

    protected addChildren(s: Set<Metric>): void {
        s.add(this);
    }

    protected discardChildren(s: Set<Metric>): void {
        s.delete(this);
    }
}

export class Group extends Child implements Sink {
    public readonly children: Set<Metric> = new Set();
    public readonly direct_children: Set<Child> = new Set();

    protected addChildren(s: Set<Metric>): void {
        for(const c of this.children) s.add(c);
    }

    protected discardChildren(s: Set<Metric>): void {
        for(const c of this.children) s.delete(c);
    }

    public reroot(): void {
        super.reroot();
        for(const c of this.direct_children) c.reroot();
    }

    public reportError(e: err.Data): void {
        const rt = this.root;
        if(rt !== null) {
            rt.reportError(Object.assign({}, this.root_key!, e));
        } else {
            const e2: Partial<err.Data> = Object.assign({}, this.key);
            for(let p = this.parent; p !== null; p = p.parent) {
                Object.assign(e2, p.key);
            }
            Object.assign(e2, e);
            console.error(`Unhandled exception: {err.format(e)}`);
        }
    }
}

export class Counter extends Metric<number> {
    constructor(name: string, key?: Key) {
        super(name, key);
        this.reset();
    }

    public reset(): void {
        this.set(0);
    }

    public inc(v?: number): void {
        if(v === undefined) v = 1;
        else if(v <= 0 || v !== v) return;
        this.set(this.value! + v);
    }
}
