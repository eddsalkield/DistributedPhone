import {Data as ErrorData} from "@/err";

export type ErrorData = ErrorData;

export interface BlobRef {
    id: string;
    size: number;
}

export interface Task {
    id: string;
    project: string;
    program: BlobRef;
    in_control: ArrayBuffer;
    in_blobs: BlobRef[];
}

export interface TaskSet {
    tasks: Task[];
}

export interface TaskResultBase {
    id: string;
}

export interface TaskResultOK extends TaskResultBase {
    status: "ok";
    data: ArrayBuffer[];
}

export interface TaskResultError extends TaskResultBase {
    status: "error";
    error: ErrorData;
}

export interface TaskResultRefused extends TaskResultBase {
    status: "refused";
}

export type TaskResult = TaskResultOK | TaskResultError | TaskResultRefused;

export interface BlobProvider {
    // expected_size is provided for accounting purposes.
    getBlob(name: string, expected_size: number): Promise<ArrayBuffer>;

    /* Maximum number of bytes to store. */
    readonly cache_max: number;
}

export interface WorkProvider extends BlobProvider {
    /* The implementation must deal with waiting/backoff in case of network
     * problems. */
    getTasks(): Promise<TaskSet>;
    sendTasks(results: TaskResult[]): Promise<void>;

    /* If the number of tasks available drops below this, request more. */
    readonly tasks_pending_min: number;

    /* Stop requesting more tasks if there are too many finished tasks that
     * haven't been sent yet. */
    readonly tasks_finished_max: number;

    /* Maximum number of bytes (approximately) to send at a time. */
    readonly send_max_bytes: number;

    /* Number of milliseconds after which to save non-important state changes. */
    readonly save_timeout: number;
}
