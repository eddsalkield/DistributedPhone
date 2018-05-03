export default class Backoff {
    public readonly init: number;
    public readonly max: number;
    private _value: number;

    constructor(init?: number, max?: number) {
        if(init === undefined) this.init = 2000;
        else this.init = Math.max(100, 0|Math.min(86400000, init));

        if(max === undefined) this.max = 10 * this.init;
        else this.max = Math.min(2 * this.init, Math.max(this.init, 0|Math.min(86400000, max)));

        this._value = 0;
    }

    public get value(): number {
        return this._value;
    }

    public succeed(): void {
        this._value = 0;
    }

    public fail(): void {
        if(this._value === 0) {
            this._value = this.init;
        } else {
            this._value = Math.min(this.max, this._value * (1.1 + 0.4 * Math.random()));
        }
    }
}
