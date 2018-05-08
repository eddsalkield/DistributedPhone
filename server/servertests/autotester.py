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

#Test register multiple customers and workers
test(registerCustomer("Edd", "password1"), "testRegisterCustomer")
test(registerCustomer("Claudia","password2"),"testRegisterCustomer")
test(registerWorker("Hristo", "hunter2"), "testRegisterWorker")
test(registerWorker("Annazita", "hunter3"), "testRegisterWorker")

# Test login customer: first test for failure than for success
test(login("Edd", "wrongpassword", "customer"),"testCustomerLogin: False, wrong password")
test(login("Edd", "password1", "worker"),"testCustomerLogin: False, wrong access level")
data = test(login("Edd", "password1", "customer"), "testCustomerLogin")
ctok = data["token"]
test(logout(ctok), "testCustomerLogout")
data = test(login("Edd", "password1", "customer"), "testCustomerLogin")
ctok = data["token"]

data = test(login("Claudia", "password2", "customer"), "testCustomerLogin")
ctok_1 = data["token"]

# Test login worker
test(login("Hristo", "wrongpassword", "worker"),"testWorkerLogin: False, wrong password")
test(login("Hristo", "hunter2", "customer"),"testWorkerLogin: False, wrong access level")
data = test(login("Hristo", "hunter2", "worker"), "testLoginWorker")
wtok = data["token"]
test(logout(wtok), "testWorkerLogout")
data = test(login("Hristo", "hunter2", "worker"), "testLoginWorker")
wtok = data["token"]

data = test(login("Annazita", "hunter3", "worker"), "testLoginWorker")
wtok_1 = data["token"]

# Test blob creation
test(createNewProject(ctok, "Project", "Description"), "testCreateNewProject")
data = test(createNewBlob(ctok, "Project", b'blob1', b'meta1'), "testCreateNewBlob")
b1 = data["blobID"]
data = test(createNewBlob(ctok, "Project", b'blob2', b'meta2'), "testCreateNewBlob")
b2 = data["blobID"]
data = test(createNewBlob(ctok, "Project", b'blob3' , b'meta3'), "testCreateNewBlob")
b3 = data["blobID"]

test(createNewProject(ctok_1, "Project2", "Description"), "testCreateNewProject")
data = test(createNewBlob(ctok_1, "Project2", b'blob4', b'meta4'), "testCreateNewBlob")
b4 = data["blobID"]


# Test blobs are correctly returned
data = test(blobToTask(ctok, "Project", b1), "testBlobToTask")
data = test(blobToTask(ctok, "Project", b2), "testBlobToTask")
data = test(blobToTask(ctok, "Project", b3), "testBlobToTask")

data = test(blobToTask(ctok_1, "Project2", b4), "testBlobToTask")

data = test(getBlobMetadata(ctok, "Project", []), "testGetBlobMetadata")
data = test(getBlobMetadata(ctok_1, "Project2", []), "testGetBlobMetadata")

data = test(getBlob(ctok, "Project", b1), "testGetBlob")
data = test(getBlob(ctok, "Project", b2), "testGetBlob")
data = test(getBlob(ctok, "Project", b3), "testGetBlob")

data = test(getBlob(ctok_1, "Project2", b4), "testGetBlob")



# Worker tests
# Test assigning blobs to different workers
data = test(getTasks(wtok, "Project", 2), "testGetTasks")
data = test(getTasks(wtok, "Project", 2), "testGetTasks")
data = test(getTasks(wtok, "Project", 2), "testGetTasks")

data = test(getTasks(wtok_1, "Project2", 2), "testGetTasks")

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

tasksreturned_p2 = {
    "Project2": {
        str(b4): {
            "results": ["resblob7", "resblob8"],
            "metadatas": [],
            "status": "ok"
        }

    }
}

data = test(sendTasks(wtok, tasksreturned), "testSendTasks")
data = test(sendTasks(wtok_1, tasksreturned_p2), "testSendTasks")

test(getGraphs("Project", "m"), "testGetGraphs")
test(getGraphis("Project2", "m"), "testGetGraphs")
test(getProjectsList(), "testGetProjectsList")  #should print both projects

# Test logout at the end of the session
test(logout(ctok), "testCustomerLogout")
test(logout(ctok_1),"testCustomerLogout")
test(logout(wtok), "testWorkerLogout")
test(logout(wtok_1), "testWorkerLogout")

