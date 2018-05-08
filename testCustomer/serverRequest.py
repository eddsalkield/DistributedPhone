## Automated tests for the server
import requests, cbor

SERVER_URL = "https://pptw1.venev.name/api"

def reboot():
    r = requests.post(SERVER_URL + "/reboot")

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)



# Test ping
def testPing():
    r = requests.post(SERVER_URL + "/ping")

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)


def registerCustomer(username, password):
    r = requests.post(SERVER_URL + "/register", data = cbor.dumps(
        {   "username": username,
            "password": password,
            "accesslevel": "customer"
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def registerWorker(username, password):
    r = requests.post(SERVER_URL + "/register", data = cbor.dumps(
        {   "username": username,
            "password": password,
            "accesslevel": "worker"
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def login(username, password, accesslevel):
    r = requests.post(SERVER_URL + "/login", data = cbor.dumps(
        {   "username": username,
            "password": password,
            "accesslevel": accesslevel
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def logout(token):
    r = requests.post(SERVER_URL + "/logout", data = cbor.dumps(
        {   "token": token   }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)
    
def createNewProject(token, pname, pdescription):
    r = requests.post(SERVER_URL + "/createNewProject", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "pdescription": pdescription
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)
    
def createNewBlob(token, pname, blob, metadata):
    r = requests.post(SERVER_URL + "/createNewBlob", data = cbor.dumps(
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
    r = requests.post(SERVER_URL + "/blobToTask", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "blobID": blobID,
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)
    
def getBlobMetadata(token, pname, blobIDs):
    r = requests.post(SERVER_URL + "/getBlobMetadata", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "blobIDs": blobIDs,
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)

    return (data["success"] and data["error"] == "", data)
    
def getBlob(token, pname, name):
    r = requests.post(SERVER_URL + "/getBlob", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "name": name,
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    data["blob"] = data["blob"]
    data["metadata"] = cbor.loads(data["metadata"])
    return (data["success"] and data["error"] == "", data)
    
def getTasks(token, pname, maxtasks):
    r = requests.post(SERVER_URL + "/getTasks", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "maxtasks": maxtasks,
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def sendTasks(token, tasks):
    r = requests.post(SERVER_URL + "/sendTasks", data = cbor.dumps(
        {   "token": token,
            "tasks": tasks
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def deleteBlob(token, pname, blobID):
    r = requests.post(SERVER_URL + "/deleteBlob", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "blobID": blobID
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def getGraphs(pname):
    r = requests.post(SERVER_URL + "/getGraphs", data = cbor.dumps(
        {   "pname": pname
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)


def getProjectsList():
    r = requests.post(SERVER_URL + "/getProjectsList")

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def updateGraphs(token, graphsCBOR, pname):
    r = requests.post(SERVER_URL + "/updateCustomGraphs", data = cbor.dumps(
    {   "token": token,
        "pname": pname,
        "customGraphs": graphsCBOR
    }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)
