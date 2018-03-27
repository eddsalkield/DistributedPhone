declare interface ErrorAttr {
    [name: string]: string | number | ErrorData;
}

export declare interface ErrorData extends ErrorAttr {
    "kind": string;
    "message": string;
}

interface ErrorType {
    readonly kind: string | null;
    new(message: string, attr?: ErrorAttr): BaseError;
}

export abstract class BaseError extends Error {
    public static readonly kind: string | null = null;
    public attr: ErrorData;

    constructor(message: string, attr?: ErrorAttr) {
        super(message);
        const tp = this.constructor as ErrorType;
        this.attr = Object.assign({}, attr, {
            "kind": tp.kind!,
            "message": message,
        });
    }

    public static fromData(d: ErrorData) {
        d = Object.assign({}, d);
        const k = d["kind"];

        let kind: ErrorType;
        if(k === "state") {
            kind = StateError;
        } else if(k === "runtime") {
            kind = RuntimeError;
        } else if(k === "validation") {
            kind = ValidationError;
        } else if(k === "network") {
            kind = NetworkError;
        } else {
            kind = RuntimeError;
        }

        const e = Object.create(kind) as BaseError;
        e.message = d.message;
        e.attr = d;
        return e;
    }
}

export class StateError extends BaseError {
    public static readonly kind: string = "state";

    constructor(message: string, attr?: ErrorAttr) {
        super(message, attr);
    }
}

export class RuntimeError extends BaseError {
    public static readonly kind: string = "runtime";
}

export class ValidationError extends BaseError {
    public static readonly kind: string = "validation";
}

export class NetworkError extends RuntimeError {
    public static readonly kind: string = "network";
}

export function excData(err: Error): ErrorData {
    let stack = "" + err.stack;
    if(err instanceof BaseError) {
        if(err.attr["stack"] !== undefined) {
            stack = stack + "\n\n" + err.attr["stack"];
        }
        return Object.assign({}, err.attr, {
            "stack": stack,
        });
    } else {
        return {
            "kind": "runtime",
            "message": err.message,
            "stack": stack,
        };
    }
}

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
