import Deque from "double-ended-queue";

import * as err from "@/err";
import * as stat from "@/stat";

import * as api from "./api";

export default class MockAPI implements api.WorkProvider {
    public readonly req_cnt_blob = new stat.Counter(
        "MockAPI/requests", {"type": "getBlob"}
    ).attach(this.st);
    public readonly req_cnt_tasks = new stat.Counter(
        "MockAPI/requests", {"type": "requestTasks"}
    ).attach(this.st);
    public readonly req_cnt_results = new stat.Counter(
        "MockAPI/requests", {"type": "sendResults"}
    ).attach(this.st);
    public readonly task_cnt_ok = new stat.Counter(
        "MockAPI/results", {"status": "ok"}
    ).attach(this.st);
    public readonly task_cnt_error = new stat.Counter(
        "MockAPI/results", {"status": "error"}
    ).attach(this.st);
    public readonly task_cnt_refused = new stat.Counter(
        "MockAPI/results", {"status": "refused"}
    ).attach(this.st);
    public readonly task_dup_cnt = new stat.Counter(
        "MockAPI/results_dup"
    ).attach(this.st);

    public readonly blobs = new Map<string, Uint8Array>();
    public readonly tasks = new Deque<api.Task>();
    public readonly results = new Map<string, api.TaskResult>();

    private readonly conditions: Array<[() => boolean, () => void]> = [];

    public tasks_pending_min = 100;
    public tasks_finished_max = 1000;
    public send_max_bytes = 16384;
    public save_timeout = 1000;
    public cache_max = 1.0e6;

    constructor(
        public readonly st: stat.Sink | null
    ) {}

    get total_task_cnt(): number {
        return this.task_cnt_ok.value! + this.task_cnt_error.value! + this.task_cnt_refused.value!;
    }

    public blob(id: string): api.BlobRef {
        return {id: id, size: this.blobs.get(id)!.byteLength};
    }

    public report() {
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

    public getBlob(id: string, expected_size: number): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            const data = this.blobs.get(id);
            if(data) resolve(data.slice(0));
            else reject(new err.State("Unknown blob", {blob_id: id}));
            this.req_cnt_blob.inc();
        });
    }

    public getTasks(): Promise<api.TaskSet> {
        if(this.tasks.isEmpty()) {
            return new Promise((resolve, reject) => {
                self.setTimeout(() => resolve({
                    tasks: [],
                }), 500 * Math.random());
            });
        }

        const r = Math.floor(200 * Math.random());
        const ts: api.Task[] = [];
        while(ts.length < r) {
            const t = this.tasks.dequeue();
            if(!t) break;
            ts.push(t);
        }
        this.req_cnt_results.inc();
        this.report();
        return Promise.resolve({
            tasks: ts,
        });
    }

    public sendTasks(outs: api.TaskResult[]): Promise<void> {
        for(const out of outs) {
            if(this.results.get(out.id) !== undefined) {
                this.task_dup_cnt.inc();
                continue;
            }
            this.results.set(out.id, out);

            console.log(out);

            if(out.status === "ok") this.task_cnt_ok.inc();
            else if(out.status === "refused") this.task_cnt_refused.inc();
            else this.task_cnt_error.inc();
        }
        this.req_cnt_results.inc();
        this.report();
        return Promise.resolve();
    }
}
