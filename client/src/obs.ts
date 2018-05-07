export interface Subscription {
    readonly closed: boolean;
    start(): void;
    stop(): void;
}

export interface Observer<T> {
    next?(value: T): void;
    error?(err: Error): void;
    complete?(): void;
}

export interface SubscriptionObserver<T> {
    readonly closed: boolean;
    next(value: T): void;
    error(err: Error): void;
    complete(): void;
}

class SubscriptionObserverImpl<T> implements SubscriptionObserver<T> {
    private _closed: boolean = false;

    constructor(
        private _onNext: (value: T) => void,
        private _onError: (err: Error) => void,
        private _onComplete: () => void
    ) {}

    get closed() {
        return this._closed;
    }

    public next(value: T): void {
        if(this._closed) return;
        try {
            this._onNext(value);
        } catch(e) {
            console.error(e);
        }
    }

    public error(err: Error): void {
        const cb = this._onError;
        if(this._close()) return;
        try {
            cb(err);
        } catch(e) {
            console.error(e);
        }
    }

    public complete(): void {
        const cb = this._onComplete;
        if(this._close()) return;
        try {
            cb();
        } catch(e) {
            console.error(e);
        }
    }

    public _close(): boolean {
        if(this._closed) return true;
        this._closed = true;
        this._onNext = ignore;
        this._onError = ignore;
        this._onComplete = ignore;
        return false;
    }
}

export type Subscriber<T> = (observer: SubscriptionObserver<T>) => undefined | (() => void);

export interface ObservableLike<T> {
    subscribe(
        onNext: (value: T) => void,
        onError?: (error: Error) => void,
        onComplete?: () => void
    ): Subscription;

    subscribe(observer: Observer<T>): Subscription;
}

function ignore(): void {}

export class Observable<T> implements ObservableLike<T> {
    private _subscriber: Subscriber<T>;

    constructor(subscriber: Subscriber<T>) {
        this._subscriber = subscriber;
    }

    public subscribe(
        onNext?: (value: T) => void,
        onError?: (error: Error) => void,
        onComplete?: () => void
    ): Subscription;

    public subscribe(observer: Observer<T>): Subscription;

    public subscribe(
        obs?: ((value: T) => void) | Observer<T>,
        onError?: (error: Error) => void,
        onComplete?: () => void
    ): Subscription {
        let onNext: (value: T) => void;

        if(typeof obs === "object") {
            onNext = (value) => {
                if(obs.next !== undefined) obs.next(value);
            };
            onError = (err) => {
                if(obs.error !== undefined) obs.error(err);
            };
            onComplete = () => {
                if(obs.complete !== undefined) obs.complete();
            };
        } else {
            onNext = obs || ignore;
            onError = onError || ignore;
            onComplete = onComplete || ignore;
        }

        const so = new SubscriptionObserverImpl(onNext, onError, onComplete);
        let func: (() => void) | undefined;
        let subscriber: Subscriber<T> | undefined = this._subscriber;

        return {
            get closed() {
                return so.closed;
            },
            start() {
                const f = subscriber;
                if(f === undefined) throw new TypeError("Already started");
                subscriber = undefined;
                try {
                    func = f(so);
                } catch(e) {
                    so.error(e);
                }
            },
            stop() {
                const f = func;
                func = undefined;
                if(so._close() && f) {
                    try {
                        f();
                    } catch(e) {
                        console.error(e);
                    }
                }
            },
        };
    }
}

export function single<T>(value: T): Observable<T> {
    return new Observable((sink) => {
        sink.next(value);
        sink.complete();
        return () => {};
    });
}

export function first<T>(obs: ObservableLike<T> | ObservableLike<PromiseLike<T>>): Promise<T | undefined>;
export function first<T, U>(obs: ObservableLike<T | PromiseLike<U>>): Promise<T | U | undefined>;

export function first<T,U>(obs: ObservableLike<T | PromiseLike<U>>): Promise<T | U | undefined> {
    return new Promise((resolve, reject) => {
        const subs = obs.subscribe(
            (value) => {
                resolve(value);
                subs.stop();
            },
            (err) => reject(err),
            () => resolve(undefined),
        );
        subs.start();
    });
}

export function last<T>(obs: ObservableLike<T> | ObservableLike<PromiseLike<T>>): Promise<T | undefined>;
export function last<T, U>(obs: ObservableLike<T | PromiseLike<U>>): Promise<T | U | undefined>;

export function last<T,U>(obs: ObservableLike<T | PromiseLike<U>>): Promise<T | U | undefined> {
    let val: T | PromiseLike<U> | undefined;

    return new Promise((resolve, reject) => {
        obs.subscribe(
            (value) => {
                val = value;
            },
            (err) => reject(err),
            () => resolve(val),
        ).start();
    });
}

export function map<T, U>(obs: ObservableLike<T>, f: (val: T) => U): Observable<U> {
    return new Observable<U>((sink) => {
        const subs = obs.subscribe(
            (val: T) => {
                let val2: U;
                try {
                    val2 = f(val);
                } catch(e) {
                    sink.error(e);
                    return;
                }
                sink.next(val2);
            },
            (e) => sink.error(e),
            () => sink.complete(),
        );
        subs.start();
        return () => subs.stop();
    });
}

export function filter<T>(obs: ObservableLike<T>, f: (val: T) => boolean): Observable<T> {
    return new Observable<T>((sink) => {
        const subs = obs.subscribe(
            (val: T) => {
                let ok: boolean;
                try {
                    ok = f(val);
                } catch(e) {
                    sink.error(e);
                    return;
                }
                if(ok) sink.next(val);
            },
            (e) => sink.error(e),
            () => sink.complete(),
        );
        subs.start();
        return () => subs.stop();
    });
}

