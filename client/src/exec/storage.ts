/* Descibes a blob. This is a _value type_. That is, object identity is not of
 * significance. However, it can be beneficial to deduplicate them. */
export interface Ref {
    id: string;
    size: number;
}

/* All write operations on Storage must be atomic and must be executed AS-IF
 * they were serialized in the order of calls. It may be possible to observe
 * a write operation that was started after a read, and all write operations
 * finished before a read has started must be observed. */
export interface Storage {
    /* Get a list of all blobs. */
    list(): Promise<Ref[]>;

    /* MUST RETURN A COPY! */
    get(id: string): Promise<Uint8Array>;

    /* Should do nothing if the blob doesn't exist. */
    delete(id: string): Promise<void>;

    /* Should overwrite the blob atomically if it exists. */
    set(id: string, data: Uint8Array): Promise<void>;
}
