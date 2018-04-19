import Deque from "double-ended-queue";

import * as err from "@/err";
import * as stat from "@/stat";

import * as workapi from "./workapi";

type Transferable = ArrayBuffer | MessagePort;

export interface Callbacks {
    onStart(): void;
    onError(e: Error): void;
    onDone(out: workapi.OutResult): void;
    onControl(data: workapi.OutControl): boolean;
}

export interface Controller {
    sendControl(data: workapi.InControl, transfer: Transferable[]): void;
    kill(e: Error): void;
}

interface Work {
    cb: Callbacks | null;
    input: workapi.InWork | null;
    transfer: Transferable[] | null;
    worker: Thread | null;
}

class Thread {
    public readonly st: stat.Sink;

    public readonly w: Worker;

    private work: Work | null = null;

    public onDead: (graceful: boolean) => void = () => {};
    public onReady: () => void = () => {};

    constructor(st: stat.Sink, body: Blob) {
        this.st = st;
        const url = URL.createObjectURL(body);
        try {
            this.w = new Worker(url);
        } finally {
            URL.revokeObjectURL(url);
        }
        this.w.onerror = (e) => {
            this.kill("Worker error: " + e.message);
        };
        this.w.onmessage = (event: MessageEvent) => {
            try {
                this.onMessage(event.data);
            } catch(e) {
                this.kill(new err.Runtime("Worker message caused exception", {
                    cause: err.dataOf(e),
                }));
            }
        };
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

        const cb = this.finWork();
        this.stop(false);
        if(cb === null) {
            this.st.reportError(e);
        } else {
            cb.onError(e);
        }
    }

    public stop(graceful: boolean) {
        console.assert(this.work === null);
        this.w.terminate();
        this.onDead(graceful);
    }

    public finWork(): Callbacks | null {
        const work = this.work;
        if(work === null) return null;
        this.work = null;

        const cb = work.cb!;
        work.cb = null;
        work.worker = null;
        return cb;
    }

    private onError(e: Error) {
        const cb = this.finWork();
        if(cb === null) {
            this.kill("Worker sent result without work");
            return;
        }
        cb.onError(e);
    }

    private onResult(data: workapi.OutResult) {
        const cb = this.finWork();
        if(cb === null) {
            this.kill("Worker sent result without work");
            return;
        }
        cb.onDone(data);
    }

    private onMessage(data: workapi.Out) {
        if(data.control !== undefined) {
            const work = this.work;
            if(work && work.cb!.onControl(data.control)) return;
            this.kill("Worker sent unknown control message");
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

class WorkController implements Controller {
    constructor(private _work: Work) {}

    public sendControl(data: workapi.InControl, transfer: Transferable[]): boolean {
        const work = this._work;
        const wrk = work.worker;
        if(wrk === null) return false;
        wrk.sendControl(data, transfer);
        return true;
    }

    public kill(e: Error): void {
        const work = this._work;

        const wrk = work.worker;
        if(wrk !== null) {
            const cb = wrk.finWork();
            console.assert(cb !== null);
            wrk.stop(false);
            cb!.onError(e);
            return;
        }

        const cb = work.cb;
        if(cb !== null) {
            work.cb = null;
            cb.onError(e);
            return;
        }
    }
}

export class Dispatcher {
    private readonly st_work = new stat.Metric<number>(
        "work_dispatcher/work_queue_size"
    ).attach(this.st);
    private readonly st_workers = new stat.Metric<number>(
        "work_dispatcher/workers"
    ).attach(this.st);
    private readonly st_workers_free = new stat.Metric<number>(
        "work_dispatcher/workers_free"
    ).attach(this.st);
    private readonly st_workers_started = new stat.Counter(
        "work_dispatcher/workers_started"
    ).attach(this.st);
    private readonly st_workers_stopped = new stat.Counter(
        "work_dispatcher/workers_stopped", {"graceful": true}
    ).attach(this.st);
    private readonly st_workers_killed = new stat.Counter(
        "work_dispatcher/workers_stopped", {"graceful": false}
    ).attach(this.st);

    private readonly workers = new Set<Thread>();
    private workers_free: Thread[] = [];

    private readonly work = new Deque<Work>();

    private paused: number = 0;

    constructor(
        private readonly st: stat.Sink,
        private readonly worker_body: Blob
    ) {}

    public report() {
        this.st_work.set(this.work.length);
        this.st_workers.set(this.workers.size);
        this.st_workers_free.set(this.workers_free.length);
    }

    public get max_workers(): number {
        const w = (self.navigator.hardwareConcurrency | 0) - 1;
        if(w < 1) return 1;
        if(w > 128) return 128;
        return w;
    }

    private kill_timer: number | null = null;
    private addWorker() {
        const wrk = new Thread(this.st, this.worker_body);

        this.st_workers_started.inc();

        wrk.onReady = () => {
            console.assert(this.workers.has(wrk));
            console.assert(this.workers_free.indexOf(wrk) === -1);

            if(this.workers.size > this.max_workers) {
                wrk.stop(true);
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

        this.workers.add(wrk);
        wrk.onReady();
    }

    public push(cb: Callbacks, input: workapi.InWork, transfer: Transferable[]): Controller {
        const work: Work = {
            cb: cb,
            input: input,
            transfer: transfer,
            worker: null,
        };

        this.work.push(work);
        this.pull();
        this.report();

        return new WorkController(work);
    }

    private pull_scheduled: boolean = false;
    private pull(): void {
        if(this.pull_scheduled) return;
        this.pull_scheduled = false;
        self.setTimeout(() => this.doPull(), 0);
    }

    private doPull(): void {
        this.pull_scheduled = false;
        if(this.paused > 0) return;

        while(this.workers_free.length !== 0) {
            const w = this.work.dequeue();
            if(w === undefined) {
                this.startKillTimer();
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

    private startKillTimer(): void {
        if(this.kill_timer !== null) return;
        const tm = self.setInterval(() => {
            const wrk = this.workers_free.pop();
            if(wrk === undefined) {
                self.clearInterval(tm);
                this.kill_timer = null;
            } else {
                wrk.stop(true);
            }
        }, 1000);
        this.kill_timer = tm;
    }

    public pause(resume: Promise<void>): void {
        this.paused += 1;
        resume.finally(() => {
            this.paused -= 1;
            if(this.paused === 0) {
                this.pull();
            }
        });
    }
}
