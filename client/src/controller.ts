import * as exec_api from "@/exec/api";

import * as cbor from "@/cbor";
import * as cbut from "@/cbor-util";
import * as err from "@/err";
import * as stat from "@/stat";

import IDBStorage from "@/exec/idb_storage";
import Runner from "@/exec/runner";

interface ReqOpts {
    data?: Uint8Array;
    expect_size?: number;
}

export class TSDB implements stat.TSDB {
    constructor() {}

    public write(at: number, data: stat.Point[]): void {
        for(const p of data) console.log(p);
    }

    public writeError(at: number, e: err.Data): void {
        console.log(e);
    }
}

export default class Controller {
    public readonly stat_root: stat.Root;

    private token?: Promise<string>;
    private on_login?: (token: string) => void;
    private runner: Promise<Runner>;
    private on_runner?: (runner: Promise<Runner>) => void;
    private project: string = "";

    constructor(
        /* Base URL with trailing slash */
        public readonly url: string,
    ) {
        this.stat_root = new stat.Root(new TSDB());
        this.runner = this.runnerPromise();
    }

    private runnerPromise(): Promise<Runner> {
        return new Promise((resolve, reject) => {
            this.on_runner = (r) => {
                delete this.on_runner;
                resolve(r);
            };
        });
    }

    public startExec(): void {
        if(this.on_runner === undefined) return;
        this.on_runner(IDBStorage.create(this.stat_root, "blob_storage").then((storage) => {
            return Runner.create(this.stat_root, new WorkProvider(this), storage);
        }));
    }

    public withToken<T>(f: (token: string) => Promise<T>): Promise<T> {
        if(this.token === undefined) {
            this.token = new Promise((resolve, reject) => {
                this.on_login = resolve;
            });
        }
        return this.token.then(f);
    }

    public withRunner<T>(f: (r: Runner) => Promise<T>): Promise<T> {
        return this.runner.then(f);
    }

    public resetExec(): Promise<void> {
        if(this.on_runner !== undefined) {
            return IDBStorage.delete("blob_storage");
        }
        return this.runner.then((r) => {
            this.runner = this.runnerPromise();
            r.stop();
        }).catch(() => {}).then(() => {
            return IDBStorage.delete("blob_storage");
        });
    }

    public login(username: string, password: string): Promise<void> {
        const req = new cbor.Writer();
        req.map(3);
        req.string("username");
        req.string(username);
        req.string("password");
        req.string(password);
        req.string("accesslevel");
        req.string("worker");
        req.end();

        return this.request("login", {
            data: req.done(),
        }).then((data) => {
            let success: boolean | undefined;
            let error: string | undefined;
            let tok: string | undefined;

            try {
                const r = new cbor.Reader(data);
                r.map();
                while(true) {
                    const key = r.maybeString();
                    if(key === null) break;
                    if(key === "success") success = r.boolean();
                    else if(key === "error") error = r.string();
                    else if(key === "token") tok = r.string();
                    else r.skip();
                }
                r.end();
            } catch(e) {
                if(e instanceof TypeError) throw new err.Validation(e.message);
                throw e;
            }

            if(!success) {
                throw new err.Runtime(error || "Unknown server error");
            }

            if(tok === undefined) {
                throw new err.Validation("Server provided no token");
            }

            const f = this.on_login;
            if(f === undefined) {
                this.token = Promise.resolve(tok);
            } else {
                delete this.on_login;
                f(tok);
            }
        });
    }

    public setProject(project: string) {
        this.project = project;
    }

    public getProject(): string {
        return this.project;
    }

    public request(path: string, opts: ReqOpts): Promise<ArrayBuffer> {
        const data = opts.data;
        const headers = new Headers();
        if(data !== undefined) headers.set("content-type", "application/cbor");
        const url = this.url + path;
        return fetch(url, {
            method: data === undefined ? "GET" : "POST",
            body: data,
            headers: headers,
            mode: "cors",
            credentials: "omit",
            cache: "no-store",
            redirect: "follow",
        }).then((res) => {
            if(!res.ok) {
                throw new err.Network("HTTP error", {
                    url: url,
                    http_code: res.status,
                });
            }
            return res.arrayBuffer();
        }).then((resp) => {
            return resp;
        });
    }
}

