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
        
        if not database.createNewProject(pname, pdescription):
            return errormsg("Sorry, project name is taken.")

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

        (succ, blobID) = database.createNewBlob(pname, blob, metadata)
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

        (succ, msg) = database.blobToTask(pname, blobID)
        if not succ:
            return errormsg("Database failure: " + msg)

        return(cbor.dumps({'success': True, 'error': ''}))
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

        (succ, metas) = database.getBlobMetadata(pname, blobIDs)
        if not succ:
            return errormsg("Database failure: " + metas)
        return(cbor.dumps({'success': True, 'error': '', 'metadata': metas}))
    
    @cherrypy.expose
    # token, pname, name
    def getBlob(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs, check access level
        try:
            token = str(body["token"])
            pname = str(body["pname"])
            name = int(body["name"])
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        (succ, b, m) = database.getBlob(pname, name)

        if not succ:
            return errormsg("Database error")

        return cbor.dumps({'success': True, 'error': '', 'blob': b, 'metadata': m})

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

        (succ, accesslevel) = database.querySession(token, "accesslevel")
        if not succ:
            return errormsg("Database could not identify accesslevel. Invalud session.")
        if accesslevel != "customer":
            return errormsg("Invalid access level.")

        (succ, msg) = database.deleteBlob(pname, blobID)
        if not succ:
            return errormsg("Database failed: " + msg)
        return success()

    # token, pname, maxtasks
    @cherrypy.expose
    def getTasks(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs, check access level
        try:
            token = str(body["token"])
            username = database.querySession(token, "username")[1]
            print("Session name: " + username)
            pname = str(body["pname"])
            maxtasks = int(body["maxtasks"])
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        (succ, tasks, taskIDs) = database.getTasks(pname, username, maxtasks)
        if not succ:
            return errormsg("Database failed: " + tasks)

        # Returns a list of up to maxtasks tasks
        return cbor.dumps({"success": True, "error": "", "tasks": tasks, "taskIDs": taskIDs})

    # Takes the token, the customer name and project name being worked on, the task ID, and blobsandmetas, a list of
    # tuples mapping each blob to its metadata
    # token, pname, taskID, results
    @cherrypy.expose
    def sendTasks(self):
        # Get request body
        try:
            body = cbor.loads(cherrypy.request.body.read())
        except Exception:
            return errormsg("Incorrectly encoded body")

        # Sanity check inputs, check access level
        try:
            token = str(body["token"])
            username = database.querySession(token, "username") [1]
            pname = str(body["pname"])
            taskID = int(body["taskID"])
            results = body["results"]
            metadatas = body["metadatas"]
            status = str(body["status"])
        except Exception:
            return errormsg("Invalid inputs")
        
        if not all(isInstance(item, tuple) for item in results):
            return errormsg("Blobs and metas in invalid format - supposed to be a list of tuples")

        if not checkSessionActive(token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        (succ, msg) = database.sendTasks(pname, taskID, results, metadatas, username, status)
        if not succ:
            return errormsg("Database error: " + msg)

        return(cbor.dumps({'success': True, 'error': ''}))
        return success()

    @cherrypy.expose
    def reboot(self):
        if not PRODUCTION:
            cherrypy.engine.restart()
            return success()

if __name__ == '__main__':
    cherrypy.config.update({'server.socket_host': '0.0.0.0',
                            'server.socket_port': 8081,
                            'tools.sessions.on' : True,
                            'tools.sessions.timeout': 10    # Sessions time out after 10 mins
                            })
                            
    cherrypy.quickstart(RootServer())
