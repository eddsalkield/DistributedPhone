# Automated tests for graph drawing
import sys
from tests import *
import time
import random, string


VERBOSE = True  # Set to true if you want all data to be printed
PROJECT_NAME = "Project"

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


tokenlist = []

while True:
    time.sleep(random.randint(1,3)/2)
    print("Registering new user")
    username = ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(10))

    test(registerWorker(username, "hunter2"), "testRegisterWorker")
    wtok = test(login(username, "hunter2", "worker"), "testLogin")["token"]
    tokenlist.append(wtok)

# Worker tests
    getTasks(wtok, PROJECT_NAME, 1)

    if random.randint(0,1):
        print("Logging off new user")
        test(logout(tokenlist.pop()), "testLogout")
        