function readBlobRef(r: cbor.Reader, project: string): exec_api.BlobRef {
    r.map();
    let id: string | undefined;
    let size: number | undefined;
    while(true) {
        const key = r.maybeString();
        if(key === null) break;
        else if(key === "id") id = r.string();
        else if(key === "size") size = r.number();
        else r.skip();
    }
    if(id === undefined || size === undefined) throw new TypeError("Invalid blob reference");
    r.end();
    return {id: project + "/" + id, size: size};
}

interface TaskDatum {
    program: exec_api.BlobRef;
    control: Uint8Array;
    blobs: exec_api.BlobRef[];
}

function readTaskDatum(r: cbor.Reader, project: string): TaskDatum {
    let program: exec_api.BlobRef | undefined;
    let control: Uint8Array | undefined;
    let blobs: exec_api.BlobRef[] = [];
    try {
        r.map();
        while(true) {
            const key = r.maybeString();
            if(key === null) break;
            if(key === "program") program = readBlobRef(r, project);
            else if(key === "control") control = r.bytes();
            else if(key === "blobs") blobs = cbut.readArray(r, (rd) => readBlobRef(rd, project));
            else r.skip();
        }
        r.end();
    } catch(e) {
        if(e instanceof TypeError) throw new err.Validation(e.message);
        throw e;
    }
    if(program === undefined || control === undefined) throw new err.Validation("Invalid task");
    return {program: program, control: cbut.own(control), blobs: blobs};
}

class WorkProvider implements exec_api.WorkProvider {
    public tasks_pending_min = 100;
    public tasks_finished_max = 1000;
    public send_max_bytes = 2.0e5;
    public save_timeout = 1000;
    public cache_max = 2.0e8;

    constructor(private readonly ctl: Controller) {}

