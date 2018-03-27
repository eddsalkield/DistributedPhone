import Deque from "double-ended-queue";

import * as api from "./api";
import {BlobRepo} from "./repo";
import {Stat} from "./stat";
import {Ref, Storage} from "./storage";
import WorkDispatcher from "./work-dispatcher";
import * as workapi from "./workapi";

import * as rs from "./runner-state";

// @ts-ignore
import worker_text from "raw-loader!Dist/worker.js";

enum TaskStatus {
    OK = 0,
    ERROR = 1,
    REFUSED = 2,
}

class Task {
    public readonly id: string;
    public readonly project: string;
    public readonly program: Ref;

    public in_control: ArrayBuffer;
    public in_blobs: Ref[];

    public out_status?: TaskStatus;
    public out_control?: ArrayBuffer;
    public out_data?: Ref[];
    public out_error?: api.ErrorData;

    constructor(
        id: string, project: string, program: Ref,
        in_control: ArrayBuffer, in_blobs: Ref[],
    ) {
        this.id = id;
        this.project = project;
        this.program = program;

        this.in_control = in_control;
        this.in_blobs = in_blobs;
    }

    public data(): rs.TaskData {
        const d: rs.TaskData = {
            id: this.id, project: this.project, program: this.program,
            in_control: this.in_control, in_blobs: this.in_blobs,
        };
        if(this.out_status !== undefined) d.out_status = TaskStatus[this.out_status];
        if(this.out_control !== undefined) d.out_control = this.out_control;
        if(this.out_data !== undefined) d.out_data = this.out_data;
        if(this.out_error !== undefined) d.out_error = this.out_error;
        return d;
    }

    public setDone(out_control: ArrayBuffer, out_data: Ref[]): void {
        this.out_status = TaskStatus.OK;
        this.out_control = out_control;
        this.out_data = out_data;
    }

    public setError(err: api.ErrorData): void {
        this.out_status = TaskStatus.ERROR;
        this.out_error = Object.assign({}, err);
    }

    public setRefused(): void {
        this.out_status = TaskStatus.REFUSED;
    }
}

const worker_blob: Blob = new Blob([worker_text], {type: "text/javascript"});

export default class Runner {
    private readonly stat: Stat;
    private readonly provider: api.WorkProvider;
    private readonly repo: BlobRepo;
    private readonly dispatcher: WorkDispatcher;

    // Only works in Firefox?
    public static send_wasm_mod: boolean = false;

    private tasks: Map<string, Task>;

    private tasks_pending: Deque<Task>;
    private tasks_blocked: Set<Task>;
    private tasks_running: Set<Task>;
    private tasks_finished: Deque<Task>;
    private tasks_sending: Set<Task>;

    private requesting_tasks: boolean;
    private sending_results: boolean;

    private stopping?: () => void;
    private stop_count: number;

    private constructor(stat: Stat, provider: api.WorkProvider, repo: BlobRepo) {
        this.stat = stat;
        this.provider = provider;
        this.repo = repo;
        this.dispatcher = new WorkDispatcher(stat, worker_blob);
        this.dispatcher.maxWorkers = () => provider.workers;
        this.dispatcher.onRequest = this.pull.bind(this);
        this.dispatcher.onControl = this.onControl.bind(this);

        this.tasks = new Map();

        this.tasks_pending = new Deque();
        this.tasks_blocked = new Set();
        this.tasks_running = new Set();
        this.tasks_finished = new Deque();
        this.tasks_sending = new Set();

        this.requesting_tasks = false;
        this.sending_results = false;

        this.stop_count = 0;
    }

    public static create(stat: Stat, provider: api.WorkProvider, storage: Storage): Promise<Runner> {
        return BlobRepo.create(stat, provider, storage).then((repo) => repo.readState("runner").then((data) => {
            const r = new Runner(stat, provider, repo);
            if(data !== null) {
                try {
                    r.load(data);
                } catch(e)  {
                    stat.reportError(api.excData(e));
                }
            }
            r.start();
            return r;
        }));
    }

    private start(): void {
        if(this.stop_count !== 0 || !!this.stopping) {
            throw new api.StateError("Runner already started");
        }

        this.stop_count = 1;

        this.maybeSendResults();
        this.pull();
    }

