## Automated tests for the server
import requests, cbor

SERVER_IP = "35.178.90.246:8081"

# Test ping
def testPing():
    r = requests.post("http://" + SERVER_IP + "/ping")

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)


def registerCustomer(username, password):
    r = requests.post("http://" + SERVER_IP + "/register", data = cbor.dumps(
        {   "username": username,
            "password": password,
            "accesslevel": "customer"
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def registerWorker(username, password):
    r = requests.post("http://" + SERVER_IP + "/register", data = cbor.dumps(
        {   "username": username,
            "password": password,
            "accesslevel": "worker"
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def login(username, password, accesslevel):
    r = requests.post("http://" + SERVER_IP + "/login", data = cbor.dumps(
        {   "username": username,
            "password": password,
            "accesslevel": accesslevel
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def logout(token):
    r = requests.post("http://" + SERVER_IP + "/logout", data = cbor.dumps(
        {   "token": token   }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)
    
def createNewProject(token, pname, pdescription):
    r = requests.post("http://" + SERVER_IP + "/createNewProject", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "pdescription": pdescription
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)
    
def createNewBlob(token, pname, blob, metadata):
    r = requests.post("http://" + SERVER_IP + "/createNewBlob", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "blob": blob,
            "metadata": metadata
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def blobToTask(token, pname, blobID):
    r = requests.post("http://" + SERVER_IP + "/blobToTask", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "blobID": blobID,
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)
    
def getBlobMetadata(token, pname, blobIDs):
    r = requests.post("http://" + SERVER_IP + "/getBlobMetadata", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "blobIDs": blobIDs,
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)
    
def getBlobs(token, pname, blobIDs):
    r = requests.post("http://" + SERVER_IP + "/getBlobs", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "blobIDs": blobIDs,
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)
    
def getNewTask(token, customername, pname):
    r = requests.post("http://" + SERVER_IP + "/getNewTask", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "customername": customername,
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def taskDone(token, customername, pname, taskID, blobsandmetas):
    r = requests.post("http://" + SERVER_IP + "/taskDone", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "customername": customername,
            "taskID": taskID,
            "blobsandmetas": blobsandmetas
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)
