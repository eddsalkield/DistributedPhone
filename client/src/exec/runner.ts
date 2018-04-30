import Deque from "double-ended-queue";

import * as err from "@/err";
import * as stat from "@/stat";

import * as api from "./api";
import {BlobRepo} from "./repo";
import {Ref, Storage} from "./storage";
import * as wd from "./work-dispatcher";
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

    public in_control: Uint8Array;
    public in_blobs: Ref[];

    public out_status?: TaskStatus;
    public out_data?: Ref[];
    public out_error?: api.ErrorData;

    public tryCancel?: () => void;

    constructor(
        id: string, project: string, program: Ref,
        in_control: Uint8Array, in_blobs: Ref[],
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
        if(this.out_data !== undefined) d.out_data = this.out_data;
        if(this.out_error !== undefined) d.out_error = this.out_error;
        return d;
    }

    public setDone(out_data: Ref[]): void {
        this.out_status = TaskStatus.OK;
        this.out_data = out_data;
    }

    public setError(e: api.ErrorData): void {
        this.out_status = TaskStatus.ERROR;
        this.out_error = Object.assign({}, e);
    }

    public setRefused(): void {
        this.out_status = TaskStatus.REFUSED;
    }
}

const worker_blob: Blob = new Blob([worker_text], {type: "text/javascript"});

export default class Runner {
    private readonly st_pending = new stat.Metric<number>("Runner/tasks_pending").attach(this.st);
    private readonly st_blocked = new stat.Metric<number>("Runner/tasks_blocked").attach(this.st);
    private readonly st_running = new stat.Metric<number>("Runner/tasks_running").attach(this.st);
    private readonly st_finished = new stat.Metric<number>("Runner/tasks_finished").attach(this.st);
    private readonly st_sending = new stat.Metric<number>("Runner/tasks_sending").attach(this.st);
    private readonly st_sent = new stat.Counter("Runner/tasks_sent").attach(this.st);

    private readonly dispatcher = new wd.Dispatcher(this.st, worker_blob);

    // Only works in Firefox?
    public static send_wasm_mod: boolean = false;

    private tasks = new Map<string, Task>();

    /* Tasks with no result yet. */
    private tasks_pending = new Set<Task>();
    /* Tasks waiting for data to be downloaded. The value is a cancellation
     * function. */
    private tasks_blocked = new Set<Task>();
    /* Tasks being processed by workers. */
    private tasks_running = new Set<Task>();
    /* Tasks with results ready to be sent. */
    private tasks_finished = new Deque<Task>();
    /* Tasks being sent right now. They might be moved back to `tasks_finished`
     * if sending fails. */
    private tasks_sending = new Set<Task>();

    private requesting_tasks: boolean = false;
    private sending_results: boolean = false;

    /* If not stopping, `undefined`. Otherwise, callback indicating that the
     * Runner has stopped. Invoke through `partStop()`. */
    private stop_cb?: () => void;
    /* If running, `-1`. Otherwise, the number of remaining calls to
     * `partStop()` expected. */
    private stop_count: number = 0;

    private constructor(
        private readonly st: stat.Sink,
        private readonly provider: api.WorkProvider,
        public readonly repo: BlobRepo
    ) {}

    public static create(st: stat.Sink, provider: api.WorkProvider, storage: Storage): Promise<Runner> {
        return BlobRepo.create(st, provider, storage).then((repo) => repo.readState("runner").then((data) => {
            const r = new Runner(st, provider, repo);
            if(data !== null) {
                try {
                    r.load(data);
                } catch(e)  {
                    st.reportError(e);
                }
            }
            r.start();
            return r;
        }));
    }

    public get is_running(): boolean {
        return this.stop_count === -1;
    }

    public get is_stopped(): boolean {
        return this.stop_count === 0 && this.stop_cb === undefined;
    }

    public get is_stopping(): boolean {
        return this.stop_cb !== undefined;
    }

    private start(): void {
        if(!this.is_stopped) {
            throw new err.State("Runner already started");
        }

        this.stop_count = -1;

        for(const t of this.tasks_pending) {
            this.startTask(t);
        }

        this.maybeRequestTasks();
        this.maybeSendResults();
    }

