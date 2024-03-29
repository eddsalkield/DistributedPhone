import sys, cbor, socket, os, threading, traceback
import serverRequest
import time
import calendar
from serverRequest import *

# Pass the username and password as command-line arguments
try:
    username = sys.argv[1]
    password = sys.argv[2]
    project_name = sys.argv[3]
except:
    print("Please enter correct username, password and project ID")
    sys.exit()

#ollatzf = open("collatzClient", 'rb')
with open("collatzClient", "rb") as f:
    collatz_wa = f.read()
collatz_fs = os.path.getsize("collatzClient")

class TaskDistributor:

    # For now we just have a fixed range.
    # Starting at 'search_start', we have 'number_tasks' intervals of length 'fixed_range'
    # So the total search will be between [search_start ... search_start + fixed_range * number_tasks)
    search_start = 3000000000000000000000000000
    fixed_range  = 100000

    def __init__ (self, token):
        self.highestSeqs = []
        self.token = token
        self.startTime = calendar.timegm(time.gmtime())

    def go(self):
        self.thr_init = threading.Thread(target=self.initTasksLoop)
        self.thr_mon = threading.Thread(target=self.monitorBlobs)
        self.thr_init.start()
        self.thr_mon.start()
        self.thr_init.join()
        self.thr_mon.join()

    def makeTaskBlob(self):
        (success, data) = createNewBlob(self.token, project_name, collatz_wa, cbor.dumps({}))
        if not success:
            print("Error when making blob task")
            print(data["error"])
            sys.exit()
        return data["blobID"]

    def initTasksLoop (self):
        while True:
            try:
                no_tasks = int (input("How many tasks would you like to add? "))
                self.initTasks(no_tasks)
            except:
                traceback.print_exc()


    def initTasks (self, number_tasks):
        # Push blob containing web assembly to the database, return its ID
        taskBlobID = self.makeTaskBlob()
        print("Blob creation succeeded")
        print ("Taskifying " + str(number_tasks) + " times...")

        for taskNo in range (0, number_tasks):

            # Calculate interval
            start = self.search_start
            end = start + self.fixed_range

            # Convert to bytearray data
            leftb = start.to_bytes(16, byteorder='little')
            rightb = end.to_bytes(16, byteorder='little')
            intervalb = leftb + rightb

            taskInfo = { "program": {"id": taskBlobID, "size": collatz_fs},
                         "control": intervalb, "blobs": []}

            (success, dataBlob) = createNewBlob(token, project_name, cbor.dumps(taskInfo), cbor.dumps({}))
            if (not success):
                print("Error when creating blob (pre-taskify)")
                print(dataBlob["error"])
                sys.exit()

            (success, dataTask) = blobToTask(token, project_name, dataBlob["blobID"])
            if (not success):
                print ("Error when taskifying")
                print (dataTask["error"])
                sys.exit()

            self.search_start += self.fixed_range

        print ("Taskifying succeeded")

    def plot(self, results):

        graphs = {
           "highestResults": {
                "type": 'scatter',
                "data": {
                    "datasets": [{
                        "label": 'Longest sequences computed from tasks',
                        "borderColor": 'rgb(0, 255, 0)',
                        "data": self.highestSeqs,
                        "showLine": False,
                        "lineTension": 0.0,
                    }],
                },
                "options": {
                    "scales": {
                        "xAxes": [{
                            "time": {
                                "unit": 'second',
                            },
                        }],
                    },
                },
           }
        }

        updateGraphs(self.token, graphs, project_name)

    def processResults(self, bytedata):

        # Process results from a single task

        left = int.from_bytes(bytedata[:16], 'little')
        right = int.from_bytes(bytedata[16:32], 'little')
        highestSeqLen = int.from_bytes(bytedata[32:36], 'little')

        '''
        highestSeqLen = 0
        for i in range (0, right - left):
            seqLength = 0
            for j in range (0, 4): # Int sequence lengths
                seqLength += bytedata[4 * i + j + 32]<<8*j

            highestSeqLen = max (highestSeqLen, seqLength)
        '''
        self.highestSeqs.append ( {"x": time.time()*1000, "y": highestSeqLen} )
        self.plot(self.highestSeqs)

    # When a worker finished a computation, it places a blob in the database along with metadata
    # indicating whether the task is finished. The customer will routinely scan (will it?) the database for
    # finished blobs and will acquire their results before deleting them.

    def monitorBlobs(self):
        dataRecieved = 0
        print("Monitoring blobs...")
        while True:
            time.sleep(5)
            try:

                # Get meta-data on all blobs (for now)
                (success, allData) = getBlobMetadata(self.token, project_name, [])
                if (not success):
                    print ("Error when retrieving metadata")
                    print(allData)
                    continue

                metaDict = allData["metadata"]

                # Convert all metadata out of CBOR form
                for bID, meta in metaDict.items():
                    metaDict[bID] = cbor.loads(meta)

                for blobid, metadata  in metaDict.items():
                    if (bool(metadata)):
                        if (metadata["result"] == True):
                            # So blobID points to a result
                            (success, data) = getBlob(self.token, project_name, blobid)
                            if (not success):
                                print ("Failure to retrieve result blob")
                                sys.exit()
                            blobval = data["blob"]
                            self.processResults(blobval)
                            dataRecieved += 1
                            deleteBlob(self.token, project_name, blobid)
            except:
                traceback.print_exc()

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

    distributor.go()