    private request(path: string, opts: ReqOpts): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const f = () => {
                const pr = this.ctl.request(path, opts);
                pr.then(resolve, reject);
                return pr.then(() => {}, () => {});
            };
            // TODO: data limits
            f();
        });
    }

    public getBlob(name: string, expected_size: number): Promise<Uint8Array> {
        const ix = name.indexOf("/");
        if(ix === -1) return Promise.reject(new err.State("Invalid blob ID"));

        const req = new cbor.Writer();
        req.map(3);
        req.string("pname");
        req.string(name.substr(0, ix));
        req.string("name");
        req.string(name.substr(ix + 1));

        return this.ctl.withToken((token) => {
            req.string("token");
            req.string(token);
            req.end();

            return this.request("getBlob", {
                data: req.done(),
                expect_size: expected_size,
            });
        }).then((data) => {
            let success: boolean | undefined;
            let error: string | undefined;
            let blob: Uint8Array | undefined;

            try {
                const r = new cbor.Reader(data);
                r.map();
                while(true) {
                    const key = r.maybeString();
                    if(key === null) break;
                    else if(key === "success") success = r.boolean();
                    else if(key === "error") error = r.string();
                    else if(key === "blob") blob = r.bytes();
                    else r.skip();
                }
                r.end();
            } catch(e) {
                if(e instanceof TypeError) throw new err.Validation(e.message);
                throw e;
            }

            if(!success) {
                throw new err.Runtime(error || "Unknown server error");
            }

            if(blob === undefined) {
                throw new err.Validation("No blob provided");
            }

            return cbut.own(blob);
        });
    }

    public getTasks(): Promise<exec_api.TaskSet> {
        const project = this.ctl.getProject();

        const req = new cbor.Writer();
        req.map(3);
        req.string("pname");
        req.string(project);
        req.string("maxtasks");
        req.number(500); // TODO: set to something proper.

        return this.ctl.withToken((token) => {
            req.string("token");
            req.string(token);
            req.end();

            return this.request("getTasks", {
                data: req.done(),
            });
        }).then((data): exec_api.TaskSet | Promise<exec_api.TaskSet> => {
            let success: boolean | undefined;
            let error: string | undefined;
            let taskIDs: string[] | undefined;
            let taskData: TaskDatum[] | undefined;

            try {
                const r = new cbor.Reader(data);
                r.map();
                while(true) {
                    const key = r.maybeString();
                    if(key === null) break;
                    if(key === "success") success = r.boolean();
                    else if(key === "error") error = r.string();
                    else if(key === "taskIDs") taskIDs = cbut.readArray(r, (rd) => `${project}/${rd.string()}`);
                    else if(key === "tasks") taskData = cbut.readArray(r, (rd) => readTaskDatum(rd, project));
                    else r.skip();
                }
                r.end();
            } catch(e) {
                if(e instanceof TypeError) throw new err.Validation(e.message);
                throw e;
            }

            if(!success) {
                throw new err.Runtime(error || "Unknown server error");
            }

            if(taskIDs === undefined) throw new err.Validation("taskIDs");
            if(taskData === undefined) throw new err.Validation("tasks missing");

            const n = taskIDs.length;
            if(taskData.length !== n) {
                throw new err.Validation("tasks.length !== taskIDs.length");
            }

            const tasks: exec_api.Task[] = [];

            for(let i = 0; i < n; i += 1) {
                const td = taskData[i];
                tasks.push({
                    id: taskIDs[i],
                    project: project,
                    program: td.program,
                    in_control: td.control,
                    in_blobs: td.blobs,
                });
            }

            if(tasks.length === 0) {
                return new Promise((resolve, reject) => {
                    setTimeout(() => resolve({tasks: tasks}), 5000);
                });
            }

            return {tasks: tasks};
        });
    }

    public sendTasks(tasks: exec_api.TaskResult[]): Promise<void> {
        const by_project_then_id = new Map<string, Map<string, exec_api.TaskResult>>();
        for(const task of tasks) {
            const ix = task.id.indexOf("/");
            if(ix === -1) throw new err.State("Invalid task ID", {task_id: task.id});
            const pname = task.id.substr(0, ix);
            const tname = task.id.substr(ix + 1);

            let by_id = by_project_then_id.get(pname);
            if(by_id === undefined) {
                by_id = new Map();
                by_project_then_id.set(pname, by_id);
            }
            by_id.set(tname, task);
        }

        const req = new cbor.Writer();
        req.map(2);
        req.string("tasks");
        req.map(by_project_then_id.size);

        for(const [pname,by_id] of by_project_then_id) {
            req.string(pname);
            req.map(by_id.size);
            for(const [tname,task] of by_id) {
                req.string(tname);
                if(task.status === "ok") {
                    req.map(2);
                    req.string("status");
                    req.string("ok");
                    req.string("results");
                    cbut.writeArray(req, (w,d) => w.bytes(new Uint8Array(d)), task.data);
                    req.end();
                } else if(task.status === "error") {
                    req.map(2);
                    req.string("status");
                    req.string("error");
                    req.string("error");
                    cbut.writeError(req, task.error);
                    req.end();
                } else {
                    req.map(1);
                    req.string("status");
                    req.string("refused");
                    req.end();
                }
            }
            req.end();
        }
        req.end();

        return this.ctl.withToken((token) => {
            req.string("token");
            req.string(token);
            req.end();

            return this.request("sendTasks", {
                data: req.done(),
            });
        }).then((data) => {
            let success: boolean | undefined;
            let error: string | undefined;

            try {
                const r = new cbor.Reader(data);
                r.map();
                while(true) {
                    const key = r.maybeString();
                    if(key === null) break;
                    if(key === "success") success = r.boolean();
                    else if(key === "error") error = r.string();
                    else r.skip();
                }
                r.end();
            } catch(e) {
                if(e instanceof TypeError) throw new err.Validation(e.message);
                throw e;
            }

            if(!success) {
                throw new err.Runtime(error || "Unknown server error");
            }
        });
    }
}
