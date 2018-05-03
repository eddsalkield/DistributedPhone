## Automated tests for the server
import requests, cbor

SERVER_IP = "35.178.90.246:8081"

def reboot():
    r = requests.post("http://" + SERVER_IP + "/reboot")

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)



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
    
def getBlob(token, pname, name):
    r = requests.post("http://" + SERVER_IP + "/getBlob", data = cbor.dumps(
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
    r = requests.post("http://" + SERVER_IP + "/getTasks", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "maxtasks": maxtasks,
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def sendTasks(token, tasks):
    r = requests.post("http://" + SERVER_IP + "/sendTasks", data = cbor.dumps(
        {   "token": token,
            "tasks": tasks
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def deleteBlob(token, pname, blobID):
    r = requests.post("http://" + SERVER_IP + "/deleteBlob", data = cbor.dumps(
        {   "token": token,
            "pname": pname,
            "blobID": blobID
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def getGraphs(pname):
    r = requests.post("http://" + SERVER_IP + "/getGraphs", data = cbor.dumps(
        {   "pname": pname,
        }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)


def getProjectsList():
    r = requests.post("http://" + SERVER_IP + "/getProjectsList")

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)

def updateGraphs(token, graphsCBOR, pname):
    r = requests.post("http://" + SERVER_IP + "/updateCustomGraphs", data = cbor.dumps(
    {   "token": token,
        "pname": pname,
        "customGraphs": graphsCBOR
    }))

    if r.status_code != 200:
        return (False, r.text)

    data = cbor.loads(r.content)
    return (data["success"] and data["error"] == "", data)
