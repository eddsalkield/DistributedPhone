import * as api from "./api";

export interface Stat {
    report: (key: string, value: string | number | null) => void;
    reportError: (e: api.ErrorData) => void;
}