export function switchMap<T, U>(obs: ObservableLike<T>, f: (val: T) => ObservableLike<U>): Observable<U> {
    return new Observable((sink) => {
        let sub1: Subscription | undefined;
        const sub = obs.subscribe((v_out) => {
            if(sub1 !== undefined) {
                sub1.stop();
                sub1 = undefined;
            }
            let obs1: ObservableLike<U>;
            try {
                obs1 = f(v_out);
            } catch(e) {
                sink.error(e);
                return;
            }

            sub1 = obs1.subscribe((v_in) => {
                sink.next(v_in);
            }, (e) => {
                sink.error(e);
                sub1 = undefined;
            }, () => {
                sub1 = undefined;
            });
            sub1.start();
        }, (e) => {
            if(sub1 !== undefined) {
                sub1.stop();
                sub1 = undefined;
            }
            sink.error(e);
        }, () => {
            if(sub1 !== undefined) {
                sub1.stop();
                sub1 = undefined;
            }
            sink.complete();
        });
        sub.start();
        return () => {
            sub.stop();
            if(sub1 !== undefined) {
                sub1.stop();
                sub1 = undefined;
            }
        };
    });
}

export function refresh<T>(f: () => Promise<T>, period: number): Observable<T> {
    return new Observable<T>((sink) => {
        let tm: number | undefined;
        const cb = () => {
            tm = undefined;
            f().then((v) => {
                if(sink.closed) return;
                sink.next(v);
                tm = self.setTimeout(cb, period);
            });
        };
        tm = self.setTimeout(cb, 0);
        return () => {
            if(tm !== undefined) self.clearTimeout(tm);
        };
    });
}

const stNoValue = {};
const stHasValue = {};
const stComplete = {};

export class Subject<T> extends Observable<T> implements SubscriptionObserver<T> {
    private _state: any;
    private _value: T | undefined;
    private _subs: Array<[number, SubscriptionObserver<T>]> = [];

    constructor(initial?: T) {
        super((subscriber) => {
            const subs = this._subs;
            const obj: [number, SubscriptionObserver<T>] = [subs.length, subscriber];
            if(subs.length === 0) this.onAttach();
            subs.push(obj);

            const st = this._state;
            if(st === stHasValue) {
                subscriber.next(this._value!);
            } else if(st !== stNoValue) {
                if(st === stComplete) {
                    subscriber.complete();
                } else {
                    subscriber.error(st);
                }
                return;
            }

            return () => {
                const i = obj[0];
                if(i !== -1) {
                    obj[0] = -1;
                    if(i !== subs.length - 1) {
                        const lastval = subs.pop()!;
                        lastval[0] = i;
                        subs[i] = lastval;
                    } else {
                        subs.pop();
                    }
                    if(subs.length === 0) this.onDetach();
                }
            };
        });

        this._value = initial;

        if(arguments.length >= 1) {
            this._state = stHasValue;
        } else {
            this._state = stNoValue;
        }
    }

    get value(): T {
        const st = this._state;
        if(st !== stHasValue) {
            if(st === stNoValue || st === stComplete) throw new TypeError("No data available");
            throw st;
        }
        return this._value!;
    }

    get closed(): boolean {
        const st = this._state;
        return st !== stNoValue && st !== stHasValue;
    }

    public next(value: T) {
        const st = this._state;
        if(st !== stHasValue) {
            if(st !== stNoValue) return;
            this._state = stHasValue;
        }
        this._value = value;
        for(const obj of this._subs) {
            obj[1].next(value);
        }
    }

    public error(err: Error) {
        const st = this._state;
        if(st !== stNoValue && st !== stHasValue) return;
        this._state = err;
        this._value = undefined;
        const subs = this._subs;
        if(subs.length !== 0) {
            this.onDetach();
            for(const obj of subs) {
                obj[0] = -1;
                obj[1].error(err);
            }
            subs.splice(0);
        }
    }

    public complete() {
        const st = this._state;
        if(st !== stNoValue && st !== stHasValue) return;
        this._state = stComplete;
        this._value = undefined;
        const subs = this._subs;
        if(subs.length !== 0) {
            this.onDetach();
            for(const obj of subs) {
                obj[0] = -1;
                obj[1].complete();
            }
            subs.splice(0);
        }
    }

    protected isEmpty(): boolean {
        return this._subs.length === 0;
    }
    protected onAttach(): void {}
    protected onDetach(): void {}
}

export class Cache<T> extends Subject<T> {
    private _src: Observable<T> | null = null;
    private _src_sub: Subscription | null = null;

    constructor(obs?: Observable<T>) {
        super();
        if(obs !== undefined) this.attach(obs);
    }

    public attach(obs: Observable<T> | null): void {
        if(this.closed) throw new TypeError("obs.Cache closed");
        this._src = null;
        this.onDetach();
        if(obs !== null) {
            this._src = obs;
            if(!this.isEmpty()) this.onAttach();
        }
    }

    protected onAttach(): void {
        if(this._src === null) return;
        if(this._src_sub !== null) return;
        const sub = this._src.subscribe(this);
        this._src_sub = sub;
        sub.start();
    }

    protected onDetach(): void {
        if(this._src_sub === null) return;
        const sub = this._src_sub;
        this._src_sub = null;
        if(this.closed) this._src = null;
        sub.stop();
    }
}
