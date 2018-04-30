## Automated tests for the server
import sys
from tests import *
import time

VERBOSE = True  # Set to true if you want all data to be printed

def test(res, testname):
    (succ, data) = res
    time.sleep(0.1)
    if succ:
        print(testname + " AOK")
        if VERBOSE:
            print(data)
        return data        
    else:
        print(testname + " FAILED")
        if VERBOSE:
            print(data)
        sys.exit(str(data))

# Start test
print("Rebooting server...")
reboot()
time.sleep(1)

test(testPing(), "testPing")
test(registerCustomer("Edd", "password1"), "testRegisterCustomer")
test(registerWorker("Hristo", "hunter2"), "testRegisterWorker")
data = test(login("Edd", "password1", "customer"), "testCustomerLogin")
ctok = data["token"]
test(logout(ctok), "testCustomerLogout")
data = test(login("Edd", "password1", "customer"), "testCustomerLogin")
ctok = data["token"]
data = test(login("Hristo", "hunter2", "worker"), "testLoginWorker")
wtok = data["token"]

# Test blob creation
test(createNewProject(ctok, "Project", "Description"), "testCreateNewProject")
data = test(createNewBlob(ctok, "Project", b'blob1', b'meta1'), "testCreateNewBlob")
b1 = data["blobID"]
data = test(createNewBlob(ctok, "Project", b'blob2', b'meta2'), "testCreateNewBlob")
b2 = data["blobID"]
data = test(createNewBlob(ctok, "Project", b'blob3', b'meta3'), "testCreateNewBlob")
b3 = data["blobID"]

# Test blobs are correctly returned
data = test(blobToTask(ctok, "Project", b1), "testBlobToTask")
data = test(blobToTask(ctok, "Project", b2), "testBlobToTask")
data = test(blobToTask(ctok, "Project", b3), "testBlobToTask")

data = test(getBlobMetadata(ctok, "Project", []), "testGetBlobMetadata")

data = test(getBlob(ctok, "Project", b1), "testGetBlob")

data = test(getBlob(ctok, "Project", b2), "testGetBlob")
data = test(getBlob(ctok, "Project", b3), "testGetBlob")

# Worker tests
data = test(getTasks(wtok, "Project", 2), "testGetTasks")
data = test(getTasks(wtok, "Project", 2), "testGetTasks")
data = test(getTasks(wtok, "Project", 2), "testGetTasks")

tasksreturned = {
    "Project": {
        str(b1): {
            "results": ["resblob1", "resblob2"],
            "metadatas": [],
            "status": "ok"
        },

        str(b2): {
            "results": ["resblob3", "resblob4"],
            "metadatas": [],
            "status": "ok"
        },

        str(b3): {
            "results": ["resblob5", "resblob6"],
            "metadatas": [],
            "status": "ok"
        }
    }
}

data = test(sendTasks(wtok, tasksreturned), "testSendTasks")

test(getGraphs("Project", "m"), "testGetGraphs")
test(getProjectsList(), "testGetProjectsList")