    public stop(): Promise<void> {
        if(this.stopping) {
            throw new api.StateError("Already stopping Runner");
        }
        if(this.stop_count === 0) {
            throw new api.StateError("Runner not started yet");
        }
        const pr = new Promise<void>((resolve, reject) => {
            this.stopping = resolve;
        });

        this.stop_count = 2;
        if(this.requesting_tasks) this.stop_count += 1;
        if(this.sending_results) this.stop_count += 1;

        this.dispatcher.stop().then(() => {
            console.assert(this.partStop());
        });

        this.repo.stop().then(() => {
            console.assert(this.partStop());
        });

        return pr.then(() => this.save(true));
    }

    private partStop(): boolean {
        if(!this.stopping) return false;
        console.assert(this.stop_count > 0);
        this.stop_count -= 1;
        if(this.stop_count === 0) this.stopping();
        return true;
    }

    public report() {
        this.stat.report("Tasks pending", this.tasks_pending.length);
        this.stat.report("Tasks blocked", this.tasks_blocked.size);
        this.stat.report("Tasks running", this.tasks_running.size);
        this.stat.report("Tasks finished", this.tasks_finished.length);
        this.stat.report("Tasks being sent", this.tasks_sending.size);
    }

    private taskFromAPI(info: api.Task, blobs: Map<string, Ref>): Task {
        function getBlob(id: string): Ref {
            const ref = blobs.get(id);
            if(ref === undefined) {
                throw new api.StateError("blob_info missing for blob", {
                    task_id: info.id,
                    blob_id: "remote/" + id,
                });
            }
            return ref;
        }

        return new Task(
            info.id, info.project, getBlob(info.program),
            info.in_control, info.in_blobs.map(getBlob),
        );
    }

    public addTaskSet(ts: api.TaskSet) {
        const blobs = new Map<string, Ref>();
        for(const [k, v] of ts.blob_info.entries()) {
            blobs.set(k, this.repo.fromAPI(k, v));
        }

        const added_tasks: Task[] = [];
        try {
            for(const info of ts.tasks) {
                const task = this.taskFromAPI(info, blobs);
                if(this.tasks.get(task.id)) {
                    throw new api.StateError("Task already exists", {task_id: task.id});
                }
                added_tasks.push(task);
                this.tasks.set(task.id, task);
            }
        } catch(e) {
            for(const task of added_tasks) {
                this.tasks.delete(task.id);
            }
            throw e;
        }

        for(const task of added_tasks) {
            this.tasks_pending.enqueue(task);
        }

        this.save(true);
        this.pull();
    }

    private requestTasks() {
        if(this.partStop()) return;

        this.provider.getTasks().then((tasks) => {
            this.addTaskSet(tasks);
        }).catch((e: Error) => {
            this.stat.reportError(api.excData(e));
        }).finally(() => {
            if(!this.partStop()) {
                this.requesting_tasks = false;
                this.maybeRequestTasks();
            }
            this.report();
        });
    }

    public maybeRequestTasks() {
        if(this.stopping) return;
        if(this.stop_count === 0) throw new api.StateError("Not running");
        if(this.tasks_pending.length >= this.provider.tasks_pending_min) return;
        if(this.tasks_finished.length >= this.provider.tasks_finished_max) return;
        if(this.requesting_tasks) return;
        setTimeout(this.requestTasks.bind(this), 0);
        this.requesting_tasks = true;
    }

    private taskResult(t: Task): Promise<api.TaskResult> {
        const st = t.out_status!;
        if(st === TaskStatus.OK) {
            const blobs = t.out_data!;
            return this.repo.withBlobs(blobs,
                () => Promise.all(blobs.map((blob) => this.repo.read(blob)))
            ).then((data) => {
                const res: api.TaskResultOK = {
                    id: t.id,
                    status: "ok",
                    control: t.out_control!,
                    data: data,
                };
                return res;
            });
        } else if(st === TaskStatus.ERROR) {
            const res: api.TaskResultError = {
                id: t.id,
                status: "error",
                error: t.out_error!,
            };
            return Promise.resolve(res);
        } else {
            const res: api.TaskResultRefused = {
                id: t.id,
                status: "refused",
            };
            return Promise.resolve(res);
        }
    }

