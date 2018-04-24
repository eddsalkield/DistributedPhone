import cherrypy, os, cbor
from urllib.parse import urlparse
import database
from header import *
from time import mktime
from datetime import datetime

global debug
debug = True

def log(msg):
    if debug:
        print(msg)

# Generic Functions
def getTime():
    return mktime(datetime.now().timetuple())


# Checks whether the session is currently active
def checkSessionActive(token):
    if not database.querySession(token, "username")[0]:
        return False

    sessiontime = database.querySession(token, "starttime")[1]
    if sessiontime + SESSION_EXPIRE < getTime():
        return False

    return True


# Generic Responses
def errormsg(m):
    return(cbor.dumps({'success': False, 'error': m}))

def success():
    return(cbor.dumps({'success': True, 'error': ''}))


class RootServer:
    @cherrypy.expose
    def ping(self):
        return success()

    @cherrypy.expose
    def register(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs
        try:
            username = str(body["username"])
            accesslevel = str(body["accesslevel"])
            password = str(body["password"])
        except Exception:
            return errormsg("Invalid inputs")

        if accesslevel not in ["customer", "worker"]:
            return errormsg("Invalid accesslevel. Should be 'customer' or 'worker'.")

        # Registers a new user
        if not database.register(username, password, accesslevel):
            return errormsg("Registration failed.")

        return success()

    # username, password, accesslevel
    @cherrypy.expose
    def login(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs
        try:
            username = str(body["username"])
            accesslevel = str(body["accesslevel"])
            password = str(body["password"])
        except Exception:
            return errormsg("Invalid inputs")

        # Reset the current session
        database.deleteSession(username, "username")
        if accesslevel not in ["customer", "worker"]:
            return errormsg("Invalid accesslevel. Should be 'customer' or 'worker'.")

        (succ, token) = database.login(username, password, accesslevel)
        if not succ:
            return errormsg("Login failed. Invalid username or password.")

        return cbor.dumps({'success': True, 'error': '', 'token': token})
        
    # token
    @cherrypy.expose
    def logout(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs
        try:
            token = str(body["token"])
        except Exception:
            return errormsg("Invalid token")

        # Check that the user has an active session
        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")
        
        database.deleteSession(token, "token")

        return success()

    ## Customer methods ##

    # token, pname, pdescription
    @cherrypy.expose
    def createNewProject(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs
        try:
            token = str(body["token"])
            pname = str(body["pname"])
            pdescription = str(body["pdescription"])
        except Exception:
            return errormsg("Invalid inputs")


        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        if database.querySession(token, "accesslevel")[1] != "customer":
            return errormsg("Invalid access level")
        
        if not database.createNewProject(database.querySession(token, "username")[1], pname, pdescription):
            return errormsg("Database failed on createNewProject")

        return success()

    # token, pname, blob, metadata
    @cherrypy.expose
    def createNewBlob(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs, check access level
        try:
            token = str(body["token"])
            pname = str(body["pname"])
            blob = body["blob"]
            metadata = body["metadata"]
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")
        
        if database.querySession(token, "accesslevel")[1] != "customer":
            return errormsg("Invalid access level.")

        username = database.querySession(token, "username")[1]
        (succ, blobID) = database.createNewBlob(username, pname, blob, metadata)
        if succ:
            return(cbor.dumps({'success': True, 'error': '', 'blobID': blobID}))
        else:
            return errormsg("Database failure.")

    # token, pname, blobID
    @cherrypy.expose
    def blobToTask(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs, check access level
        try:
            token = str(body["token"])
            pname = str(body["pname"])
            blobID = int(body["blobID"])
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")
        
        if database.querySession(token, "accesslevel")[1] != "customer":
            return errormsg("Invalid access level.")

        username = database.querySession(token, "username")[1]
        (succ, msg) = database.blobToTask(username, pname, blobID)
        if not succ:
            return errormsg("Database failure: " + str(msg) )

        return(cbor.dumps({'success': True, 'error': '', 'msg': msg}))
        return success()

    # Token, pname, blobIDs
    @cherrypy.expose
    def getBlobMetadata(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs, check access level
        try:
            token = str(body["token"])
            pname = str(body["pname"])
            blobIDs = []
            for i, blob in enumerate(body["blobIDs"]):
                blobIDs.append(int(blob))
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")
        
        if database.querySession(token, "accesslevel")[1] != "customer":
            return errormsg("Invalid access level.")

        username = database.querySession(token, "username")[1] 
        (succ, metas) = database.getBlobMetadata(username, pname, blobIDs)
        return(cbor.dumps({'success': True, 'error': '', 'metadata': metas}))
    
    @cherrypy.expose
    # token, pname, blobIDs
    def getBlobs(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs, check access level
        try:
            token = str(body["token"])
            pname = str(body["pname"])
            blobIDs = []
            for i, blob in enumerate(body["blobIDs"]):
                blobIDs.append(int(blob))
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        username = database.querySession(token, "username")[1] 
        bloblist = []
        for blobID in blobIDs:
            (succ, b, m) = database.getBlob(username, pname, blobID)
            bloblist += (b, m)

        return cbor.dumps({'success': True, 'error': '', 'blobs': bloblist})

    # token, pname, blobID
    @cherrypy.expose
    def deleteBlob(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs, check access level
        try:
            token = str(body["token"])
            pname = str(body["pname"])
            blobID = int(body["blobID"])
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")
        
        username = database.querySession(token, "username")[1] 
        if database.querySession(token, "accesslevel")[1] != "customer":
            return errormsg("Invalid access level.")

        username = database.querySession(token, "username")[1] 
        succ = database.deleteBlob(username, pname, blobID)
        if not succ:
            return errormsg("Database failed")
        return success()

    # token, customername, pname
    @cherrypy.expose
    def getNewTask(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs, check access level
        try:
            token = str(body["token"])
            username = database.querySession(token, "username") [1]
            customername = str(body["customername"])
            print("Customer name: " + customername)
            print("Session name: " + username)
            pname = str(body["pname"])
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        (succ, bID, how) = database.getNewTask(customername, pname, username)
        if not succ:
            return errormsg("Database failed " + how)

        return cbor.dumps({"success": True, "error": "", "taskID": bID})

    # Takes the token, the customer name and project name being worked on, the task ID, and blobsandmetas, a list of
    # tuples mapping each blob to its metadata
    # token, customername, pname, taskID, blobsandmetas
    @cherrypy.expose
    def taskDone(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs, check access level
        try:
            token = str(body["token"])
            username = database.querySession(token, "username") [1]
            customername = str(body["customername"])
            pname = str(body["pname"])
            taskID = int(body["taskID"])
            blobsandmetas = body["blobsandmetas"]
        except Exception:
            return errormsg("Invalid inputs")
        
        if not all(isInstance(item, tuple) for item in blobsandmetas):
            return errormsg("Blobs and metas in invalid format - supposed to be a list of tuples")

        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        (succ, msg) = database.taskDone(customername, pname, taskID, blobsandmetas, username)
        if not succ:
            return errormsg("Database error")

        return(cbor.dumps({'success': True, 'error': '', 'msg': msg}))
        return success()


if __name__ == '__main__':
    cherrypy.config.update({'server.socket_host': '0.0.0.0',
                            'server.socket_port': 8081,
                            'tools.sessions.on' : True,
                            'tools.sessions.timeout': 10    # Sessions time out after 10 mins
                            })
                            
    cherrypy.quickstart(RootServer())
