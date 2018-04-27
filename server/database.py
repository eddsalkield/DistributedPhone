# A skeleton database program
# NB: INPUTS ARE NOT GUARANTEED SAFE OR SANITISED. PLEASE SANITISE YOUR INPUTS FOR THE DATABASE

# Test implementation
from datetime import datetime
from time import mktime
from Crypto.Random import random
import numpy as np
import string

from header import *

def changeGraph(pID, graphname, diff):
    graphs = projects[pID]["graphing"]
    lastActive = graphs[graphname][-1:][0][1]
    graphs[graphname].append(tuple((getTime(), lastActive+diff)))

def getTime():
    return mktime(datetime.now().timetuple())

def salthash(passwd, salt):
    return passwd

def generateToken():
    done = False
    while not done:
        tok = ''.join(random.choice(string.ascii_letters) for m in range(TOKENSIZE))
        done = tok not in sessions

    return tok

users = {}	# Maps username to (password, accesslevel)
sessions = {}   # Maps a username to a session
                # Session comtains username, bool active, accesslevel. token, time
projects = {}   # Maps project names to projects

## AUTHENTICATION ##
# Registers a new user in the database. Returns true iff successful
def register(username, password, accesslevel):
    if username in users:
        return False
    else:
        users[username] = {"hashpass": salthash(password, username), "accesslevel": accesslevel, "issuedTasks": {}}
        return True

# Returns whether the username corresponds to the password of a user, of level accesslevel
def login(username, password, accesslevel):
    if username in users:
    # Test for correct credentials
        if users[username]["hashpass"] == salthash(password, username) and users[username]["accesslevel"] == accesslevel:
            # Create a new session
            token = generateToken()
            sessions[token] = {}

            s = sessions[token]
            t = getTime()
            s["username"] = username
            s["starttime"] = t
            s["accesslevel"] = accesslevel

            # Graphing
            for pname in users[username]["issuedTasks"]:
                changeGraph(pname, "activeWorkers", 1)

            return (True, token)
    return (False, 0)

def logoutGraphUpdate(username):
            # Graphing
            for pname in users[username]["issuedTasks"]:
                # Remove active user for each project
                changeGraph(pname, "activeWorkers", -1)


## Allows extraction of the user from currently active sessions. This should be cached in front of the database
def querySession(token, query):
    if query not in ["username", "starttime", "accesslevel", "issuedTasks"]:
        return (False, 0)
    
    if token not in sessions:
        return (False, 0)
    
    return (True, sessions[token][query])
    
# Deletes the session
def deleteSession(data, kind):
    if kind == "token":
        if data not in sessions:
            return False
        else:
            del sessions[data]
            return True
    elif kind == "username":
        result = False
        for i, (token, sesh) in enumerate(sessions.items()):
            if sesh["username"] == data:
                result = True
                del sessions[token]
                break

        return result
    else:
        return False

## CUSTOMER METHODS ##
# Creates a new project on behalf of customer username. The project is called pname, has
# description pdescription, and is initialised in the database. It is given it a unique project
# ID (pID) which is returned, along with whether the operation was successful

def createNewProject(pname, pdescription):
    if pname in projects:
        return False
    # No other project by this user has the given name
    
    projects[pname] = {"blobs": {}, "blobids": 0,  "unfinishedTasks": [], "description": pdescription, "graphing":{
        "activeWorkers":    [tuple((getTime(), 0))],
        "totalWorkers":     [tuple((getTime(), 0))],
        "tasksCompleted":   [tuple((getTime(), 0))],
        "tasksFailed":      [tuple((getTime(), 0))],
        "tasksRefused":     [tuple((getTime(), 0))]
    }}
    return True

# Creates a new blob, and stores it along with its metadata
def createNewBlob(pID, blob, metadata):
    # Check that the project exists
    try:
        test = projects[pID]
    except Exception:
        return (False, 0)

    # Create the new blob
    p = projects[pID]
    bID = p["blobids"]
    p["blobids"] += 1

    p["blobs"][bID] = {"blob": blob, "metadata": metadata, "task": False, "finished": False}

    return (True, bID)

