import "@/polyfill";

import * as err from "@/err";
import * as stat from "@/stat";

import {releaser, runTests, withStat} from "../test-util";

import * as wd from "../work-dispatcher";
import * as workapi from "../workapi";

const test_worker = new Blob([`
let onControl = null;
let work_name = null;
let work_data = null;
let work_i = null;
function onWork() {
    while(work_i < work_data.length) {
        const cmd = work_data[work_i];
        work_i += 1;
        if(cmd === "done") {
            postMessage({result: {
                control: new ArrayBuffer(0),
                data: [],
            }});
        } else if(cmd === "fail") {
            postMessage({error: {
                kind: "validation",
                message: "Test task failed",
            }});
        } else if(cmd == "error") {
            throw new Error("Test task error");
        } else if(cmd == "started") {
            postMessage({control: {notify_started: null}});
        } else if(cmd == "sleep") {
            const timeout = Number(work_data[work_i]);
            work_i += 1;
            setTimeout(onWork, timeout);
            return;
        } else if(cmd == "loop") {
            while(true) {}
        } else if(cmd == "req-blob") {
            const name = work_data[work_i];
            postMessage({control: {get_blob: {id: name, size: 1}}});
        } else if(cmd == "get-blob") {
            const name = work_data[work_i];
            onControl = (ctl) => {
                if(!ctl.get_blob) throw new Error("Expected get_blob input");
                if(ctl.get_blob[0] !== name) throw new Error("Expected different get_blob name");
                onControl = null;
                onWork();
            };
            return;
        }
    }
    work_name = null;
    work_data = null;
    work_i = null;
}

onmessage = (event) => {
    const msg = event.data;
    if(msg.work) {
        if(work_name != null) throw new Error("Task already running");
        work_name = msg.work.program.id;
        work_data = msg.work.data.map((ref) => ref.id);
        work_i = 0;
        onWork();
    } else if(msg.control) {
        onControl(msg.control)
    }
}`]);

function withWD<T>(f: (d: wd.Dispatcher) => Promise<T>): Promise<T> {
    return withStat((st: stat.Sink) => {
        return f(new wd.Dispatcher(st, test_worker));
    });
}

function steps(name: string, ...steps: string[]): workapi.InWork {
    return {
        program: {id: name, size: 0},
        control: new ArrayBuffer(0),
        data: steps.map((s) => ({id: s, size: 0})),
    };
}

function testTask() {
    return withWD<void>(async (wd) => {
        const [prFail, fail] = releaser<Error>();
        const [pr0, res0] = releaser();
        const [pr1, res1] = releaser();
        const [pr2, res2] = releaser();

        wd.push({
            onStart() {},
            onDone(res: workapi.OutResult) {
                res0();
            },
            onError(e: Error) {
                fail(e);
            },
            onControl(out: workapi.OutControl) {
                return false;
            }
        }, steps("ok", "done"), []);

        wd.push({
            onStart() {},
            onDone(res: workapi.OutResult) {
                fail(new Error("Expected task to fail"));
            },
            onError(e: Error) {
                if(!(e instanceof err.Validation)) fail(e);
                else res1();
            },
            onControl(out: workapi.OutControl) {
                return false;
            }
        }, steps("fail", "fail"), []);

        wd.push({
            onStart() {},
            onDone(res: workapi.OutResult) {
                fail(new Error("Expected task to error"));
            },
            onError(e: Error) {
                if(!(e instanceof err.Runtime)) fail(e);
                else res2();
            },
            onControl(out: workapi.OutControl) {
                return false;
            }
        }, steps("error", "error"), []);

        await Promise.race([prFail.then((e) => {throw e;}), Promise.all([
            pr0, pr1, pr2
        ])]);
    });
}

