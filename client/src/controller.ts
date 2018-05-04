import * as exec_api from "@/exec/api";

import * as ui_api from "@/API";

import * as cbor from "@/cbor";
import * as cbut from "@/cbor-util";
import * as err from "@/err";
import * as stat from "@/stat";

import IDBStorage from "@/exec/idb_storage";
import Runner from "@/exec/runner";

class TSDB implements stat.TSDB {
    constructor() {}

    public write(at: number, data: stat.Point[]): void {
        for(const p of data) console.log(p);
    }

    public writeError(at: number, e: err.Data): void {
        console.log(e);
    }
}

interface ReqOpts {
    data?: Uint8Array;
    expect_size?: number;
}

interface UserData {
    readonly name: string;
    readonly token: string;
}

interface Settings {
    project: string | null;
    my_projects: string[];
}

function parseResponse(data: ArrayBuffer, handlers: {[name:string]: ((r: cbor.Reader) => void) | undefined}): void {
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
            else {
                const h = handlers[key];
                if(h === undefined) r.skip();
                else h(r);
            }
        }
        r.end();
    } catch(e) {
        if(e instanceof TypeError) throw new err.Validation(e.message);
        throw e;
    }

    if(!success) {
        throw new err.Runtime(error || "Unknown server error");
    }
}

export class Controller {
    public readonly stat_root: stat.Root;

    public user: UserData | null = null;
    public user_promise!: Promise<UserData>;
    private on_login?: (data: UserData) => void;

    public runner_promise!: Promise<Runner>;
    private on_runner?: (runner: Promise<Runner>) => void;

    private settings_update_promise!: Promise<void>;
    private on_settings_update!: () => void;

    private cfg: Settings = {
        project: null,
        my_projects: [],
    };

    constructor(
        /* Base URL with trailing slash */
        public readonly url: string,
    ) {
        this.stat_root = new stat.Root(new TSDB());
        this.newUserPromise();
        this.newRunnerPromise();
        this.newSettingsUpdatePromise();

        const ls = window.localStorage;
        if(ls.login_data !== undefined) {
            this.on_login!(JSON.parse(ls.login_data));
        }
    }

    private newUserPromise(): void {
        this.user_promise = new Promise((resolve, reject) => {
            this.on_login = (u) => {
                this.user = u;
                window.localStorage.login_data = JSON.stringify(u);
                delete this.on_login;
                resolve(u);
            };
        });
    }

    private newRunnerPromise(): void {
        this.runner_promise = new Promise((resolve, reject) => {
            this.on_runner = (r) => {
                delete this.on_runner;
                r.then((v) => {
                    resolve(v);
                }, reject);
            };
        });
    }

    private newSettingsUpdatePromise(): void {
        this.settings_update_promise = new Promise((resolve, reject) => {
            this.on_settings_update = () => {
                this.newSettingsUpdatePromise();
                resolve();
            };
        });
    }

    public onSettingsUpdate<T>(f: () => Promise<T>): Promise<T> {
        return this.settings_update_promise.then(f);
    }

    public settingsUpdated(): void {
        this.on_settings_update();
    }

    public getProject(): string | null {
        return this.cfg.project;
    }

    public setProject(p: string | null): void {
        if(this.cfg.project === p) return;
        this.cfg.project = p;
        this.settingsUpdated();
    }

    public getMyProjects(): string[] {
        return Array.from(this.cfg.my_projects);
    }

    public setMyProjects(p: string[]): void {
        this.cfg.my_projects = Array.from(p);
        this.settingsUpdated();
    }

    public startExec(): void {
        if(this.on_runner === undefined) return;
        this.on_runner(IDBStorage.create(this.stat_root, "blob_storage").then((storage) => {
            return Runner.create(this.stat_root, new WorkProvider(this), storage);
        }));
    }

    public withUser<T>(f: (login: UserData) => Promise<T>): Promise<T> {
        return this.user_promise.then(f);
    }

    public withToken<T>(f: (token: string) => Promise<T>): Promise<T> {
        return this.withUser((l) => {
            return f(l.token);
        });
    }

    public withRunner<T>(f: (r: Runner) => Promise<T>): Promise<T> {
        return this.runner_promise.then(f);
    }

    public resetExec(): Promise<void> {
        if(this.on_runner !== undefined) {
            return IDBStorage.delete("blob_storage");
        }
        return this.runner_promise.then((r) => {
            this.newRunnerPromise();
            return r.stop();
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
            let tok: string | undefined;

            parseResponse(data, {
                "token": (r) => {
                    tok = r.string();
                },
            });

            if(tok === undefined) {
                throw new err.Validation("Server provided no token");
            }

            if(this.on_login === undefined) {
                throw new err.State("Already logged in");
            }

            this.on_login({
                name: username,
                token: tok,
            });
        });
    }

    public logout(): void {
        const ud = this.user;
        if(ud === null) return;

        delete window.localStorage.login_data;
        this.user = null;
        this.newUserPromise();

        const req = new cbor.Writer();
        req.map(1);
        req.string("token");
        req.string(ud.token);
        req.end();

        this.request("logout", {
            data: req.done(),
        });
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

function readTask(project: string, id: string, data: Uint8Array): exec_api.Task {
    let program: exec_api.BlobRef | undefined;
    let control: Uint8Array | undefined;
    let blobs: exec_api.BlobRef[] = [];

    try {
        const r = new cbor.Reader(data);
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

    return {
        id: `${project}/${id}`,
        project: project,
        program: program,
        in_control: control,
        in_blobs: blobs,
    };
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
            let blob: Uint8Array | undefined;
            parseResponse(data, {
                "blob": (r) => {
                    blob = r.bytes();
                },
            });

            if(blob === undefined) {
                throw new err.Validation("No blob provided");
            }

            return cbut.own(blob);
        });
    }