# Convert blob blobID in project pID into a task, which is stored in the list of unfinished tasks
def blobToTask(pID, blobID):
    try:
        test = projects[pID]["blobs"][blobID]
    except Exception:
        return (False, "Failed to find blob")


    # Test whether the blob actually is a task
    try:
        task = projects[pID]["blobs"][blobID]["blob"]
        valid = True
        valid = valid and type(task["program"]["id"]) is int
        valid = valid and type(task["program"]["size"]) is int
        valid = valid and type(task["control"]) is bytes
        
        for blob in task["blobs"]:
            test = blob["id"]
            valid = valid and type(blob["size"]) is int
    except Exception:
        return (False, "Blob is not a correctly formatted task")

    if not valid:
        return (False, "Blob not a valid task")

    # The blob exists within the project
    projects[pID]["blobs"][blobID]["task"] = True
    

    # Push a copy onto the queue of "to-do" tasks
    projects[pID]["unfinishedTasks"].append(blobID)

    return (True, "")

# Return a dict mapping blobs IDs to their metadata. Can optionally specity a list of blobs
# whose metadata we'd like
def getBlobMetadata(pID, blobIDs):
    try:
        test = projects[pID]
    except Exception:
        return (False, "Failed to find project")

    metas = {}
    for blobID, blob in projects[pID]["blobs"].items():
        if blobIDs == [] or blobID in blobIDs:
            metas[blobID] = blob["metadata"]

    return (True, metas)

# Return blob blobID from project pID, along with its metadata
def getBlob(pID, blobID):
    try:
        b = projects[pID]["blobs"][blobID]
    except Exception:
        return (False, 0, 0)
    
    return (True, b["blob"], b["metadata"])

# Deletes blob blobID from project pID, returns if successful
def deleteBlob(pID, blobID):
    try:
        b = projects[pID]["blobs"][blobID]
    except Exception:
        return (False, "Could not fetch blobs")

    del projects[pID]["blobs"][blobID]
    return (True, "")


## WORKER METHODS ##

# Returns a unique identifier for a task from the tasklist for the worker to get on with
def getTasks(pID, username, maxtasks):
    try:
        b = projects[pID]
    except Exception:
        return (False, "Project does not exist", 0)

    # Test if the unfinished tasks array has been constructed
    try:
        users[username]["issuedTasks"][pID]
    except Exception:
        # This is a first-time active user
        changeGraph(pID, "totalWorkers", 1)
        users[username]["issuedTasks"][pID] = []
        

    if users[username]["issuedTasks"][pID] == []:
        # This is a first time user on this task
        changeGraph(pID, "activeWorkers", 1)

    # Find new tasks to be done
    taskIDs = list(map(int, np.setdiff1d(projects[pID]["unfinishedTasks"], users[username]["issuedTasks"][pID]) [:maxtasks]))

    #unf = projects[pID]["unfinishedTasks"]
    #taskID = unf.pop(0)
    #unf.append(taskID)

    # Find the associated blob with each task ID
    tasks = []
    for t in taskIDs:
        (succ, b, m) = getBlob(pID, t)
        if not succ:
            return (False, "Task collection error", 0)

        tasks.append(b)

    users[username]["issuedTasks"][pID] = users[username]["issuedTasks"][pID] + taskIDs

    return (True, tasks, taskIDs)

# Stores the list of blobs in the database, along with the metadata
def sendTasks(pID, taskID, results, metadatas, username, status):
    try:
        b = projects[pID]["blobs"][taskID]
    except Exception:
        return (False, "Task does not exist")
    
    # Test that this phone completed tasks it was supposed to

    if not taskID in users[username]["issuedTasks"][pID]:
        return (False, "Task was not scheduled. Scheduled tasks: " + str(users[username]["issuedTasks"]))

    # If status is ok, count the task as completed
    if status == "ok":
        # Take the old task off the task list
        for i, bID in enumerate(projects[pID]["unfinishedTasks"]):
            if bID == taskID:
                del projects[pID]["unfinishedTasks"][i]
                break

        # Create all the new blobs
        for (blob, meta) in zip(results, metadatas):
            createNewBlob(pID, blob, meta)
        
        # Update graphing info
        changeGraph(pID, "tasksCompleted", 1)

    # If status is error, we can give the task back later
    elif status == "error":
        users[username]["issuedTasks"][pID].remove(taskID)
        changeGraph(pID, "tasksFailed", 1)

    # If status is refused, we will eventually give the task to someone else
    elif status == "refused":
        changeGraph(pID, "tasksRefused", 1)
    else:
        return (False, "Invalid error code")
        
    return (True, "")

## GRAPHING METHODS
def getGraphs(pname):
    if not pname in projects:
        return (False, "Invalid project name")

    return (True, projects[pname]["graphing"])