function testControl() {
    return withWD<void>(async (wd) => {
        const [prFail, fail] = releaser<Error>();
        const [pr0, res0] = releaser();
        const [pr1, res1] = releaser();
        const [pr2, res2] = releaser();

        let notified = false;
        wd.push({
            onStart() {},
            onDone(res: workapi.OutResult) {
                if(!notified) {
                    fail(new Error("Expected task to send notify_started"));
                }
                res0();
            },
            onError(e: Error) {
                fail(e);
            },
            onControl(out: workapi.OutControl) {
                if(out.notify_started !== undefined) {
                    notified = true;
                    return true;
                }
                return false;
            }
        }, steps("control-notify_started", "started", "done"), []);

        wd.push({
            onStart() {},
            onDone(res: workapi.OutResult) {
                fail(new Error("Expected task to be killed"));
            },
            onError(e: Error) {
                if(!(e instanceof err.Runtime)) fail(e);
                else res1();
            },
            onControl(out: workapi.OutControl) {
                console.log("kill");
                return false;
            }
        }, steps("control-fail", "req-blob", "1", "get-blob", "done"), []);

        let state = 0;
        const ctl2 = wd.push({
            onStart() {},
            onDone(res: workapi.OutResult) {
                if(state !== 3) fail(new Error("Expected task to request blobs"));
                res2();
            },
            onError(e: Error) {
                fail(e);
            },
            onControl(out: workapi.OutControl) {
                if(out.get_blob !== undefined) {
                    if(state === 0) {
                        if(out.get_blob.id !== "1") fail(new Error("Expected different request"));
                        state = 1;
                    } else if(state === 1) {
                        if(out.get_blob.id !== "2") fail(new Error("Expected different request"));
                        state = 2;
                        self.setTimeout(() => {
                            ctl2.sendControl({get_blob: ["2", new ArrayBuffer(0)]}, []);
                            ctl2.sendControl({get_blob: ["1", new ArrayBuffer(0)]}, []);
                            state = 3;
                        }, 200);
                    } else {
                        fail(new Error("Too many requests"));
                    }
                    return true;
                }
                return false;
            }
        }, steps("control-get_blob", "req-blob", "1", "req-blob", "2", "get-blob", "2", "get-blob", "1", "done"), []);

        await Promise.race([prFail.then((e) => {throw e;}), Promise.all([
            pr0, pr1, pr2
        ])]);
    });
}

function testCancel() {
    return withWD<void>(async (wd) => {
        const [prFail, fail] = releaser<Error>();
        const [pr0, res0] = releaser();
        const [pr1, res1] = releaser();
        const [pr2, res2] = releaser();

        const ctl0 = wd.push({
            onStart() {},
            onDone(res: workapi.OutResult) {
                res0();
            },
            onError(e: Error) {
                fail(e);
            },
            onControl(out: workapi.OutControl) {
                return false;
            }
        }, steps("ok", "done"), []);

        const ctl1 = wd.push({
            onStart() {},
            onDone(res: workapi.OutResult) {
                fail(new Error("Expected cancellation"));
            },
            onError(e: Error) {
                if(!(e instanceof err.Cancelled)) fail(e);
                else res1();
            },
            onControl(out: workapi.OutControl) {
                return false;
            }
        }, steps("hang"), []);

        const ctl2 = wd.push({
            onStart() {},
            onDone(res: workapi.OutResult) {
                fail(new Error("Expected cancellation"));
            },
            onError(e: Error) {
                if(!(e instanceof err.Cancelled)) fail(e);
                else res2();
            },
            onControl(out: workapi.OutControl) {
                return false;
            }
        }, steps("immediate-cancel", "done"), []);

        self.setTimeout(() => {
            ctl0.kill(new err.Cancelled("Cancelled 0"));
            ctl1.kill(new err.Cancelled("Cancelled 1"));
        }, 200);

        ctl2.kill(new err.Cancelled("Cancelled 0"));

        await Promise.race([prFail.then((e) => {throw e;}), Promise.all([
            pr0, pr1, pr2
        ])]);
    });
}

self.onload = () => {
    runTests([
        testTask,
        testControl,
        testCancel,
    ]);
};