    private sendResults() {
        if(this.partStop()) {
            this.sending_results = false;
            return;
        }

        const tasks: Task[] = [];

        let space_left = this.provider.send_max_bytes;
        while(space_left >= 0) {
            const t = this.tasks_finished.peekFront();
            if(!t) break;

            space_left -= 32;
            if(t.out_status === TaskStatus.OK) {
                space_left -= t.out_control!.byteLength + 4 * t.out_data!.length;
                for(const blob of t.out_data!) space_left -= blob.size;
            } else if(t.out_status === TaskStatus.ERROR) {
                space_left -= 1024;
            }

            if(space_left < 0 && tasks.length !== 0) break;

            const t2 = this.tasks_finished.dequeue();
            console.assert(t === t2);
            tasks.push(t);
        }

        if(tasks.length === 0) {
            this.sending_results = false;
            return;
        }

        for(const t of tasks) {
            this.tasks_sending.add(t);
        }

        const results = Promise.all(tasks.map((t) => this.taskResult(t)));

        results.then((data) => this.provider.sendTasks(data)).then(() => {
            for(const t of tasks) {
                this.tasks_sending.delete(t);
                this.tasks.delete(t.id);
                if(t.out_data !== undefined) {
                    for(const ref of t.out_data) {
                        this.repo.unpin(ref);
                    }
                }
            }
            this.save(false);
        }, (e: Error) => {
            for(const t of tasks) {
                this.tasks_sending.delete(t);
                this.tasks_finished.insertFront(t);
            }
            this.stat.reportError(api.excData(e));
        }).finally(() => {
            if(!this.partStop()) {
                this.sending_results = false;
                this.maybeSendResults();
                this.maybeRequestTasks();
            }

            this.report();
        });
        this.report();
    }

    public maybeSendResults() {
        if(this.stopping) return;
        if(this.stop_count === 0) throw new api.StateError("Not running");
        if(this.tasks_finished.isEmpty()) return;
        if(this.sending_results) return;
        setTimeout(this.sendResults.bind(this), 0);
        this.sending_results = true;
    }

    private taskFinish(t: Task) {
        this.tasks_finished.enqueue(t);
        this.save(false);
        this.maybeSendResults();
        this.report();
    }

    private taskError(t: Task, err: api.ErrorData) {
        t.setError(err);
        this.taskFinish(t);
    }

    private taskDone(t: Task, control: ArrayBuffer, data: ArrayBuffer[]) {
        const refs: Ref[] = [];
        const promises = data.map((d) => {
            const [ref, pr] = this.repo.create(d);
            refs.push(ref);
            return pr;
        });

        Promise.all(promises).then(() => {
            t.setDone(control, refs);
            this.taskFinish(t);
        }, (e) => {
            for(const ref of refs) this.repo.unpin(ref);
            this.taskError(t, api.excData(e));
        });
    }

    private onControl(wrk: workapi.Worker, ctl: workapi.OutControl): void {
        if(ctl.get_blob !== undefined) {
            const ref = ctl.get_blob;
            this.repo.read(ref).then((data) => {
                wrk.sendControl({get_blob: [ref.id, data]}, [data]);
            }, (err) => {
                wrk.kill(api.excData(err));
            });
        } else {
            wrk.kill("Worker sent unknown control message");
        }
        return;
    }

