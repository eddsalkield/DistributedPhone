declare module "double-ended-queue" {
    export default class Deque<T> {
        constructor(capacity?: number | Array<T>);

        push(...data: T[]): void;
        enqueue(...data: T[]): void;
        insertBack(...data: T[]): void;

        unshift(...data: T[]): void;
        insertFront(...data: T[]): void;

        pop(): T | undefined;
        removeBack(): T | undefined;

        shift(): T | undefined;
        dequeue(): T | undefined;
        removeFront(): T | undefined;

        toArray(): Array<T>;
        toJSON(): Array<T>;

        peekBack(): T | undefined;

        peekFront(): T | undefined;

        get(index: number): T | undefined;

        readonly length: number;
        isEmpty(): boolean;

        clear(): void;
    }
}
