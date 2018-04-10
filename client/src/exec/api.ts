import {Data as ErrorData} from "../err";

export type ErrorData = ErrorData;

export interface Task {
    id: string;
    project: string;
    program: string;
    in_control: ArrayBuffer;
    in_blobs: string[];
}

export interface BlobInfo {
    size: number;
}

export interface TaskSet {
    tasks: Task[];
    blob_info: Map<string, BlobInfo>;
}

export interface TaskResultBase {
    id: string;
}

export interface TaskResultOK extends TaskResultBase {
    status: "ok";
    control: ArrayBuffer;
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

export interface WorkProvider {
    /* The implementation must deal with waiting/backoff in case of network
     * problems. */
    getBlob(name: string): Promise<ArrayBuffer>;
    getTasks(): Promise<TaskSet>;
    sendTasks(results: TaskResult[]): Promise<void>;

    // Number of workers.
    readonly workers: number;

    // If the number of tasks available drops below this, request more.
    readonly tasks_pending_min: number;

    // Stop requesting more tasks if there are too many finished tasks that
    // haven't been sent yet.
    readonly tasks_finished_max: number;

    // Maximum number of bytes (approximately) to send at a time.
    readonly send_max_bytes: number;

    // Number of milliseconds after which to save non-important state changes.
    readonly save_timeout: number;
}