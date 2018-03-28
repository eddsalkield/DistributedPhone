import "../../polyfill";

import MockAPI from "../mock_api";
import * as tb from "../test-blobs";
import {arrBuf, compare, runTests, withRunner} from "../test-util";

// import * as api from "../api";
import MemStorage from "../mem_storage";

function wait(ms: number): Promise<void> {
    return new Promise((resolve,reject) => setTimeout(() => resolve(), ms));
}

function testStartStop(): Promise<void> {
    const the_api = new MockAPI();
    const the_storage = new MemStorage();
    return withRunner(the_api, the_storage, (runner) => {
        return wait(1000);
    }).then(() => {
        if(the_api.req_cnt_blob !== 0) throw new Error("Unexpected blob request");
        if(the_api.req_cnt_results !== 0) throw new Error("Unexpected results request");
    });
}

function testRun(): Promise<void> {
    const the_api = new MockAPI();
    the_api.blobs.set("prog-echo", tb.prog_echo);
    the_api.blobs.set("prog-abort", tb.prog_abort);
    the_api.blobs.set("hw", tb.hello_world);

    const want_results = new Map<string, any>();

    the_api.tasks.enqueue({
        id: "echo", project: "", program: "prog-echo",
        in_control: tb.hello_world, in_blobs: [],
    });
    want_results.set("echo", {
        id: "echo", status: "ok",
        control: tb.hello_world, data: [],
    });

    the_api.tasks.enqueue({
        id: "echo-blobs", project: "", program: "prog-echo",
        in_control: arrBuf([42]), in_blobs: ["hw", "hw"],
    });
    want_results.set("echo-blobs", {
        id: "echo-blobs", status: "ok",
        control: arrBuf([42]), data: [tb.hello_world, tb.hello_world],
    });

    the_api.tasks.enqueue({
        id: "abort", project: "", program: "prog-abort",
        in_control: arrBuf([42]), in_blobs: ["hw", "hw","prog-echo"],
    });
    want_results.set("abort", {
        id: "abort", status: "error",
        error: {
            "kind": "runtime",
            "message": "Program abort()",
            "@compare@ignore": true,
        },
    });

    const the_storage = new MemStorage();

    return withRunner(the_api, the_storage, (runner) => {
        return Promise.race([
            the_api.addCondition(() => {
                return the_api.task_cnt >= 3;
            }).then(() => true),
            wait(5000).then(() => false),
        ]);
    }).then((ok) => {
        if(!ok) throw new Error("Timed out");
        if(the_api.req_cnt_results === 0) throw new Error("Expected results");
        if(the_api.task_dup_cnt !== 0) throw new Error("Duplicated task results");
        compare(the_api.results, want_results, "");
    });
}

self.onload = () => {
    runTests([
        testStartStop,
        testRun,
    ]);
};