    public stop(): Promise<void> {
        if(this.stop_cb !== undefined) {
            throw new err.State("Already stopping Runner");
        }
        if(this.stop_count === 0) {
            throw new err.State("Runner not started yet");
        }
        const pr = new Promise<void>((resolve, reject) => {
            this.stop_cb = resolve;
        });

        this.stop_count = this.tasks_pending.size;
        if(this.requesting_tasks) this.stop_count += 1;
        if(this.sending_results) this.stop_count += 1;

        for(const t of this.tasks_pending) {
            const f = t.tryCancel;
            if(f !== undefined) f();
        }

        return pr.then(() => this.save(true)).then(() => {
            delete this.stop_cb;
        });
    }

    /* Indicate a component is ready to stop. Returns `true` iff the component
     * should stop. */
    private partStop(): boolean {
        if(this.stop_cb === undefined) return false;
        console.assert(this.stop_count > 0);
        this.stop_count -= 1;
        if(this.stop_count === 0) this.stop_cb();
        return true;
    }

    public report() {
        this.st_pending.set(this.tasks_pending.size);
        this.st_blocked.set(this.tasks_blocked.size);
        this.st_running.set(this.tasks_running.size);
        this.st_finished.set(this.tasks_finished.length);
        this.st_sending.set(this.tasks_sending.size);
    }

    public addTaskSet(ts: api.TaskSet) {
        const getBlob = (b: api.BlobRef) => this.repo.fromAPI(b);
        const added_tasks: Task[] = [];
        try {
            for(const info of ts.tasks) {
                if(this.tasks.get(info.id)) {
                    throw new err.State("Task already exists", {task_id: info.id});
                }
                const task = new Task(
                    info.id, info.project, getBlob(info.program),
                    info.in_control, info.in_blobs.map(getBlob),
                );
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
            this.newTask(task);
        }

        this.save(true);
        this.report();
    }

    private requestTasks() {
        if(this.partStop()) {
            this.requesting_tasks = false;
            return;
        }

        this.provider.getTasks().then((tasks) => {
            this.addTaskSet(tasks);
        }).catch((e: Error) => {
            this.st.reportError(e);
        }).finally(() => {
            this.requesting_tasks = false;
            if(this.partStop()) return;
            this.maybeRequestTasks();
        });
    }

    public maybeRequestTasks() {
        if(!this.is_running) {
            if(this.is_stopping) return;
            throw new err.State("Not running");
        }
        if(this.tasks_pending.size >= this.provider.tasks_pending_min) return;
        if(this.tasks_finished.length >= this.provider.tasks_finished_max) return;
        if(this.requesting_tasks) return;
        self.setTimeout(this.requestTasks.bind(this), 0);
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
            if(t === undefined) break;

            space_left -= 32;
            if(t.out_status === TaskStatus.OK) {
                space_left -= 4 * t.out_data!.length;
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
            const unpin: Ref[] = [];
            for(const t of tasks) {
                this.tasks_sending.delete(t);
                this.tasks.delete(t.id);
                if(t.out_data !== undefined) {
                    for(const ref of t.out_data) {
                        unpin.push(ref);
                    }
                }
                this.st_sent.inc();
            }
            this.save(false).then(() => {
                for(const ref of unpin) {
                    this.repo.unpin(ref);
                }
            });
            this.report();
        }, (e: Error) => {
            for(const t of tasks) {
                this.tasks_sending.delete(t);
                this.tasks_finished.insertFront(t);
            }
            this.st.reportError(e);
            this.report();
        }).finally(() => {
            this.sending_results = false;
            if(this.partStop()) return;
            this.maybeRequestTasks();
            this.maybeSendResults();
        });
        this.report();
    }

    public maybeSendResults() {
        if(!this.is_running) {
            if(this.is_stopping) return;
            throw new err.State("Not running");
        }
        if(this.tasks_finished.isEmpty()) return;
        if(this.sending_results) return;
        self.setTimeout(this.sendResults.bind(this), 0);
        this.sending_results = true;
    }

    private taskFinish(t: Task) {
        this.tasks_pending.delete(t);
        this.tasks_finished.enqueue(t);
        this.save(false);
        if(this.partStop()) return;
        this.maybeRequestTasks();
        this.maybeSendResults();
        this.report();
    }

    private taskError(t: Task, e: Error) {
        if(e instanceof err.Cancelled) {
            if(this.partStop()) return;
            t.setRefused();
        } else {
            t.setError(err.dataOf(e));
        }
        this.taskFinish(t);
    }

