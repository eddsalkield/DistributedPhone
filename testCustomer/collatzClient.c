#include <pptw.h>
#include <stdlib.h>
#include <assert.h>

typedef unsigned int seqlen_t;

inline __uint128_t nextStep (__uint128_t n) {
    if (n % 2 == 0)
        return n / 2;
    __uint128_t test = 3 * n + 1;
    if (test > n)
        return 3 * n + 1;
    return 0;
}

__uint128_t u128_read(const void *vin) {
        const unsigned char *in = (const unsigned char*)vin;
        __uint128_t val = 0;
        for (int i = 0; i < 16; i++) {
            val += (__uint128_t)in[i] << 8*i;
        }
        return val;
}

void u128_write(const void *vout, __uint128_t val) {
    unsigned char *out = (unsigned char*)vout;
    for (int i = 0; i < 16; i++) {
        out[i] = (val >> 8*i);
    }
}

void seqlen_write(const void *vout, seqlen_t val) {
    unsigned char *out = (unsigned char*)vout;
    for (int i = 0; i < 4; i++) {
        out[i] = (val >> 8*i);
    }
}

// Runs a task. The request's blobs, as well as the request object itself,
// have been allocated using pptw1_malloc().

// Input on control, Output in blob

struct pptw1_response *pptw1_run(struct pptw1_request* req) {

    // Return response
    struct pptw1_response * response = malloc(sizeof(struct pptw1_response) + sizeof(struct pptw1_blobref));

    // assert blobs == 0 (input in control)
    assert(req->n_blobs == 0);

    // Output a single blob
    response->n_blobs = 1;

    // Extract blob data from request 
    struct pptw1_blobref reqControlBlob = req->control;
    assert(reqControlBlob.size == 2 * 16);
    __uint128_t *data = (__uint128_t *)(reqControlBlob.data);
    __uint128_t left = data[0];
    __uint128_t right = data[1];

    __uint128_t num;  // current number we are testing
    seqlen_t maxLen = 0, seqLength; // length of that sequence

    // search [left..right)

    for (__uint128_t i = left; i < right; i++) {
        num = i; seqLength = 0;
        while (num != 1) { // assuming collatz conj :)
            num = nextStep(num);
            if (num == 0) break;
            seqLength++;
        }
        // may have overflowed
        if (num == 1) {
			if(seqLength > maxLen) maxLen = seqLength;
        }
    }

    // Info has been written to memory[blobMem ... blobMem + seqDone)
    struct pptw1_blobref * thisBlob = &(response->blobs[0]); // we send a single blob
    thisBlob->data = malloc(4);
    thisBlob->size = 4;
	seqlen_write(thisBlob->data, maxLen);

    return response;
}
