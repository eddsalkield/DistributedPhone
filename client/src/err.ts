declare interface ErrorAttr {
    [name: string]: string | number | boolean | Data;
}

export declare interface Data extends ErrorAttr {
    "kind": string;
    "message": string;
}

interface ErrorType {
    readonly kind: string | null;
    new(message: string, attr?: ErrorAttr): Base;
}

export abstract class Base extends Error {
    public static readonly kind: string | null = null;
    public attr: Data;

    constructor(message: string, attr?: ErrorAttr) {
        super(message);
        const tp = this.constructor as ErrorType;
        this.attr = Object.assign({}, attr, {
            "kind": tp.kind!,
            "message": message,
        });
    }
}

export class State extends Base {
    public static readonly kind: string = "state";

    constructor(message: string, attr?: ErrorAttr) {
        super(message, attr);
    }
}

export class Runtime extends Base {
    public static readonly kind: string = "runtime";
}

export class Validation extends Base {
    public static readonly kind: string = "validation";
}

export class Network extends Runtime {
    public static readonly kind: string = "network";
}

export function fromData(d: Data): Base {
    d = Object.assign({}, d);
    const k = d["kind"];

    let kind: ErrorType;
    if(k === "state") {
        kind = State;
    } else if(k === "runtime") {
        kind = Runtime;
    } else if(k === "validation") {
        kind = Validation;
    } else if(k === "network") {
        kind = Network;
    } else {
        kind = Runtime;
    }

    const e = Object.create(kind) as Base;
    e.message = d.message;
    e.attr = d;
    return e;
}

export function dataOf(err: Error): Data {
    let stack = "" + err.stack;
    if(err instanceof Base) {
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