    private taskDone(t: Task, data: Uint8Array[]) {
        const refs: Ref[] = [];
        const promises = data.map((d) => {
            const [ref, pr] = this.repo.create(d);
            refs.push(ref);
            return pr;
        });

        Promise.all(promises).then(() => {
            t.setDone(refs);
            this.taskFinish(t);
        }, (e) => {
            for(const ref of refs) this.repo.unpin(ref);
            this.taskError(t, e);
        });
    }

    private onControl(ctl: wd.Controller, msg: workapi.OutControl): boolean {
        if(msg.get_blob !== undefined) {
            const ref = msg.get_blob;
            this.repo.read(ref).then((data) => {
                ctl.sendControl({get_blob: [ref.id, data]}, [data.buffer as ArrayBuffer]);
            }, (e) => {
                ctl.kill(e);
            });
            return true;
        }
        return false;
    }

    private newTask(t: Task) {
        this.tasks_pending.add(t);
        if(this.is_running) {
            this.startTask(t);
        }
    }

    private startTask(t: Task) {
        if(this.tasks_blocked.has(t)) {
            throw new err.State("Task already started", {
                "task_id": t.id,
            });
        }

        this.tasks_blocked.add(t);

        this.repo.withBlobs([t.program].concat(t.in_blobs), () => {
            delete t.tryCancel;
            this.tasks_blocked.delete(t);

            let release: (() => void) | undefined;
            const pr_release = new Promise<void>((resolve,reject) => {
                release = resolve;
            });

            const ctl = this.dispatcher.push({
                onStart: () => {
                    this.tasks_running.add(t);
                    this.report();
                },
                onDone: (data: workapi.OutResult) => {
                    delete t.tryCancel;
                    release!();
                    this.tasks_running.delete(t);
                    this.taskDone(t, data.data);
                },
                onError: (e: Error) => {
                    delete t.tryCancel;
                    release!();
                    this.tasks_running.delete(t);
                    this.taskError(t, e);
                },
                onControl: (data: workapi.OutControl): boolean => {
                    if(data.notify_started !== undefined) {
                        release!();
                        return true;
                    }
                    return this.onControl(ctl, data);
                },
            }, {
                program: t.program,
                control: t.in_control,
                data: t.in_blobs,
            }, []);

            t.tryCancel = () => {
                ctl.kill(new err.Cancelled("Task cancelled"));
            };

            this.report();
            return pr_release;
        }, new Promise((resolve, reject) => {
            t.tryCancel = () => {
                resolve(new err.Cancelled("Task cancelled"));
            };
        })).catch((e: Error) => {
            this.tasks_blocked.delete(t);
            delete t.tryCancel;
            this.taskError(t, e);
            this.report();
        });
    }

    private save_cur: Promise<void> = Promise.resolve();
    private save_next: Promise<void> | null = null;
    private save_timer: number | null = null;
    public save(now: boolean): Promise<void> {
        if(now && this.save_timer !== null) {
            clearTimeout(this.save_timer);
            this.save_timer = null;
        } else if(this.save_next) return this.save_next;

        const s = new Promise<void>((resolve, reject) => {
            if(now) {
                this.save_cur.then(resolve);
            } else {
                this.save_timer = self.setTimeout(() => {
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
            d.id, d.project, this.repo.register(d.program),
            d.in_control, d.in_blobs.map((ref) => this.repo.register(ref)),
        );

        if(d.out_status === undefined) {
            // pass
        } else if(d.out_status === "OK") {
            if(d.out_data === undefined) {
                throw new err.State("Task finished but no data stored");
            }
            t.setDone(d.out_data.map((ref) => {
                const p = this.repo.pin(ref);
                pinned.push(p);
                return p;
            }));
        } else if(d.out_status === "ERROR") {
            if(d.out_error === undefined) {
                throw new err.State("Task failed but no error stored");
            }
            t.setError(d.out_error);
        } else if(d.out_status === "REFUSED") {
            t.setRefused();
        }

        return t;
    }

    private load(buf: Uint8Array) {
        let d: rs.RunnerData;
        try {
            d = rs.loadState(buf);
        } catch(e) {
            throw new err.State("Failed to decode state", {
                "cause": err.dataOf(e),
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
                this.st.reportError(new err.State("Task already exists", {
                    "task_id": task.id,
                }));
                continue;
            }

            this.tasks.set(task.id, task);
            if(task.out_status === undefined) {
                this.newTask(task);
            } else {
                this.tasks_finished.enqueue(task);
            }
        }
    }
}
