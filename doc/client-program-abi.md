ABI for client programs, version 1
===

The program provided by the client receives the following inputs:

  - A short bytestring, called `control`, provided in the task metadata.
  - A list of bytestrings corresponding to the contents of the input blobs.

The outputs are:

  - A short bytestring, called `control`, part of the output metadata.
  - A list of bytestrings, which will be available as blobs on the server.

The program must be provided as a 32-bit WebAssembly binary with the follwing
interface:

Imports
---
    env: {
      memory
        The program's linear memory.

      void pptw1_abort(char*)
        Aborts program execution. The argument is NULL or a pointer to the
        error message.

      void pptw1_print(char*, size_t)
        Print a message with the given length to the console. Similar to
            (void) write(STDERR_FILENO, msg, len)
    }

Exports
---
    void pptw1_init(void)
      Called when the program is started.

    void pptw1_cleanup(void)
      Called when the program is stopped.

    char *pptw1_malloc(size_t)
      Allocates memory of the given size and returns pointer.

    pptw1_response *pptw1_run(pptw1_request*)
      Runs a task. The request's blobs, as well as the request object itself,
      have been allocated using pptw1_malloc().

Types
---
    struct pptw1_blobref {
      void *data;
      size_t size;
    };

    struct pptw1_request {
      struct pptw1_blobref control;
      size_t n_blobs;
      struct pptw1_blobref blobs[n_blobs];
    };

    struct pptw1_response {
      struct pptw1_blobref control;
      size_t n_blobs;
      struct pptw1_blobref blobs[n_blobs];
    };
