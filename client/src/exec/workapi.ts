import {ErrorData} from "./api";
import {Ref} from "./storage";

export type ErrorData = ErrorData;
export type Ref = Ref;

export interface InWork {
    program: Ref;
    control: Uint8Array;
    data: Ref[];
}

export interface InControl {
    get_blob?: [string, Uint8Array];
}

export interface In {
    work?: InWork;
    control?: InControl;
}

export interface OutResult {
    data: Uint8Array[];
}

export interface OutError {
    error: ErrorData;
}

export interface OutControl {
    notify_started?: null;
    get_blob?: Ref;
}

export interface Out {
    error?: ErrorData;
    result?: OutResult;
    control?: OutControl;
}
