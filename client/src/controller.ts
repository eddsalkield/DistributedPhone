import * as exec_api from "@/exec/api";

import * as ui_api from "@/API";

import * as cbor from "@/cbor";
import * as cbut from "@/cbor-util";
import {Device} from "@/device";
import * as err from "@/err";
import * as obs from "@/obs";
import * as stat from "@/stat";

import IDBStorage from "@/exec/idb_storage";
import Runner from "@/exec/runner";

interface ReqOpts {
    data?: Uint8Array;
    expect_size?: number;
}

type Settings = ui_api.Settings;
type Project = ui_api.Project;

function parseResponse(data: ArrayBuffer, handlers: {[name: string]: ((r: cbor.Reader) => void) | undefined}): void {
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

const DEFAULT_SETTINGS: Settings = {
    allow_mobile_data: true,
    allow_on_battery: true,
    projects: [],
};

export class Controller {
    public readonly stat_root: stat.Root;

    public readonly user = new obs.Subject<User | null>();

    constructor(
        /* Base URL with trailing slash */
        public readonly url: string,
        public readonly device: Device,
    ) {
        this.stat_root = new stat.Root({
            write: (at: number, data: stat.Point[]): void => {
                const ud = this.user.value;
                if(!ud) return;
                for(const p of data) ud.onStat(p[0], p[1], p[2]);
            },
            writeError: (at: number, e: err.Data): void => {
                console.error(e);
            },
        });

        const login_data = window.localStorage.login_data;
        if(login_data === undefined) {
            this.user.next(null);
        } else {
            this.user.next(User.fromJSON(this, login_data));
        }

        obs.switchMap(this.user, (ud): obs.Observable<string | undefined> => {
            if(ud === null) {
                return obs.single(undefined);
            } else {
                return ud.as_json;
            }
        }).subscribe((v) => {
            if(v) window.localStorage.login_data = v;
            else delete window.localStorage.login_data;
        }).start();
    }

    public reset(): Promise<void> {
        return obs.first(this.user).then((u) => {
            if(u !== undefined && u !== null) return u.logout();
            else return Promise.resolve();
        }).finally(() => IDBStorage.delete("blob_storage"));
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

            this.user.next(new User(this, username, tok, DEFAULT_SETTINGS));
        });
    }

    public loggedOut(): void {
        this.user.next(null);
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
        });
    }

    public requestGraphs(query: string): Promise<ui_api.Graphs> {
        const headers = new Headers();
        const url = `${this.url}getGraphs?${query}`;
        return fetch(url, {
            method: "POST",
            body: null,
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
            return res.json();
        }).then((v) => {
            if(!v.success) throw new err.Network(v.error);
            return v.graphs;
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
    public tasks_pending_min = 10;
    public tasks_finished_max = 100;
    public send_max_bytes = 2.0e5;
    public save_timeout = 1000;
    public cache_max = 2.0e8;

    private req_q: Array<() => void> = [];
    private _paused: boolean = false;
    private _stopped: boolean = false;

    private readonly cfg: obs.Cache<Settings>;

    constructor(
        private readonly ctl: Controller,
        cfg: obs.Observable<Settings>,
        private readonly token: string,
    ) {
        this.cfg = new obs.Cache(cfg);
    }

    public get paused() {
        return this._paused;
    }

    public set paused(v: boolean) {
        if(v) {
            if(this._stopped) return;
            this._paused = true;
        } else {
            if(!this._paused) return;
            this._paused = false;
            const r = this.req_q.splice(0);
            for(const f of r) f();
        }
    }

    public stop(): void {
        this.cfg.complete();
        this._stopped = true;
        this.paused = false;
    }

    private request(path: string, opts: ReqOpts): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const f = () => {
                if(this._stopped) {
                    reject(new err.Network("Stopping WorkProvider"));
                    return;
                }
                try {
                    resolve(this.ctl.request(path, opts));
                } catch(e) {
                    reject(e);
                }
            };
            if(this.paused) {
                this.req_q.push(f);
            } else {
                f();
            }
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
        req.string("token");
        req.string(this.token);
        req.end();

        return this.request("getBlob", {
            data: req.done(),
            expect_size: expected_size,
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
        return obs.first(obs.filter(this.cfg, (c) => c.projects.length !== 0)).then((c) => {
            if(c === undefined) return Promise.resolve({tasks: []});
            const p = c.projects;
            return this._getTasks(p[Math.floor(Math.random() * p.length)]);
        });
    }

    private _getTasks(project: string): Promise<exec_api.TaskSet> {
        const req = new cbor.Writer();
        req.map(3);
        req.string("pname");
        req.string(project);
        req.string("maxtasks");
        req.number(50); // TODO: set to something proper.
        req.string("token");
        req.string(this.token);
        req.end();
        return this.request("getTasks", {
            data: req.done(),
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
                    const tm = self.setTimeout(() => {
                        resolve({tasks: tasks});
                        sub.stop();
                    }, 5000);
                    const fin = () => {
                        self.clearTimeout(tm);
                        resolve({tasks: tasks});
                        sub.stop();
                    };
                    const sub = this.cfg.subscribe(undefined, fin, fin);
                    sub.start();
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
        req.string("token");
        req.string(this.token);
        req.end();
        return this.request("sendTasks", {
            data: req.done(),
        }).then((data) => {
            parseResponse(data, {});
        });
    }
}

interface RunnerData {
    readonly runner: Runner;
    stop(): Promise<void>;
}

const enum RunnerState {
    STOPPED = 0,
    STOPPING = 1,
    STARTING = 2,
    RUNNING = 3,
}

export class User implements ui_api.User {
    public readonly projects = new obs.Cache<Map<string, Project>>();
    public readonly settings: obs.Subject<Settings>;
    public readonly overview = new obs.Subject<string[]>();
    public readonly as_json: obs.Observable<string>;

    private runner_promise: Promise<RunnerData> | null = null;
    private runner_stop_promise: Promise<void> = Promise.resolve();
    private runner_state: RunnerState = RunnerState.STOPPED;

    constructor(
        private readonly ctl: Controller,
        public readonly username: string,
        public readonly token: string,
        settings: Settings,
    ) {
        this.settings = new obs.Subject(settings);

        this.projects.attach(obs.filter<Map<string,Project>, Map<string,Project> | null>(obs.refresh(
            () => this.requestProjects().catch((e) => null),
            3600 * 1000
        ), (v): v is Map<string,Project> => v !== null));

        this.as_json = new obs.Cache(obs.map(this.settings, (s) => {
            return JSON.stringify({
                "username": this.username,
                "token": this.token,
                "settings": {
                    "allow_mobile_data": s.allow_mobile_data,
                    "allow_on_battery": s.allow_on_battery,
                    "projects": s.projects,
                },
            });
        }));

        this.startExec();
    }

    public static fromJSON(ctl: Controller, data: string): User {
        const d = JSON.parse(data);
        const settings = Object.assign({}, DEFAULT_SETTINGS);
        const s2 = d["settings"];
        if(s2) {
            if(s2["allow_mobile_data"]) settings.allow_mobile_data = true;
            if(s2["allow_on_battery"]) settings.allow_on_battery = true;
            if(s2["projects"]) settings.projects = Array.from(s2["projects"]);
        }
        return new User(ctl, d["username"], d["token"], settings);
    }

    public stop(): Promise<void> {
        return this.stopExec().catch((e) => this.ctl.stat_root.reportError(e));
    }

    public logout(): Promise<void> {
        const req = new cbor.Writer();
        req.map(1);
        req.string("token");
        req.string(this.token);
        req.end();

        return Promise.all([
            this.stop(),
            this.ctl.request("logout", {
                data: req.done(),
            }).then((data) => {
                parseResponse(data, {});
            }).catch((e) => this.ctl.stat_root.reportError(e)),
        ]).then(() => {
            this.ctl.loggedOut();
        });
    }

    private startExec(): Promise<Runner> {
        let pr = this.runner_promise;
        if(pr === null) {
            this.runner_promise = pr = this.runner_stop_promise.catch(() => {}).then(
                () => IDBStorage.create(this.ctl.stat_root, "blob_storage")
            ).then((storage) => {
                const wp = new WorkProvider(this.ctl, this.settings, this.token);
                return Runner.create(this.ctl.stat_root, wp, storage, this.token).then((r) => {
                    const dev = this.ctl.device;
                    const obs_block_work = obs.switchMap(this.settings, (s) => {
                        if(s.allow_on_battery) return obs.single(false);
                        else return dev.on_battery;
                    });
                    const obs_block_download = obs.switchMap(this.settings, (s) => {
                        if(s.allow_mobile_data) return obs.single(false);
                        else return dev.on_mobile_data;
                    });

                    this.have_battery = true;
                    this.have_network = true;

                    const subs = [
                        obs_block_work.subscribe((v) => {
                            this.ov_work_paused = v;
                            this.makeOverview();
                            r.paused = v;
                        }, () => {
                            this.ov_work_paused = false;
                            this.have_battery = false;
                            this.makeOverview();
                            r.paused = false;
                        }),
                        obs_block_download.subscribe((v) => {
                            this.ov_dl_paused = v;
                            this.makeOverview();
                            wp.paused = v;
                        }, () => {
                            this.ov_dl_paused = false;
                            this.have_network = false;
                            this.makeOverview();
                            wp.paused = false;
                        }),
                    ];

                    for(const sub of subs) sub.start();

                    this.runner_state = RunnerState.RUNNING;
                    this.makeOverview();

                    return {
                        runner: r,
                        stop() {
                            for(const sub of subs) sub.stop();
                            wp.stop();
                            return r.stop().finally(() => {
                                storage.stop();
                            });
                        },
                    };
                });
            });

            this.runner_state = RunnerState.STARTING;
            this.makeOverview();
        }
        return pr.then((rd) => rd.runner);
    }

    private stopExec(): Promise<void> {
        const rpr = this.runner_promise;
        if(rpr === null) return this.runner_stop_promise;
        this.runner_promise = null;

        return this.runner_stop_promise = rpr.then((r) => {
            this.runner_state = RunnerState.STOPPING;
            this.makeOverview();

            return r.stop();
        }).finally(() => {
            this.runner_state = RunnerState.STOPPED;
            this.makeOverview();
        });
    }

    private requestProjects(): Promise<Map<string, Project>> {
        const ud = this.ctl.user.value;
        if(ud === null) return Promise.reject(new err.State("Not logged in"));

        const req = new cbor.Writer();
        req.map(1);
        req.string("token");
        req.string(ud.token);
        req.end();
        return this.ctl.request("getProjectsList", {
            data: req.done(),
        }).then((data) => {
            const ps = new Map<string, Project>();
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
                            id: name,
                            title: name,
                            description: desc,
                        });
                    }
                    r.end();
                },
            });

            return ps;
        });
    }

    public updateSettingsF(f: (c: Settings) => Settings) {
        this.settings.next(f(this.settings.value));
    }

    public updateSettings(upd: Partial<Settings>): void {
        this.updateSettingsF((c) => Object.assign({}, c, upd));
    }

    public setProjectOn(name: string): void {
        this.updateSettingsF((c) => {
            return Object.assign({}, c, {
                projects: [name].concat(c.projects),
            });
        });
    }

    public requestGraphs(query: string): Promise<ui_api.Graphs> {
        return this.ctl.requestGraphs(query);
    }

    public setProjectOff(name: string): void {
        this.updateSettingsF((c) => {
            let proj = c.projects;
            const ix = proj.indexOf(name);
            if(ix === -1) return c;
            proj = Array.from(proj);
            proj.splice(ix, 1);
            return Object.assign({}, c, {
                projects: proj,
            });
        });
    }

    public refreshProjects(): Promise<void> {
        this.projects.reset();
        // TODO: get actual promise
        return Promise.resolve();
    }

    public onStat(name: string, key: stat.Key, value: number) {
        if(name === "runner/tasks_pending") {
            this.ov_tasks_pending = value;
        } else if(name === "runner/tasks_finished") {
            this.ov_tasks_finished = value;
        } else if(name === "runner/tasks_sent") {
            this.ov_tasks_sent = value;
        } else if(name === "runner/tasks_running") {
            this.ov_tasks_running = value;
        } else if(name === "work_dispatcher/work_queue_size") {
            this.ov_tasks_ready = value;
        } else {
            return;
        }
        this.makeOverview();
    }

    private have_battery: boolean = false;
    private have_network: boolean = false;
    private ov_work_paused: boolean = false;
    private ov_dl_paused: boolean = false;
    public ov_tasks_pending: number = 0;
    public ov_tasks_ready: number = 0;
    public ov_tasks_finished: number = 0;
    public ov_tasks_sent: number = 0;
    public ov_tasks_running: number = 0;

    private makeOverview(): void {
        const ov: string[] = [];
        switch(this.runner_state) {
            case RunnerState.STARTING:
                ov.push("State: Starting up");
                break;
            case RunnerState.RUNNING:
                ov.push("State: Ready");
                break;
            case RunnerState.STOPPING:
                ov.push("State: Stopping");
                break;
            case RunnerState.STOPPED:
                ov.push("State: Stopped");
                break;
        }
        if(!this.have_battery) {
            ov.push("Battery status not available");
        }
        if(this.ov_work_paused) {
            ov.push("On battery; not working");
        }
        if(!this.have_network) {
            ov.push("Network status not available");
        }
        if(this.ov_dl_paused) {
            ov.push("On mobile data; not requesting work");
        }
        ov.push(`Tasks waiting: ${this.ov_tasks_pending - this.ov_tasks_ready - this.ov_tasks_running}`);
        ov.push(`Tasks ready to run: ${this.ov_tasks_ready}`);
        ov.push(`Tasks in send queue: ${this.ov_tasks_finished}`);
        ov.push(`Tasks sent: ${this.ov_tasks_sent}`);

        if(process.env.NODE_ENV === "development") {
            ov.push(`navigator.connection: ${(window.navigator as any).connection}`);
            ov.push(`navigator.mozConnection: ${(window.navigator as any).mozConnection}`);
            ov.push(`navigator.webkitConnection: ${(window.navigator as any).webkitConnection}`);
            ov.push(`navigator.battery: ${(window.navigator as any).battery}`);
            ov.push(`navigator.mozBattery: ${(window.navigator as any).mozBattery}`);
            ov.push(`navigator.webkitBattery: ${(window.navigator as any).webkitBattery}`);
            ov.push(`navigator.getBattery: ${(window.navigator as any).getBattery}`);
            ov.push(`navigator.mozGetBattery: ${(window.navigator as any).mozGetBattery}`);
            ov.push(`navigator.webkitGetBattery: ${(window.navigator as any).webkitGetBattery}`);
        }
        this.overview.next(ov);
    }
}

export class UIState implements ui_api.ClientState {
    public get user() {
        return this.ctl.user;
    }

    constructor(public readonly ctl: Controller) {}

    public login(username: string, password: string): Promise<void> {
        return this.ctl.login(username, password);
    }

    public loginGuest(): Promise<void> {
        const alphabet = "abcdefghijklmnopqrstuvwxyz";

        let username = "guest-";
        for(let i = 0; i < 10; i++) {
            username += alphabet[Math.floor(Math.random() * alphabet.length)];
        }

        let password = "";
        for(let i = 0; i < 40; i++) {
            password += alphabet[Math.floor(Math.random() * alphabet.length)];
        }

        return this.signUp(username, password);
    }

    public signUp(username: string, password: string): Promise<void> {
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

    public reset(): Promise<void> {
        return this.ctl.reset();
    }
}
