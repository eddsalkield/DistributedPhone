# A skeleton database program
# NB: INPUTS ARE NOT GUARANTEED SAFE OR SANITISED. PLEASE SANITISE YOUR INPUTS FOR THE DATABASE

# Test implementation
from datetime import datetime
from time import mktime
import heapq, os

from header import *

def getTime():
    return mktime(datetime.now().timetuple())

def salthash(passwd, salt):
    return passwd

def generateToken():
    tok = ""
    tokenGenerated = False
    while not tokenGenerated:
        for i in range(0, TOKENSIZE):
            done = False
            while not done:
                c = os.urandom(1).decode("ascii", "ignore")
                if c != 0:
                    done = True
                    tok += c

        # Ensure the token is unique
        tokenGenerated = tok not in sessions

    return tok

users = {}	# Maps username to (password, accesslevel)
sessions = {}   # Maps a username to a session
                # Session comtains username, bool active, accesslevel. token, time
projects = {}   # Maps project names to projects

## AUTHENTICATION ##
# Registers a new user in the database
def register(username, password, accesslevel):
    if username in users:
        return False
    else:
        users[username] = {"hashpass": salthash(password, username), "accesslevel": accesslevel, "issuedTasks": []}
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
            return (True, token)
    return (False, 0)


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
        if token not in sessions:
            return False
        else:
            del sessions[token]
            return True
    elif kind == "username":
        result = False
        for i, (name, sesh) in enumerate(sessions.items()):
            if sesh["username"] == data:
                result = True
                del sessions[i]
                break

        return result
    else:
        return False

## CUSTOMER METHODS ##
# Creates a new project on behalf of customer username. The project is called pname, has
# description pdescription, and is initialised in the database. It is given it a unique project
# ID (pID) which is returned, along with whether the operation was successful

def createNewProject(username, pname, pdescription):
    if username in projects:
        if pname in projects[username]:
            return False
    else:
        projects[username] = {}
    # No other project by this user has the given name
    
    projects[username][pname] = {"blobs": {}, "blobids": 0,  "unfinishedTasks": [], "description": pdescription}

    return True

# Creates a new blob, and stores it along with its metadata
def createNewBlob(username, pID, blob, metadata):
    # Check that the project exists
    try:
        test = projects[username][pID]
    except Exception:
        return (False, 0)

    # Create the new blob
    p = projects[username][pID]
    bID = p["blobids"]
    p["blobids"] += 1

    p["blobs"][bID] = {"blob": blob, "metadata": metadata, "task": False, "finished": False}

    return (True, bID)

# Convert blob blobID in project pID into a task, which is stored in the list of unfinished tasks
def blobToTask(username, pID, blobID):
    try:
        test = projects[username][pID]["blobs"][blobID]
    except Exception:
        return False

    # The blob exists within the project
    projects[username][pID]["blobs"][blobID]["task"] = True

    # Push a copy onto the queue of "to-do" tasks
    time = getTime()
    heapq.heappush(projects[username][pID]["unfinishedTasks"], (time, blobID))

    return (True, projects[username][pID]["unfinishedTasks"])

# Return a dict mapping blobs IDs to their metadata. Can optionally specity a list of blobs
# whose metadata we'd like
def getBlobMetadata(username, pID, blobIDs):
    try:
        test = projects[username][pID]
    except Exception:
        return (False, 0)

    metas = {}
    for blobID, blob in projects[username][pID]["blobs"].items():
        if blobIDs == [] or blobID in blobIDs:
            metas[blobID] = blob["metadata"]

    return (True, metas)

# Return blob blobID from project pID, along with its metadata
def getBlob(username, pID, blobID):
    try:
        b = projects[username][pID]["blobs"][blobID]
    except Exception:
        return (False, 0, 0)
    
    return (True, b["blob"], b["metadata"])

# Deletes blob blobID from project pID, returns if successful
def deleteBlob(username, pID, blobID):
    try:
        b = projects[username][pID]["blobs"][blobID]
    except Exception:
        return False

    del projects[username][pID]["blobs"][blobID]
    return True


## WORKER METHODS ##

# Returns a unique identifier for a task from the tasklist for the worker to get on with
def getNewTask(customername, pID, username):
    try:
        b = projects[customername]
    except Exception:
        print("Fail1")
        return (False, 0, "fail1")


    try:
        b = projects[customername][pID]
    except Exception:
        print("Fail3")
        return (False, 0, "fail3")
    
    # Test for remaining tasks
    if projects[customername][pID]["unfinishedTasks"] == []:
        print("Fail2")
        return (False, 0, "fail2")

    # Find the next unfinished task
    unf = projects[customername][pID]["unfinishedTasks"]
    taskID = heapq.heappop(unf)[1]
    heapq.heappush(unf, (getTime(), taskID))

    # Add this task onto the user's list of unfinished tasks
    
    users[username]["issuedTasks"] += ((customername, pID, taskID),)

    return (True, taskID, "succ")

# Stores the list of blobs in the database, along with the metadata
def taskDone(customername, pID, taskID, blobsandmetas, username):
    try:
        b = projects[customername][pID]["blobs"][taskID]
    except Exception:
        return (False, "msg2")
    
    # Test that this phone completed a task it was supposed to
    if not (customername, pID, taskID) in users[username]["issuedTasks"]:
        #return (False, str(users[username]["issuedTasks"]) + "|" + customername + "|" + pID + "|" + str(taskID))
        return (False, "msg1")

    # Take the old task off the task list
    for i, (time, bID) in enumerate(projects[customername][pID]["unfinishedTasks"]):
        if bID == taskID:
            del projects[customername][pID]["unfinishedTasks"][i]
            break

    # Create all the new blobs
    for (blob, meta) in blobsandmetas:
        createNewBlob(customername, pID, blob, meta)

    return (True, str(projects[customername][pID]["unfinishedTasks"]))
