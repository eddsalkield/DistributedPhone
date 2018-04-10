import Deque from "double-ended-queue";

import * as err from "../err";
import * as stat from "../stat";

import * as api from "./api";
import * as workapi from "./workapi";

type Transferable = ArrayBuffer | MessagePort;

export interface Work {
    onStart(): void;
    onError(e: api.ErrorData): void;
    onDone(out: workapi.OutResult): void;
    onControl(ctl: workapi.Worker, out: workapi.OutControl): boolean;
    input: workapi.InWork;
    transfer?: Transferable[];
}

class WorkerController implements workapi.Worker {
    public readonly st: stat.Sink;

    public readonly w: Worker;

    private work: Work | null = null;
    private ready = true;

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
        this.w.onerror = this.workerError.bind(this);
        this.w.onmessage = this.workerMessage.bind(this);
    }

    private send(data: workapi.In, transfer: Transferable[] | undefined) {
        this.w.postMessage(data, transfer);
    }

    public setWork(work: Work) {
        console.assert(this.ready);
        this.ready = false;
        this.work = work;
        try {
            this.send({work: work.input}, work.transfer);
        } catch(e) {
            this.kill("Failed to send message");
            throw e;
        }
        work.onStart();
    }

    public sendControl(data: workapi.InControl, transfer?: Transferable[]) {
        this.send({control: data}, transfer);
    }

    public kill(e: api.ErrorData | string) {
        if(typeof e === "string") {
            e = {
                "kind": "runtime",
                "message": e,
            };
        }
        this.ready = false;
        this.w.terminate();
        this.onDead(false);
        const work = this.work;
        if(work) {
            this.work = null;
            work.onError(e);
        } else {
            this.st.reportError(e);
        }
    }

    public stop() {
        console.assert(this.work === null);
        this.ready = false;
        this.w.terminate();
        this.onDead(true);
    }

    private workerError() {
        this.kill("Worker failed");
    }

    private workerMessage(msg: MessageEvent) {
        try {
            const data = msg.data as workapi.Out;
            if(data.result) {
                const work = this.work;
                if(!work) {
                    this.kill("Worker sent result without work");
                    return;
                }
                this.work = null;
                work.onDone(data.result);
                this.ready = true;
                this.onReady();
            } else if(data.error) {
                const work = this.work;
                if(!work) {
                    this.kill("Worker sent error without work");
                    return;
                }
                this.work = null;
                work.onError(data.error);
                this.ready = true;
                this.onReady();
            } else if(data.control) {
                const work = this.work;
                if(!work || !work.onControl(this, data.control)) this.onControl(data.control);
            } else {
                this.kill("Worker sent invalid message");
                return;
            }
        } catch(e) {
            this.kill({
                kind: "runtime",
                message: "Worker message caused exception",
                cause: err.dataOf(e.message),
            });
            return;
        }
    }
}

const const_0 = () => 0;

export default class WorkDispatcher {
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

    private stopping?: () => void;

    public maxWorkers: () => number = const_0;
    public onControl: (wrk: workapi.Worker, data: workapi.OutControl) => void = () => {};

    constructor(
        private readonly st: stat.Sink,
        private readonly worker_body: Blob
    ) {}

    public stop(): Promise<void> {
        if(this.stopping) {
            throw new err.State("Already stopping WorkManager");
        }

        return new Promise((resolve,reject) => {
            this.maxWorkers = const_0;
            this.stopping = resolve;

            if(this.workers_free.length === 0 && this.workers.size === 0) {
                this.stopping();
                return;
            }

            while(true) {
                const w = this.workers_free.pop();
                if(!w) break;
                w.stop();
            }
        });
    }

    public report() {
        this.st_work.set(this.work.length);
        this.st_workers.set(this.workers.size);
        this.st_workers_free.set(this.workers_free.length);
    }

    public addWorker() {
        const wrk = new WorkerController(this.st, this.worker_body);

        this.st_workers_started.inc();

        wrk.onReady = () => {
            console.assert(this.workers.has(wrk));
            console.assert(this.workers_free.indexOf(wrk) === -1);

            if(this.workers.size > this.maxWorkers()) {
                wrk.stop();
                return;
            }

            const w = this.work.dequeue();
            if(w) {
                wrk.setWork(w);
            } else {
                this.workers_free.push(wrk);
            }

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

            if(this.stopping && this.workers.size === 0) {
                this.stopping();
            } else if(!this.work.isEmpty() && this.workers.size < this.maxWorkers()) {
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

    public push(w: Work) {
        const wrk = this.workers_free.pop();
        if(wrk) {
            console.assert(this.work.isEmpty());
            wrk.setWork(w);
        } else {
            this.work.push(w);
            if(this.workers.size < this.maxWorkers()) {
                this.addWorker();
            }
        }
        this.report();
    }
}
