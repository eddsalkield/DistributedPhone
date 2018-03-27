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
    get(id: string): Promise<ArrayBuffer>;

    /* Should return true if deleted, false if the blob didn't exist. */
    delete(id: string): Promise<boolean>;

    /* Should return true if a blob was overwritten. */
    set(id: string, data: Uint8Array): Promise<boolean>;
}
