from tests import *
import sys
import time
import loads
import os

try:
    username = sys.argv[1]
    password = sys.argv[2]
    projectName = sys.arg[3]
except:
    print("Please enter a username, password and project you wish to work on")
    sys.exit()

(success, data) = registerWorker(username, password)
if not success:
    print ("Failed to register worker")
    sys.exit()

time.sleep(1)

(success, data) = login (username, password, 'worker')
if not success:
    print ("Failed to login")
    sys.exit()

token = data["token"]

# Now logged in 

while (True):
    (success, data) = getTasks(token, projectName, 1)
    if not success:
        print("no success finding tasks")
        time.sleep(1)
        continue
    # Found task  
    tasks = data["tasks"]
    if (len(tasks) != 1):
        print ("More/less tasks recieved than requested - expecting 1")
        break
    taskDict = cbor.loads(tasks[0])
    
    # Get interval, write to local as InputBlob
    intervalb = taskDict["control"]
    with open("blobInput", "wb") as f:
        f.write(intervalb)

    programBlobID = (taskDict["program"])["id"]
    (success, data) = getBlob(token, projectName, programBlobID)
    if not success:
        print ("Cannot retrieve webassembly blob")
        break
    
    wacode = data["blob"]
    with open("collatzClient", "wb") as f:
        f.write(wacode)

    os.system("node1/bin/node node-executor.js collatzClient blobInput")

    with open("output-blob-0", "rb") as f:
        outputBlob = intevalb + f.read()
    
    metad = { "result": True }
    (success, data) = createNewBlob(token, projectName, outputBlob, metad)
    break

logout(token)
    

    









