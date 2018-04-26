import * as cbor from "@/cbor";
import * as cbut from "@/cbor-util";

import * as api from "./api";
import {Ref} from "./storage";

export interface TaskData {
    id: string;
    project: string;
    program: Ref;

    in_control: ArrayBuffer;
    in_blobs: Ref[];

    out_status?: string;
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

        if(key === "tasks") d.tasks = cbut.readArray(r, readTaskData);
        else r.skip();
    }
    r.end();

    if(d.tasks === undefined) throw new TypeError("Missing RunnerData.tasks");

    return d as RunnerData;
}

function readRef(r: cbor.Reader): Ref {
    r.array();
    const id = r.string();
    const size = r.uint();
    r.end();
    return {id: id, size: size};
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
        else if(key === "in_blobs") d.in_blobs = cbut.readArray(r, readRef);
        else if(key === "out_status") d.out_status = r.string();
        else if(key === "out_data") d.out_data = cbut.readArray(r, readRef);
        else if(key === "out_error") d.out_error = cbut.readError(r);
        else r.skip();
    }
    r.end();

    if(
        d.id === undefined || d.project === undefined || d.program === undefined ||
        d.in_control === undefined || d.in_blobs === undefined
    ) throw new TypeError("Invalid task");

    return d as TaskData;
}

function writeRef(w: cbor.Writer, d: Ref) {
    w.array(2);
    w.string(d.id);
    w.uint(d.size);
    w.end();
}

function writeTaskData(w: cbor.Writer, d: TaskData): void {
    w.map();
    w.string("id"); w.string(d.id);
    w.string("project"); w.string(d.project);
    w.string("program"); writeRef(w, d.program);
    w.string("in_control"); w.bytes(new Uint8Array(d.in_control));
    w.string("in_blobs"); cbut.writeArray(w, writeRef, d.in_blobs);
    if(d.out_status !== undefined) {
        w.string("out_status");
        w.string(d.out_status);
    }
    if(d.out_data !== undefined) {
        w.string("out_data");
        cbut.writeArray(w, writeRef, d.out_data);
    }
    if(d.out_error !== undefined) {
        w.string("out_error");
        cbut.writeError(w, d.out_error);
    }
    w.end();
}

export function dumpState(d: RunnerData): Uint8Array {
    const w = new cbor.Writer();
    w.map(1);
    w.string("tasks");
    cbut.writeArray(w, writeTaskData, d.tasks);
    w.end();
    return w.done();
}
