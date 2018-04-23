#include <ctrl.o>
#include <pptw.h>

inline __uint128_t nextStep (__uint128_t n) {
    if (n % 2 == 0)
        return n / 2;
    // check overflow
    __uint128_t test = 3 * n + 1;
    if (test > n)
        return test;
    else // error message
        return 0; 
}

// Runs a task. The request's blobs, as well as the request object itself,
// have been allocated using pptw1_malloc().

pptw1_response *pptw1_run(pptw1_request* req) {
    
    // Number of blobs we dealing with
    size_t n_blobs = req->n_blobs;

    // Return response
    pptw1_response response;
    response->n_blobs = n_blobs; // blob for each blob
    response->blobs[n_blobs];
    
    // Go through each blob
    for (size_t blob_i = 0; blob_i < n_blobs; blob_i++) {
    
        // Extract blob data from request - hoping can do this way?
        pptw1_blobref reqBlob = req->blobs[blob_i];
        __uint128_t *data = static_cast<__uint128_t*>(reqBlob->data);
        __uint128_t left = data[0]
        __uint128_t right = data[1]
        
        // Our blob memory
        char* blobMemChar = pptw1_malloc(sizeof(unsigned int[4]));
        
        // Cast to unsigned shorts -- sequence lengths are quite short
        unsigned short *blobMem = static_cast<unsigned short*>(blobMemChar)
        
        // This represents how many sequences have been computed this blob
        // assume |range| < 2 mil (else a lot of memory per blob)
        int seqsDone = 0
        
        __uint128_t num;  // current number we are testing
        unsigned short seqLength; // length of that sequence
        
        for (__uint128_t i = left; i < right; i++) {
             num = i; seqLength = 0;
             while (num != 1) { // assuming collatz conj :)
                 num = nextStep(num); 
                 if (num == 0) break; // overflow
                 seqLength++;
             }
             // may have overflowed
             if (num == 1) {
                *(blobMem + seqDone) = seqLength; 
                seqsDone++;
             }
        }    
        
        // Info has been written to memory[blobMem ... blobMem + seqDone)
        pptw1_blobref thisBlob = response->blobs[blob_i];
        thisBlob->data = blobMem;
        thisBlob->size = 2 * seqDone;
    }
    
}
