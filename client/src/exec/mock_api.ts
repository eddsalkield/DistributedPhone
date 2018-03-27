import Deque from "double-ended-queue";

import * as api from "./api";
import {Stat} from "./stat";

export default class MockAPI implements api.WorkProvider {
    public readonly stat: Stat;

    public readonly blobs: Map<string, ArrayBuffer>;
    public readonly tasks: Deque<api.Task>;
    public readonly results: Map<string, api.TaskResult>;

    private readonly conditions: Array<[() => boolean, () => void]>;

    public req_cnt_blob = 0;
    public req_cnt_tasks = 0;
    public req_cnt_results = 0;
    public task_cnt = 0;
    public task_cnt_ok = 0;
    public task_cnt_error = 0;
    public task_cnt_refused = 0;
    public task_dup_cnt = 0;

    public workers = 8;
    public tasks_pending_min = 100;
    public tasks_finished_max = 1000;
    public send_max_bytes = 16384;
    public save_timeout = 1000;

    constructor(stat: Stat) {
        this.stat = stat;
        this.blobs = new Map();
        this.tasks = new Deque();
        this.results = new Map();
        this.conditions = [];
        this.report();
    }

    public report() {
        this.stat.report("[MockAPI] Available tasks", this.tasks.length);
        this.stat.report("[MockAPI] Finished tasks", this.task_cnt);
        this.stat.report("[MockAPI] Finished tasks [OK]", this.task_cnt_ok);
        this.stat.report("[MockAPI] Finished tasks [error]", this.task_cnt_error);
        this.stat.report("[MockAPI] Finished tasks [refused]", this.task_cnt_refused);
        this.stat.report("[MockAPI] Requests for blobs", this.req_cnt_blob);
        this.stat.report("[MockAPI] Requests for tasks", this.req_cnt_tasks);
        this.stat.report("[MockAPI] Requests with results", this.req_cnt_results);

        const cond = this.conditions;
        let i = 0, j = 0;
        for(; i < cond.length; i += 1) {
            const t = cond[i];
            if(t[0]()) {
                t[1]();
            } else {
                if(i !== j) cond[j] = t;
                j += 1;
            }
        }
        cond.splice(j);
    }

    public addCondition(test: () => boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            this.conditions.push([test, resolve]);
        });
    }

    public getBlob(id: string): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const data = this.blobs.get(id);
            if(data) resolve(data.slice(0));
            else reject(new api.StateError("Unknown blob", {blob_id: id}));
            this.req_cnt_blob += 1;
        });
    }

    public getTasks(): Promise<api.TaskSet> {
        if(this.tasks.isEmpty()) {
            return new Promise((resolve, reject) => {
                setTimeout(() => resolve({
                    tasks: [],
                    blob_info: new Map(),
                }), 100 * Math.random());
            });
        }

        const r = Math.floor(200 * Math.random());
        const ts: api.Task[] = [];
        const bi = new Map<string, api.BlobInfo>();
        while(ts.length < r) {
            const t = this.tasks.dequeue();
            if(!t) break;
            for(const id of [t.program].concat(t.in_blobs)) {
                if(bi.get(id) !== undefined) continue;
                bi.set(id, {
                    size: this.blobs.get(id)!.byteLength,
                });
            }
            ts.push(t);
        }
        this.req_cnt_results += 1;
        this.report();
        return Promise.resolve({
            tasks: ts,
            blob_info: bi,
        });
    }

    public sendTasks(outs: api.TaskResult[]): Promise<void> {
        for(const out of outs) {
            if(this.results.get(out.id) !== undefined) {
                this.task_dup_cnt += 1;
                continue;
            }
            this.results.set(out.id, out);
            this.task_cnt += 1;
            if(out.status === "ok") this.task_cnt_ok += 1;
            else if(out.status === "error") this.task_cnt_error += 1;
            else if(out.status === "refused") this.task_cnt_refused += 1;
            if(out.status === "error") console.log(out.id, out.error);
        }
        this.req_cnt_results += 1;
        this.report();
        return Promise.resolve();
    }
}
