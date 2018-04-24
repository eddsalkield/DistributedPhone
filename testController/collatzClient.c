#include <pptw.h>
#include <stdlib.h>
#include <assert.h>

inline __uint128_t nextStep (__uint128_t n) {
    if (n % 2 == 0)
        return n / 2;
    __uint128_t test = 3 * n + 1;
    if (test > n) 
	return 3 * n + 1;
    return 0;
}

// Runs a task. The request's blobs, as well as the request object itself,
// have been allocated using pptw1_malloc().

// Input on control, Output in blob

struct pptw1_response *pptw1_run(struct pptw1_request* req) {

    // Return response
    struct pptw1_response * response = malloc(sizeof(struct pptw1_response) + n_blobs * sizeof(struct pptw1_blobref));

    // assert blobs == 0 (input in control)
    assert(req->n_blobs == 0);
    response->n_blobs = 1; // Output a single blob

    // Extract blob data from request
    struct pptw1_blobref reqControlBlob = req->control;
    __uint128_t *data = (__uint128_t *)(reqControlBlob.data); 
    __uint128_t left = data[0];
    __uint128_t right = data[1];
    __uint128_t range = right - left;

    // Our blob memory
    char* blobMemChar = pptw1_malloc(sizeof(unsigned int[range]));

    // Cast to unsigned shorts -- sequence lengths are quite short
    unsigned int *blobMem = (unsigned int *)(blobMemChar);

    // This represents how many sequences have been computed this blob
    // assume |range| < 2 mil (else a lot of memory per blob)
    int seqsDone = 0;

    __uint128_t num;  // current number we are testing
    unsigned int seqLength; // length of that sequence

    for (__uint128_t i = left; i < right; i++) {
	num = i; seqLength = 0;
	while (num != 1) { // assuming collatz conj :)
	    num = nextStep(num);
	    if (num == 0) break;
	    seqLength++;
	}
	// may have overflowed
	if (num == 1) {
	    blobMem[seqsDone] = seqLength;
            seqsDone++;
        }
    }    
        
    // Info has been written to memory[blobMem ... blobMem + seqDone)
    struct pptw1_blobref * thisBlob = &(response->blobs[0]); // we send a single blob
    thisBlob->data = blobMem;
    thisBlob->size = sizeof(unsigned int) * seqsDone;
    
    return response;
}
