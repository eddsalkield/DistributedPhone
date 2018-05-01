## Automated tests for the server
import sys
from tests import *
import time
import random, string

username = ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(10))

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
test(testPing(), "testPing")
test(registerWorker(username, "hunter2"), "testRegisterWorker")
wtok = test(login(username, "hunter2", "worker"), "testLogin")["token"]

# Worker tests
data = test(getTasks(wtok, "Project", 2), "testGetTasks")