    public getTasks(): Promise<exec_api.TaskSet> {
        const project = this.ctl.getProject();
        if(project === null) {
            return this.ctl.onSettingsUpdate(() => {
                return this.getTasks();
            });
        }

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
            let taskIDs: string[] | undefined;
            let taskBlobs: Uint8Array[] | undefined;
            parseResponse(data, {
                "taskIDs": (r) => {
                    taskIDs = cbut.readArray(r, (rd) => rd.string());
                },
                "tasks": (r) => {
                    taskBlobs = cbut.readArray(r, (rd) => rd.bytes());
                },
            });

            if(taskIDs === undefined) throw new err.Validation("taskIDs");
            if(taskBlobs === undefined) throw new err.Validation("tasks missing");

            const n = taskIDs.length;
            if(taskBlobs.length !== n) {
                throw new err.Validation("tasks.length !== taskIDs.length");
            }

            const tasks: exec_api.Task[] = [];
            for(let i = 0; i < n; i += 1) {
                tasks.push(readTask(project, taskIDs[i], taskBlobs[i]));
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
            parseResponse(data, {});
        });
    }
}

type ProjectMap = Map<string, ui_api.Project>;

export class UIState implements ui_api.ClientStateInterface {
    constructor(public readonly ctl: Controller) {}

    // TODO: implement
    public get ChargingOnly() {
        return false;
    }
    public get AllowDataUsage() {
        return true; // this.ctl.cfg.allow_mobile_data;
    }
    // TODO: decode name
    public get NewProjectMyProjectsID() {
        return "Fibonacci counter";
    }


    public get ProjectChoiceID() {
        return this.ctl.getProject();
    }
    public get IsLoggedIn() {
        return this.ctl.user !== null;
    }

    public login(username: string, password: string): Promise<void> {
        return this.ctl.login(username, password);
    }
    public loginGuest(): Promise<void> {
        return Promise.reject(new err.Runtime("Not implemented"));
    }
    public logout(): Promise<void> {
        try {
            this.ctl.logout();
            return Promise.resolve();
        } catch(e) {
            return Promise.reject(e);
        }
    }

    public SignUp(username: string, password:string): Promise<void> {
        const req = new cbor.Writer();
        req.map(3);
        req.string("username");
        req.string(username);
        req.string("password");
        req.string(password);
        req.string("accesslevel");
        req.string("worker");
        req.end();

        return this.ctl.request("register", {
            data: req.done(),
        }).then((data) => {
            parseResponse(data, {});
            // Hope login succeeds.
            return this.login(username, password);
        });
    }

    private requestProjects(): Promise<ProjectMap> {
        const ud = this.ctl.user;
        if(ud === null) return Promise.reject(new err.State("Not logged in"));

        const req = new cbor.Writer();
        req.map(1);
        req.string("token");
        req.string(ud.token);
        req.end();

        return this.ctl.request("getProjectsList", {
            data: req.done(),
        }).then((data) => {
            const ps: ProjectMap = new Map();
            parseResponse(data, {
                "projects": (r) => {
                    r.map();
                    while(true) {
                        const name = r.maybeString();
                        if(name === null) break;
                        let desc: string = name;
                        r.map();
                        while(true) {
                            const key = r.maybeString();
                            if(key === null) break;
                            if(key === "description") desc = r.string();
                            else r.skip();
                        }
                        r.end();

                        ps.set(name, {
                            Title: name,
                            Description: desc,
                        });
                    }
                    r.end();
                },
            });

            return ps;
        });
    }

    private cached_projects?: ProjectMap;
    private cached_projects_promise?: Promise<ProjectMap>;
    private cached_projects_expiry: number = 0; // timestamp in milliseconds
    // If not refresh, try returning soon (1 second if a request is already
    // happening, immediately otherwise). If refresh, send a request unless one
    // is pending.
    private getProjects(refresh: boolean): Promise<ProjectMap> {
        let pr = this.cached_projects_promise;
        let cached = this.cached_projects;

        if(cached !== undefined) {
            const now = new Date().getTime();
            if(now > this.cached_projects_expiry) {
                cached = undefined;
                delete this.cached_projects;
            }
        }

        if(pr === undefined) {
            if(!refresh && cached !== undefined) return Promise.resolve(cached);

            pr = this.requestProjects().then((pmap) => {
                delete this.cached_projects_promise;
                this.cached_projects = pmap;
                this.cached_projects_expiry = new Date().getTime() + 3600 * 1000;
                return pmap;
            }, (e) => {
                delete this.cached_projects_promise;
                throw e;
            });

            this.cached_projects_promise = pr;
        }

        if(!refresh && cached === undefined) return pr;

        return Promise.race([pr, new Promise<ProjectMap>((resolve, reject) => {
            setTimeout(() => {
                resolve(cached);
            }, 1000);
        })]);
    }

    public ListOfAllProjects(): Promise<ui_api.Project[]> {
        return this.getProjects(true).then((ps) => {
            return Array.from(ps.values());
        });
    }

    public ListOfMyProjects(): Promise<ui_api.Project[]> {
        return this.getProjects(false).then((pmap) => {
            const ps: ui_api.Project[] = [];
            for(const pid of this.ctl.getMyProjects()) {
                const p = pmap.get(pid);
                if(p !== undefined) ps.push(p);
            }
            return ps;
        });
    }
}
