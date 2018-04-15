import * as cbor from "@/cbor";

import * as api from "./api";
import {Ref} from "./storage";

export interface TaskData {
    id: string;
    project: string;
    program: Ref;

    in_control: ArrayBuffer;
    in_blobs: Ref[];

    out_status?: string;
    out_control?: ArrayBuffer;
    out_data?: Ref[];
    out_error?: api.ErrorData;
}

export interface RunnerData {
    tasks: TaskData[];
}

function copyBuf(d: Uint8Array): ArrayBuffer {
    const r = new ArrayBuffer(d.length);
    new Uint8Array(r).set(d);
    return r;
}

export function loadState(data: ArrayBuffer): RunnerData {
    const d: Partial<RunnerData> = {};
    const r = new cbor.Reader(data);

    r.map();
    while(true) {
        const key = r.maybeString();
        if(key === null) break;

        if(key === "tasks") d.tasks = readArray(r, readTaskData);
        else r.skip();
    }
    r.end();

    if(d.tasks === undefined) throw new TypeError("Missing RunnerData.tasks");

    return d as RunnerData;
}

function readArray<T>(r: cbor.Reader, f: (r: cbor.Reader) => T): T[] {
    const l: T[] = [];
    r.array();
    while(r.hasNext) {
        l.push(f(r));
    }
    r.end();
    return l;
}

function readRef(r: cbor.Reader): Ref {
    r.array();
    const id = r.string();
    const size = r.uint();
    r.end();
    return {id: id, size: size};
}

function readError(r: cbor.Reader): api.ErrorData {
    const d: any = {};
    r.map();
    while(true) {
        const k = r.maybeString();
        if(k === null) break;

        let v: string | number | boolean | api.ErrorData;
        if(r.isString()) v = r.string();
        else if(r.isNumber()) v = r.number();
        else if(r.isSimple()) v = r.boolean();
        else v = readError(r);
        d[k] = v;
    }
    r.end();

    if(typeof d["kind"] !== "string" || typeof d["message"] !== "string") throw new TypeError("Invalid error");

    return d;
}

function readTaskData(r: cbor.Reader): TaskData {
    const d: Partial<TaskData> = {};

    r.map();
    while(true) {
        const key = r.maybeString();
        if(key === null) break;

        if(key === "id") d.id = r.string();
        else if(key === "project") d.project = r.string();
        else if(key === "program") d.program = readRef(r);
        else if(key === "in_control") d.in_control = copyBuf(r.bytes());
        else if(key === "in_blobs") d.in_blobs = readArray(r, readRef);
        else if(key === "out_status") d.out_status = r.string();
        else if(key === "out_control") d.out_control = copyBuf(r.bytes());
        else if(key === "out_data") d.out_data = readArray(r, readRef);
        else if(key === "out_error") d.out_error = readError(r);
        else r.skip();
    }
    r.end();

    if(
        d.id === undefined || d.project === undefined || d.program === undefined ||
        d.in_control === undefined || d.in_blobs === undefined
    ) throw new TypeError("Invalid task");

    return d as TaskData;
}

function writeArray<T>(w: cbor.Writer, f: (w: cbor.Writer, d: T) => void, d: T[]): void {
    w.array(d.length);
    for(const v of d) f(w, v);
    w.end();
}

function writeRef(w: cbor.Writer, d: Ref) {
    w.array(2);
    w.string(d.id);
    w.uint(d.size);
    w.end();
}

function writeError(w: cbor.Writer, d: api.ErrorData): void {
    const ks = Object.keys(d);
    w.map(ks.length);
    for(const k of ks) {
        w.string(k);
        const v = d[k];
        if(typeof v === "string") w.string(v);
        else if(typeof v === "number") w.number(v);
        else if(typeof v === "boolean") w.boolean(v);
        else writeError(w, v);
    }
    w.end();
}

function writeTaskData(w: cbor.Writer, d: TaskData): void {
    w.map();
    w.string("id"); w.string(d.id);
    w.string("project"); w.string(d.project);
    w.string("program"); writeRef(w, d.program);
    w.string("in_control"); w.bytes(new Uint8Array(d.in_control));
    w.string("in_blobs"); writeArray(w, writeRef, d.in_blobs);
    if(d.out_status !== undefined) {
        w.string("out_status");
        w.string(d.out_status);
    }
    if(d.out_control !== undefined) {
        w.string("out_control");
        w.bytes(new Uint8Array(d.out_control));
    }
    if(d.out_data !== undefined) {
        w.string("out_data");
        writeArray(w, writeRef, d.out_data);
    }
    if(d.out_error !== undefined) {
        w.string("out_error");
        writeError(w, d.out_error);
    }
    w.end();
}

export function dumpState(d: RunnerData): Uint8Array {
    const w = new cbor.Writer();
    w.map(1);
    w.string("tasks");
    writeArray(w, writeTaskData, d.tasks);
    w.end();
    return w.done();
}
