from tests import *
import sys
import time
import os
import cbor

try:
    username = sys.argv[1]
    password = sys.argv[2]
    projectName = sys.argv[3]
except:
    print("Please enter a username, password and project you wish to work on")
    sys.exit()

(success, data) = registerWorker(username, password)
if not success:
    print ("Failed to register worker")
    print (data["error"])
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
    
    taskID = data["taskIDs"][0]

    # Get interval, write to local as InputBlob
    intervalb = tasks[0]["control"]
    with open("blobInput", "wb") as f:
        f.write(intervalb)

    programBlobID = (tasks[0]["program"])["id"]
    (success, data) = getBlob(token, projectName, programBlobID)
    if not success:
        print ("Cannot retrieve webassembly blob")
        break
    
    wacode = data["blob"]
    with open("collatzClient", "wb") as f:
        f.write(wacode)

    os.system("node1/bin/node node-executor.js collatzClient blobInput")

    with open("output-blob-0", "rb") as f:
        outputBlob = intervalb + f.read()
    
    metad = { "result": True }

    print(len(outputBlob))
    taskData = { projectName: { taskID: { "results": [outputBlob], "metadatas": [], "status": "ok" }  }}
    (success, data) = sendTasks(token, taskData)
    if not success:
        print ("oh dear")
        print (data["error"])
         
    break

logout(token)
