import Deque from "double-ended-queue";

import * as err from "@/err";
import * as stat from "@/stat";

import * as workapi from "./workapi";

type Transferable = ArrayBuffer | MessagePort;

export interface WorkCallbacks {
    onStart(): void;
    onError(e: Error): void;
    onDone(out: workapi.OutResult): void;
    onControl(ctl: workapi.Worker, out: workapi.OutControl): boolean;
}

interface Work {
    cb: WorkCallbacks | null;
    input: workapi.InWork | null;
    transfer: Transferable[] | null;
    worker: WorkerController | null;
}

class WorkerController implements workapi.Worker {
    public readonly st: stat.Sink;

    public readonly w: Worker;

    private work: Work | null = null;

    public onDead: (graceful: boolean) => void = () => {};
    public onReady: () => void = () => {};
    public onControl: (data: workapi.OutControl) => void = (data) => {};

    constructor(st: stat.Sink, body: Blob) {
        this.st = st;
        const url = URL.createObjectURL(body);
        try {
            this.w = new Worker(url);
        } finally {
            URL.revokeObjectURL(url);
        }
        this.w.onerror = () => {
            this.kill("Worker error");
        };
        this.w.onmessage = (event: MessageEvent) => {
            try {
                this.onMessage(event.data);
            } catch(e) {
                this.kill(new err.Runtime("Worker message caused exception", {
                    cause: err.dataOf(e),
                }));
            }
        }
    }

    private send(data: workapi.In, transfer: Transferable[] | undefined) {
        this.w.postMessage(data, transfer);
    }

    public setWork(work: Work) {
        try {
            this.send({work: work.input!}, work.transfer!);
        } catch(e) {
            this.kill("Failed to send message");
            throw e;
        }
        this.work = work;
        work.input = null;
        work.transfer = null;
        work.worker = this;
        work.cb!.onStart();
    }

    public sendControl(data: workapi.InControl, transfer?: Transferable[]) {
        this.send({control: data}, transfer);
    }

    public kill(e: Error | string) {
        if(typeof e === "string") {
            e = new err.Runtime(e);
        }

        this.w.terminate();
        this.onDead(false);

        this.onError(e);
    }

    private onError(e: Error) {
        const work = this.work;
        if(work === null) {
            this.st.reportError(e);
            return;
        }
        this.work = null;

        const cb = work.cb!;
        work.cb = null;
        work.worker = null;
        cb.onError(e);
    }

    private onResult(data: workapi.OutResult) {
        const work = this.work;
        if(work === null) {
            this.kill("Worker sent result without work");
            return;
        }
        this.work = null;

        const cb = work.cb!;
        work.cb = null;
        work.worker = null;
        cb.onDone(data);
    }

    public stop() {
        console.assert(this.work === null);
        this.w.terminate();
        this.onDead(true);
    }

    private onMessage(data: workapi.Out) {
        if(data.control !== undefined) {
            const work = this.work;
            if(!work || !work.cb!.onControl(this, data.control)) this.onControl(data.control);
            return;
        }

        if(data.result !== undefined) {
            this.onResult(data.result);
        } else if(data.error) {
            this.onError(err.fromData(data.error));
        } else {
            this.kill("Worker sent invalid message");
            return;
        }

        this.onReady();
    }
}

export class WorkDispatcher {
    private readonly st_work = new stat.Metric<number>(
        "WorkDispatcher/work_queue_size"
    ).attach(this.st);
    private readonly st_workers = new stat.Metric<number>(
        "WorkDispatcher/workers"
    ).attach(this.st);
    private readonly st_workers_free = new stat.Metric<number>(
        "WorkDispatcher/workers_free"
    ).attach(this.st);
    private readonly st_workers_started = new stat.Counter(
        "WorkDispatcher/workers_started"
    ).attach(this.st);
    private readonly st_workers_stopped = new stat.Counter(
        "WorkDispatcher/workers_stopped", {"graceful": true}
    ).attach(this.st);
    private readonly st_workers_killed = new stat.Counter(
        "WorkDispatcher/workers_stopped", {"graceful": false}
    ).attach(this.st);

    private readonly workers = new Set<WorkerController>();
    private workers_free: WorkerController[] = [];

    private readonly work = new Deque<Work>();

    public onControl: (wrk: workapi.Worker, data: workapi.OutControl) => void = () => {};

    constructor(
        private readonly st: stat.Sink,
        private readonly worker_body: Blob
    ) {}

    public report() {
        this.st_work.set(this.work.length);
        this.st_workers.set(this.workers.size);
        this.st_workers_free.set(this.workers_free.length);
    }

    private get max_workers(): number {
        const w = (self.navigator.hardwareConcurrency | 0) - 1;
        if(w < 1) return 1;
        if(w > 128) return 128;
        return w;
    }

    private kill_timer: number | null = null;
    private addWorker() {
        const wrk = new WorkerController(this.st, this.worker_body);

        this.st_workers_started.inc();

        wrk.onReady = () => {
            console.assert(this.workers.has(wrk));
            console.assert(this.workers_free.indexOf(wrk) === -1);

            if(this.workers.size > this.max_workers) {
                wrk.stop();
                return;
            }

            this.workers_free.push(wrk);
            this.pull();
            this.report();
        };

        wrk.onDead = (normal: boolean) => {
            const i = this.workers_free.indexOf(wrk);
            if(i !== -1) this.workers_free.splice(i, 1);
            console.assert(this.workers.delete(wrk));

            if(normal) {
                this.st_workers_stopped.inc();
            } else {
                this.st_workers_killed.inc();
            }

            if(!this.work.isEmpty() && this.workers.size < this.max_workers) {
                this.addWorker();
            }

            this.report();
        };

        wrk.onControl = (data: workapi.OutControl) => {
            this.onControl(wrk, data);
        };

        this.workers.add(wrk);
        wrk.onReady();
    }

    public push(cb: WorkCallbacks, input: workapi.InWork, transfer: Transferable[]): () => void {
        const work: Work = {
            cb: cb,
            input: input,
            transfer: transfer,
            worker: null,
        };

        const cancel = () => {
            const wrk = work.worker;
            if(wrk !== null) {
                wrk.kill(new err.Cancelled("Task cancelled"));
                return;
            }

            const wcb = work.cb;
            if(wcb !== null) {
                work.cb = null;
                wcb.onError(new err.Cancelled("Task cancelled"));
                return;
            }
        };

        this.work.push(work);
        this.pull();
        this.report();

        return cancel;
    }

    private pull_scheduled: boolean = false;
    private pull(): void {
        if(this.pull_scheduled) return;
        this.pull_scheduled = false;
        self.setTimeout(() => this.doPull(), 0);
    }

    private doPull(): void {
        this.pull_scheduled = false;

        while(this.workers_free.length !== 0) {
            const w = this.work.dequeue();
            if(w === undefined) {
                if(this.kill_timer === null) {
                    const tm = setInterval(() => {
                        const wrk = this.workers_free.pop();
                        if(wrk === undefined) {
                            clearInterval(tm);
                            this.kill_timer = null;
                        } else {
                            wrk.stop();
                        }
                    }, 1000);
                    this.kill_timer = tm;
                }
                break;
            }
            if(w.cb === null) continue;
            const wrk = this.workers_free.pop()!;
            wrk.setWork(w);
        }

        if(this.workers.size < this.max_workers) {
            this.addWorker();
        }

        this.report();
    }
}
