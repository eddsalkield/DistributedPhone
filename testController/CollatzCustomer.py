import sys, cbor, socket, os
import time
from tests import *

# Pass the username and password as command-line arguments
try:
    username = sys.argv[1]
    password = sys.argv[2]
    project_name = sys.argv[3]
except:
    print("Please enter correct username, password and project ID")
    sys.exit()
	
with open("collatzClient", "rb") as f:
    collatz_wa = f.read()
collatz_fs = os.path.getsize("collatzClient")

class TaskDistributor:

    # Areas for improvement:
    # 	-- Better distribution of task sizes / greater variety in interval length
    #	-- Better storage of results (and actually doing something with them)
    
    # For now we just have a fixed range.
    # Starting at 'search_start', we have 'number_tasks' intervals of length 'fixed_range'
    # So the total search will be between [search_start ... search_start + fixed_range * number_tasks)
    search_start = 900000
    fixed_range  = 100
    number_tasks = 10

    def __init__ (self, token):
            self.results = []   # List of (number, seqLength) pairs - not used at the moment
            self.TaskIDIntervals = []  # List of (taskID, (leftInterval, rightInterval)) pairs
            self.token = token
            self.initTasks()
            self.monitorBlobs()
	
    def makeTaskBlob(self):
        (success, data) = createNewBlob(self.token, project_name, collatz_wa, {})
        if not success:
            print("Error when making blob task")
            print(data["error"])
            sys.exit()
        return data["blobID"]

    def initTasks (self):
        for taskNo in range (0, self.number_tasks):

            # Push blob containing web assembly to the database, return its ID
            taskBlobID = self.makeTaskBlob()
            
            # Calculate interval
            start = self.search_start + taskNo * self.fixed_range
            end = start + self.fixed_range

            # Convert to bytearray data
            leftb = start.to_bytes(16, byteorder='little')
            rightb = end.to_bytes(16, byteorder='little')
            intervalb = leftb + rightb

            taskInfo = { "program": {"id": taskBlobID, "size": collatz_fs},
                         "control": intervalb, "blobs": []}

            (success, dataBlob) = createNewBlob(token, project_name, taskInfo, {})
            if (not success):
                print("Error when creating blob (pre-taskify)")
                print(dataBlob["error"])
                sys.exit()
            
            (success, dataTask) = blobToTask(token, project_name, dataBlob["blobID"])
            if (not success):
                print ("Error when taskifying")
                print (dataTask["error"])
                sys.exit()

    def processResults(self, bytedata):
        # First decode the intervals from the data (16 bytes)
        print("size: " + str(len(bytedata)))
	
	left = int.from_bytes(bytedata[:16], 'little')
	right = int.from_bytes(bytedata[16:32], 'little')
	
        print(str(left) + " " + str(right))
        for i in range (0, right - left):
            seqLength = 0
            for j in range (0, 4): # Int sequence lengths
                seqLength += bytedata[4 * i + j + 32]<<8*j
            print((left + i, seqLength)) 

    # When a worker finished a computation, it places a blob in the database along with metadata
    # indicating whether the task is finished. The customer will routinely scan (will it?) the database for
    # finished blobs and will acquire their results before deleting them.
    def monitorBlobs(self):
        dataRecieved = 0
        while (dataRecieved < self.number_tasks):

            # Get meta-data on all blobs (for now)
            (success, allData) = getBlobMetadata(self.token, project_name, [])
            if (not success):
                print ("Error when retrieving metadata")
                continue

            metaDict = allData["metadata"]
            for blobid, metadata  in metaDict.items():
                if (bool(metadata)): # Non empty metadata (result)
                    if (metadata["result"] == True): # Double check its a result
                        # So blobID points to a result
                        (success, data) = getBlob(self.token, project_name, blobid)
                        if (not success):
                            print ("Failure to retrieve result blob")
                            sys.exit()
                        blobval = data["blob"]
                        self.processResults(blobval)
                        dataRecieved += 1
                        deleteBlob(self.token, project_name, blobid)
                        ### make sure blob is actually deleted ###
                        ### time.sleep(0.1)


############### START HERE ################
if __name__ == '__main__':

    # Just ping server to check it's up and running
    (success, ret) = testPing()
    if (not success):
        print("Server ping error")
        print(ret["error"])
        sys.exit()
    
    (success, tokenDict) = login(username, password, "customer")
    if (not success):
        print("Token acquisition failed")
        print(tokenDict)
        sys.exit()
    
    token = tokenDict["token"]

    # Login successful
    distributor = TaskDistributor(token)