    private startTask(t: Task) {
        this.tasks_blocked.add(t);
        this.repo.withBlobs([t.program].concat(t.in_blobs), () => {
            let releasefunc: undefined | (() => void);
            const pr_release = new Promise<void>((resolve,reject) => {
                releasefunc = resolve;
            });
            console.assert(releasefunc !== undefined);
            const release = () => {
                const r = releasefunc;
                if(r === undefined) return;
                releasefunc = undefined;
                r();
            };

            this.dispatcher.push({
                input: {
                    program: t.program,
                    control: t.in_control,
                    data: t.in_blobs,
                },
                onStart: () => {
                    this.tasks_blocked.delete(t);
                    this.tasks_running.add(t);
                    this.report();
                },
                onDone: (data: workapi.OutResult) => {
                    release();
                    this.tasks_running.delete(t);
                    this.taskDone(t, data.control, data.data);
                },
                onError: (e: api.ErrorData) => {
                    release();
                    this.tasks_blocked.delete(t);
                    this.tasks_running.delete(t);
                    this.taskError(t, e);
                },
                onControl: (ctl: workapi.Worker, data: workapi.OutControl): boolean => {
                    if(data.notify_started !== undefined) {
                        release();
                        return true;
                    }
                    return false;
                },
            });

            this.report();
            return pr_release;
        }).catch((err: Error) => {
            this.tasks_blocked.delete(t);
            this.taskError(t, api.excData(err));
            this.report();
        });

        return true;
    }

    private pull() {
        if(this.stopping) return;

        let req = this.dispatcher.want - this.tasks_blocked.size;
        while(req > 0) {
            const t = this.tasks_pending.dequeue();
            if(!t) break;
            this.startTask(t);
            req -= 1;
        }
        this.maybeRequestTasks();
        this.report();
    }

    private save_cur: Promise<void> = Promise.resolve();
    private save_next: Promise<void> | null = null;
    private save_timer: number | null = null;
    private save(now: boolean): Promise<void> {
        if(now && this.save_timer !== null) {
            clearTimeout(this.save_timer);
            this.save_timer = null;
        } else if(this.save_next) return this.save_next;

        const s = new Promise<void>((resolve, reject) => {
            if(now) {
                this.save_cur.then(resolve);
            } else {
                this.save_timer = setTimeout(() => {
                    console.assert(this.save_next === s);
                    this.save_timer = null;
                    this.save_cur.then(resolve);
                }, this.provider.save_timeout);
            }
        }).then(() => {
            console.assert(this.save_next === s);
            this.save_next = null;
            this.save_cur = s;
            return this.repo.writeState("runner", rs.dumpState(this.data()));
        });
        this.save_next = s;
        return s;
    }

    public data(): rs.RunnerData {
        return {
            tasks: Array.from(this.tasks.values()).map((t) => t.data()),
        };
    }

    private loadTask(d: rs.TaskData, pinned: Ref[]): Task {
        const t = new Task(
            d.id, d.project, this.repo.resolve(d.program),
            d.in_control, d.in_blobs.map((ref) => this.repo.resolve(ref)),
        );

        if(d.out_status === undefined) {
            // pass
        } else if(d.out_status === "OK") {
            if(d.out_control === undefined || d.out_data === undefined) {
                throw new api.StateError("Task finished but no data stored");
            }
            t.setDone(d.out_control, d.out_data.map((ref) => {
                const p = this.repo.pin(ref);
                pinned.push(p);
                return p;
            }));
        } else if(d.out_status === "ERROR") {
            if(d.out_error === undefined) {
                throw new api.StateError("Task failed but no error stored");
            }
            t.setError(d.out_error);
        } else if(d.out_status === "REFUSED") {
            t.setRefused();
        }

        return t;
    }

    private load(buf: ArrayBuffer) {
        let d: rs.RunnerData;
        try {
            d = rs.loadState(buf);
        } catch(e) {
            throw new api.StateError("Failed to decode state", {
                "cause": api.excData(e),
            });
        }

        const tasks: Task[] = [];
        const pinned: Ref[] = [];

        const pinReset = (at: number) => {
            for(const ref of pinned.splice(at)) {
                this.repo.unpin(ref);
            }
        };

        try {
            for(const t of d.tasks) {
                tasks.push(this.loadTask(t, pinned));
            }
        } catch(e) {
            pinReset(0);
            throw e;
        }

        for(const task of tasks) {
            if(this.tasks.get(task.id)) {
                this.stat.reportError({
                    "kind": "state",
                    "message": "Task already exists",
                    "task_id": task.id,
                });
                continue;
            }

            this.tasks.set(task.id, task);
            if(task.out_status === undefined) {
                this.tasks_pending.push(task);
            } else {
                this.tasks_finished.push(task);
            }
        }
    }
}
