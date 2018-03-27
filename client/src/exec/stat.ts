import * as api from "./api";

export interface Stat {
    report: (key: string, value: string | number | null) => void;
    reportError: (e: api.ErrorData) => void;
}

export class NullStat implements Stat {
    public report(key: string, value: string | number | null): void {}
    public reportError(e: api.ErrorData): void {}
}
