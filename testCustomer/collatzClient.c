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
    int s = sizeof(seqlen_t);
    for (int i = 0; i < s; i++) {
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
    assert(reqControlBlob.size == 2 * sizeof(__uint128_t));
    __uint128_t *data = (__uint128_t *)(reqControlBlob.data);
    __uint128_t left = data[0];
    __uint128_t right = data[1];

    // Our blob memory
    char* blobMemStart = pptw1_malloc(sizeof(seqlen_t[right - left]));
    char* blobMemIndex = blobMemStart;

    // Write interval
    u128_write(blobMemIndex, left); blobMemIndex += sizeof(__uint128_t);
    u128_write(blobMemIndex, right); blobMemIndex += sizeof(__uint128_t);

    __uint128_t num;  // current number we are testing
    seqlen_t seqLength; // length of that sequence

    // search [left..right)

    seqlen_t maxSeqLength = 0;
    for (__uint128_t i = left; i < right; i++) {
        num = i; seqLength = 0;
        while (num != 1) { // assuming collatz conj :)
            num = nextStep(num);
            if (num == 0) break;
            seqLength++;
        }
        // may have overflowed
        if (num == 1) {
            // seqlen_write(blobMemIndex, seqLength);
            // blobMemIndex += sizeof(seqlen_t);
	    
	    // compare with current max
	    if (maxSeqLength < seqLength) {
		maxSeqLength = seqLength;
	    }
        }
    }

    // Write max to blobMem
    seqlen_write(blobMemIndex, seqLength); blobMemIndex += sizeof(seqlen_t);

    // Info has been written to memory[blobMem ... blobMem + 4)
    struct pptw1_blobref * thisBlob = &(response->blobs[0]); // we send a single blob
    thisBlob->data = blobMemStart;
    thisBlob->size = blobMemIndex - blobMemStart;

    return response;
}
