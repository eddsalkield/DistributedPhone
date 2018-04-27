import sys
import struct

try:
    blobfile = sys.argv[1]
except:
    raise Exception('enter name pls')

no_bytes = 4 # 4 if integer

with open(blobfile, 'rb') as f:
    while True:
        seq = f.read(no_bytes)
        if len(seq) == 0:
            print("Read all bytes")
            break
        elif len(seq) < no_bytes:
            print("Bytes left over")
            break
        else: # len(seq4b) == no_bytes
            v = 0
            for i in range(0, no_bytes):
                v += seq[i] << 8*i 
            print(v)
