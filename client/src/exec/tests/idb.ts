import "@/polyfill";

import {arrBuf, compare, runTests, withStat} from "../test-util";

import * as err from "@/err";

import IDBStorage from "../idb_storage";

function withIDB<T>(name: string, f: (s: IDBStorage) => Promise<T>): Promise<T> {
    return withStat((the_stat) => IDBStorage.create(the_stat, name).then((s) => {
        return Promise.resolve(s).then(f).finally(() => s.stop());
    }));
}

const data1 = arrBuf([1]);
const data2 = arrBuf([1,2]);
const data3 = arrBuf([1,2,3]);

function testCreate() {
    return withIDB("test", (s) => {
        return s.list().then((items) => {
            if(items.length !== 0) {
                throw new Error("Expected empty database");
            }
            return;
        });
    });
}

function testReset() {
    return IDBStorage.delete("test");
}

function testSet() {
    return withIDB("test", (s) => {
        return s.set("key1", new Uint8Array(data1)).then(
            () => s.set("key2", new Uint8Array(data2))
        ).then(
            () => s.set("key2", new Uint8Array(data3))
        );
    });
}

function testGet() {
    return withIDB("test", (s) => {
        return s.get("key1").then((data) => {
            compare(data, data1, "");
        }).then(
            () => s.get("key2")
        ).then((data) => {
            compare(data, data3, "");
        }).then(() => {
            return s.get("key3").then(() => {
                throw new Error("Expected `key3` not to exist");
            }, (e) => {
                if(!(e instanceof err.State)) {
                    throw new Error("Expected err.State for nonexistent blob");
                }
            });
        }).then(() => s.list()).then((l) => {
            l.sort((a, b) => {
                if(a.id < b.id) return -1;
                if(a.id > b.id) return 1;
                return 0;
            });
            compare(l, [
                {id: "key1", size: data1.byteLength},
                {id: "key2", size: data3.byteLength},
            ], "");
        });
    });
}

function testDelete() {
    return withIDB("test", (s) => {
        return s.delete("key3").then(
            () => s.delete("key2")
        ).then(
            () => s.delete("key2")
        ).then(() => {
            return s.get("key2").then(() => {
                throw new Error("Expected `key2` not to exist");
            }, (e) => {
                if(!(e instanceof err.State)) {
                    throw new Error("Expected err.State for nonexistent blob");
                }
            });
        }).then(() => {
            return s.get("key1").then(() => {
                return;
            }, (e) => {
                if(e instanceof err.State) {
                    throw new Error("Expected `key1` to exist");
                } else {
                    throw e;
                }
            });
        }).then(() => s.list()).then((l) => {
            compare(l, [
                {id: "key1", size: data1.byteLength},
            ], "");
        }).then(() => s.delete("key1")).then(() => s.list()).then((l) => {
            if(l.length !== 0) {
                throw new Error("Expected empty database");
            }
        });
    });
}

self.onload = () => {
    runTests([
        testReset,
        testCreate,
        testSet,
        testGet,
        testDelete,
        testReset,
    ]);
};
