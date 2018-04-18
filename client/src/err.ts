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

export class Cancelled extends Base {
    public static readonly kind: string = "cancelled";
}

export function fromData(d: Data): Base {
    d = Object.assign({}, d);
    const k = d["kind"];
    const msg = d["message"];
    delete d["kind"];
    delete d["message"];

    let kind: ErrorType;
    if(k === "state") {
        kind = State;
    } else if(k === "runtime") {
        kind = Runtime;
    } else if(k === "validation") {
        kind = Validation;
    } else if(k === "network") {
        kind = Network;
    } else if(k === "cancelled") {
        kind = Cancelled;
    } else {
        kind = Runtime;
    }

    return new kind(msg, d);
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

export function format(e: Error): string {
    if(e instanceof Base) {
        return formatData(e.attr);
    } else {
        return `${Object.getPrototypeOf(e).constructor.name}: ${e.message}`;
    }
}

export function formatData(data: Data): string {
    let msg = `Error [${data["kind"]}]: ${data["message"]}`;
    const keys = Object.keys(data);
    keys.splice(keys.indexOf("kind"), 1);
    keys.splice(keys.indexOf("message"), 1);
    if(keys.length > 0) {
        keys.sort((a, b) => {
            if(a < b) return -1;
            if(a > b) return 1;
            return 0;
        });
        msg += " [";
        let first = true;
        for(const key of keys) {
            if(first) first = false;
            else msg += ", ";
            msg += key;
            msg += " = ";
            const value = data[key]!;
            if(typeof value === "object") {
                msg += `[${value["kind"]}]: ${value["message"]}`;
            } else {
                msg += JSON.stringify(value);
            }
        }
        msg += "]";
    }
    return msg;
}
