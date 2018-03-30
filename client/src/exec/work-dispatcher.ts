import Deque from "double-ended-queue";

import * as api from "./api";
import {Stat} from "./stat";
import * as workapi from "./workapi";

type Transferable = ArrayBuffer | MessagePort;

export interface Work {
    onStart(): void;
    onError(err: api.ErrorData): void;
    onDone(out: workapi.OutResult): void;
    onControl(ctl: workapi.Worker, out: workapi.OutControl): boolean;
    input: workapi.InWork;
    transfer?: Transferable[];
}

class WorkerController implements workapi.Worker {
    public readonly stat: Stat;
    public readonly id: number;

    public readonly w: Worker;

    private work: Work | null = null;
    private ready = true;
    private dead = false;
    private message?: string;

    public onDead: () => void = () => {};
    public onReady: () => void = () => {};
    public onControl: (data: workapi.OutControl) => void = (data) => {};

    constructor(stat: Stat, id: number, body: Blob) {
        this.stat = stat;
        this.id = id;
        const url = URL.createObjectURL(body);
        try {
            this.w = new Worker(url);
        } finally {
            URL.revokeObjectURL(url);
        }
        this.w.onerror = this.workerError.bind(this);
        this.w.onmessage = this.workerMessage.bind(this);
        this.report();
    }

    public report() {
        const key = `Worker ${this.id}`;
        let msg: string;
        if(this.ready) {
            msg = "ready";
        } else if(this.dead) {
            msg = "dead; " + this.message!;
            setTimeout(() => this.stat.report(key, null), 1000);
        } else {
            msg = "working";
        }
        this.stat.report(key, msg);
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
        this.report();
    }

    public sendControl(data: workapi.InControl, transfer?: Transferable[]) {
        this.send({control: data}, transfer);
    }

    public kill(err: api.ErrorData | string) {
        if(typeof err === "string") {
            err = {
                "kind": "runtime",
                "message": err,
            };
        }
        this.ready = false;
        this.dead = true;
        this.message = err.message;
        this.w.terminate();
        this.onDead();
        const work = this.work;
        if(work) {
            this.work = null;
            work.onError(err);
        } else {
            this.stat.reportError(err);
        }
        this.report();
    }

    public stop() {
        console.assert(this.work === null);
        this.ready = false;
        this.dead = true;
        this.message = "Stopped";
        this.w.terminate();
        this.onDead();
        this.report();
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
            this.report();
        } catch(e) {
            this.kill({
                kind: "runtime",
                message: "Worker message caused exception",
                cause: api.excData(e.message),
            });
            return;
        }
    }
}

const const_0 = () => 0;

export default class WorkDispatcher {
    private readonly stat: Stat;
    private readonly worker_body: Blob;

    private readonly workers: Set<WorkerController>;
    private workers_free: WorkerController[];
    private worker_counter: number;

    private readonly work: Deque<Work>;

    private stopping?: () => void;

    public maxWorkers: () => number = const_0;
    public onRequest: () => void = () => undefined;
    public onControl: (wrk: workapi.Worker, data: workapi.OutControl) => void = () => {};

    constructor(stat: Stat, worker_body: Blob) {
        this.stat = stat;

        this.workers = new Set();
        this.workers_free = [];
        this.worker_counter = 0;
        this.work = new Deque();

        this.worker_body = worker_body;
        this.report();
    }

    public stop(): Promise<void> {
        if(this.stopping) {
            throw new api.StateError("Already stopping WorkManager");
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
        this.stat.report("Work queue size", this.work.length);
        this.stat.report("Workers", this.workers.size);
        this.stat.report("Workers free", this.workers_free.length);
    }

    public addWorker() {
        const id = this.worker_counter;
        this.worker_counter = id + 1;
        const wrk = new WorkerController(this.stat, id, this.worker_body);
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
            if(this.work.length < this.workers.size/2) {
                this.onRequest();
            }
            this.report();
        };

        wrk.onDead = () => {
            const i = this.workers_free.indexOf(wrk);
            if(i !== -1) this.workers_free.splice(i, 1);
            console.assert(this.workers.delete(wrk));

            if(!this.work.isEmpty() && this.workers.size < this.maxWorkers()) {
                this.addWorker();
            }

            if(this.stopping && this.workers.size === 0) {
                this.stopping();
            }

            this.report();
        };

        wrk.onControl = (data: workapi.OutControl) => {
            this.onControl(wrk, data);
        };

        this.workers.add(wrk);
        wrk.onReady();
    }

    public get want(): number {
        return Math.max(1, this.workers.size - this.work.length + this.workers_free.length);
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
