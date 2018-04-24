## Automated tests for the server
import sys
from tests import *
import time

def test(res, testname):
    (succ, data) = res
    time.sleep(0.1)
    if succ:
        print(testname + " AOK")
        return data        
    else:
        print(testname + " FAILED")
        sys.exit(str(data))

test(testPing(), "testPing")
test(registerCustomer("Edd", "password1"), "testRegisterCustomer")
test(registerWorker("Hristo", "hunter2"), "testRegisterWorker")
data = test(login("Edd", "password1", "customer"), "testCustomerLogin")
ctok = data["token"]
data = test(login("Hristo", "hunter2", "worker"), "testLoginWorker")
wtok = data["token"]

# Test blob creation
test(createNewProject(ctok, "Project", "Description"), "testCreateNewProject")
data = test(createNewBlob(ctok, "Project", "blob1", "meta1"), "testCreateNewBlob")
b1 = data["blobID"]
data = test(createNewBlob(ctok, "Project", "blob2", "meta2"), "testCreateNewBlob")
b2 = data["blobID"]

# Test blobs are correctly returned
data = test(blobToTask(ctok, "Project", b1), "testBlobToTask")
print(data)
data = test(blobToTask(ctok, "Project", b2), "testBlobToTask")
print(data)

data = test(getBlobMetadata(ctok, "Project", []), "testGetBlobMetadata")
print(data)

data = test(getBlobs(ctok, "Project", [b1, b2]), "testGetBlobs")
print(data)


# Worker tests
data = test(getNewTask(wtok, "Edd", "Project"), "testGetNewTask")
print(data)
data = test(getNewTask(wtok, "Edd", "Project"), "testGetNewTask")
print(data)

data = test(taskDone(wtok, "Edd", "Project", b1, []), "testTaskDone")
print(data)
data = test(taskDone(wtok, "Edd", "Project", b2, []), "testTaskDone")
print(data)
