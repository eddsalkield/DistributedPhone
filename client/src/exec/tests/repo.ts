import "@/polyfill";

import * as err from "@/err";
import * as stat from "@/stat";

import {runTests, withStat} from "../test-util";

import MemStorage from "../mem_storage";
import MockAPI from "../mock_api";

import {BlobRepo} from "../repo";
import {Ref} from "../storage";

function ref(size: number, ix: number): Ref {
    return {
        id: `remote/${size}/${ix}`,
        size: size,
    };
}

function releaser(): [Promise<void>, () => void] {
    let release!: () => void;
    const pr = new Promise<void>((resolve, reject) => {
        release = resolve;
    });
    return [pr, release!];
}

async function asyncSleep(ms: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        self.setTimeout(() => resolve(), ms);
    });
}

function env(): <T>(wrapped: (the_repo: BlobRepo, the_api: MockAPI) => Promise<T>) => Promise<T> {
    const the_api = new MockAPI(null);
    for(let size = 1; size < 100; size += 1) {
        const data = new ArrayBuffer(size);
        for(let ix = 0; ix < 100; ix += 1) {
            the_api.blobs.set(`${size}/${ix}`, data);
        }
    }

    const the_storage = new MemStorage();

    return <T>(wrapped: (the_repo: BlobRepo, the_api: MockAPI) => Promise<T>) => withStat((st: stat.Sink) => {
        return BlobRepo.create(st, the_api, the_storage).then((the_repo) => {
            return wrapped(the_repo, the_api);
        });
    });
}

async function testRepoCreateEmpty(): Promise<void> {
    const wrap = env();
    await wrap(async (repo, api) => {});
}

async function testRepoDownload(): Promise<void> {
    const wrap = env();
    await wrap(async (repo, api) => {
        await repo.withBlobs<void>(
            [ref(1, 0), ref(1, 1), ref(2, 0)],
            async () => {},
        );
        if(repo.cache_used !== 4) {
            throw new Error(`Expected 4 bytes used, got ${repo.cache_used}`);
        }

        await repo.withBlobs<void>(
            [ref(1, 1)],
            async () => {},
        );
        if(repo.cache_used !== 4) {
            throw new Error(`Expected 4 bytes used, got ${repo.cache_used}`);
        }

        await repo.withBlobs<void>(
            [ref(1, 0), ref(2, 1)],
            async () => {},
        );
        // BUG: TypeScript doesn't know that await is asynchronous.
        if(repo.cache_used as number !== 6) {
            throw new Error(`Expected 6 bytes used, got ${repo.cache_used}`);
        }
    });
}

async function testRepoLimit(): Promise<void> {
    const wrap = env();
    await wrap(async (repo, api) => {
        api.cache_max = 10;
        try {
            await repo.withBlobs<void>(
                [ref(5, 0), ref(6, 0)],
                async () => {},
            );
            throw new Error(`Expected 11-byte download to fail when the limit is 10`);
        } catch(e) {
            if(!(e instanceof err.Cancelled)) throw e;
        }
    });
}

async function testRepoEvict(): Promise<void> {
    const wrap = env();
    await wrap(async (repo, api) => {
        api.cache_max = 10;

        repo.withBlobs<void>(
            [ref(4, 0)],
            async () => {
                await asyncSleep(200);
            },
        );

        const [pr_release, release] = releaser();

        let expecting = 2;
        const [pr_go, go] = releaser();

        repo.withBlobs<void>(
            [ref(4, 1)],
            () => {
                expecting -= 1;
                if(expecting === 0) go();
                return pr_release;
            }
        );

        repo.withBlobs<void>(
            [ref(4, 2)],
            () => {
                expecting -= 1;
                if(expecting === 0) go();
                return pr_release;
            }
        );

        await pr_go;

        if((repo.storage as MemStorage).blobs.get(ref(4, 0).id) !== undefined) {
            throw new Error("Expected remote/4/0 to have been evicted");
        }

        let done: number = 0;

        const [pr_cancel, cancel] = releaser();

        const pr1 = repo.withBlobs<void>(
            [ref(4, 0)],
            async () => {
                done += 1;
            },
            pr_cancel.then(() => new err.Cancelled("Request cancelled")),
        );

        const pr2 = repo.withBlobs<void>(
            [ref(1, 0)],
            async () => {
                done += 1;
            },
        );

        const pr3 = repo.withBlobs<void>(
            [ref(4, 0)],
            async () => {
                done += 1;
            },
        );

        await asyncSleep(200);
        if(done !== 0) {
            throw new Error("Expected blocked download to block the following ones");
        }

        cancel();

        try {
            await pr1;
            throw new Error("Expected request to be cancelled");
        } catch(e) {
            if(!(e instanceof err.Cancelled)) throw e;
        }

        await pr2;

        await asyncSleep(200);
        // BUG: TypeScript doesn't know that await is asynchronous.
        if(done as number !== 1) {
            throw new Error("Expected over-limit download to block");
        }

        release();
        await pr3;
    });
}

self.onload = () => {
    runTests([
        testRepoCreateEmpty,
        testRepoDownload,
        testRepoLimit,
        testRepoEvict,
    ]);
};
