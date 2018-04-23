import cherrypy, os, cbor
from urllib.parse import urlparse
import database

global debug
debug = True

def log(msg):
    if debug:
        print(msg)

# Generic Functions
# Deletes the specified session
def destroySession(sess):
        cherrypy.session['username'] = None
        cherrypy.session['token'] = None
        cherrypy.session['accesslevel'] = None

# Checks whether the session is currently active. Guarantees that hereafter the method will
# not crash if the session does not exist
def checkSessionActive(sess, token):
        try:
            assert cherrypy.session['username'] != None
            assert cherrypy.session['token'] != None
            assert cherrypy.session['accesslevel'] != None
        except Exception:
            return False

        return cherrypy.session['token'] == token


# Creates a new token
def generateToken():
    return 0

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
    def register(self, username, password, accesslevel):
        # Sanity check inputs
        try:
            username = str(username)
            accesslevel = str(accesslevel)
            password = str(password)
        except Exception:
            return errormsg("Invalid inputs")

        if accesslevel not in ["customer", "worker"]:
            return errormsg("Invalid accesslevel. Should be 'customer' or 'worker'.")

        # Registers a new user
        if not database.register(username, password, accesslevel):
            return errormsg("Registration failed.")

        return success()

    @cherrypy.expose
    def login(self, username, password, accesslevel):
        # Sanity check inputs
        try:
            username = str(username)
            accesslevel = str(accesslevel)
            password = str(password)
        except Exception:
            return errormsg("Invalid inputs")

        # Reset the current session
        cherrypy.session.regenerate()
        if accesslevel not in ["customer", "worker"]:
            return errormsg("Invalid accesslevel. Should be 'customer' or 'worker'.")

        (succ, token) = database.login(username, password, accesslevel)
        if not succ:
            return errormsg("Login failed. Invalid username or password.")


        # Session successfully initiated
        cherrypy.session['username'] = username
        cherrypy.session['token'] = token
        cherrypy.session['accesslevel'] = accesslevel
        cherrypy.session['issuedTasks'] = []
        return(cbor.dumps({'success': True, 'error': '', 'token': token}))
        
    @cherrypy.expose
    def logout(self, token):
        # Sanity check inputs
        try:
            token = int(token)
        except Exception:
            return errormsg("Invalid token")

        # Check that the user has an active session
        if not checkSessionActive(cherrypy.session, token):
            return errormsg("Session expired or invalid token in logout. Please try again.")
        
        destroySession(cherrypy.session)

        return success()

    ## Customer methods ##

    @cherrypy.expose
    def createNewProject(self, token, pname, pdescription):
        # Sanity check inputs
        try:
            token = int(token)
            pname = str(pname)
            pdescription = str(pdescription)
        except Exception:
            return errormsg("Invalid inputs")


        if not checkSessionActive(cherrypy.session, token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        if cherrypy.session['accesslevel'] != "customer":
            return errormsg("Invalid access level")
        
        if not database.createNewProject(cherrypy.session["username"], pname, pdescription):
            return errormsg("Database failed on createNewProject")

        return success()

    @cherrypy.expose
    def createNewBlob(self, token, pname, blob, metadata):
        # Sanity check inputs, check access level
        try:
            token = int(token)
            pname = str(pname)
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(cherrypy.session, token):
            return errormsg("Session expired or invalid token in logout. Please try again.")
        
        if cherrypy.session["accesslevel"] != "customer":
            return errormsg("Invalid access level.")

        username = cherrypy.session["username"]
        (succ, blobID) = database.createNewBlob(username, pname, blob, metadata)
        if succ:
            return(cbor.dumps({'success': True, 'error': '', 'blobID': blobID}))
        else:
            return errormsg("Database failure.")

    @cherrypy.expose
    def blobToTask(self, token, pname, blobID):
        # Sanity check inputs, check access level
        try:
            token = int(token)
            pname = str(pname)
            blobID = int(blobID)
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(cherrypy.session, token):
            return errormsg("Session expired or invalid token in logout. Please try again.")
        
        if cherrypy.session["accesslevel"] != "customer":
            return errormsg("Invalid access level.")

        username = cherrypy.session["username"]
        succ = database.blobToTask(username, pname, blobID)
        if not succ:
            return errormsg("Database failure")

        return success()

    @cherrypy.expose
    def getBlobMetadata(self, token, pname, blobIDs):
        # Sanity check inputs, check access level
        try:
            token = int(token)
            pname = str(pname)
            blobIDs = blobIDs.split()
            for i, blob in enumerate(blobIDs):
                blobIDs[i] = int(blob)
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(cherrypy.session, token):
            return errormsg("Session expired or invalid token in logout. Please try again.")
        
        if cherrypy.session["accesslevel"] != "customer":
            return errormsg("Invalid access level.")

        username = cherrypy.session["username"]
        (succ, metas) = database.getBlobMetadata(username, pname, blobIDs)
        return(cbor.dumps({'success': True, 'error': '', 'metadata': metas}))
    
    @cherrypy.expose
    def getBlobs(self, token, pname, blobIDs):
        # Sanity check inputs, check access level
        try:
            token = int(token)
            pname = str(pname)
            blobIDs = blobIDs.split()
            for i, blob in enumerate(blobIDs):
                blobIDs[i] = int(blob)
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(cherrypy.session, token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        username = cherrypy.session["username"]
        bloblist = []
        for blobID in blobIDs:
            (succ, b, m) = database.getBlob(username, pname, blobID)
            bloblist += (b, m)

        return cbor.dumps({'success': True, 'error': '', 'blobs': bloblist})

    @cherrypy.expose
    def deleteBlob(self, token, pname, blobID):
        # Sanity check inputs, check access level
        try:
            token = int(token)
            pname = str(pname)
            blobID = int(blobID)
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(cherrypy.session, token):
            return errormsg("Session expired or invalid token in logout. Please try again.")
        
        if cherrypy.session["accesslevel"] != "customer":
            return errormsg("Invalid access level.")

        username = cherrypy.session["username"]
        succ = database.deleteBlob(username, pname, blobID)
        if not succ:
            return errormsg("Database failed")
        return success()

    @cherrypy.expose
    def getNewTask(self, token, customername, pname):
        # Sanity check inputs, check access level
        try:
            token = int(token)
            customername = str(customername)
            print("Customer name: " + customername)
            print("Session name: " + cherrypy.session["username"])
            pname = str(pname)
        except Exception:
            return errormsg("Invalid inputs")

        if not checkSessionActive(cherrypy.session, token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        (succ, bID, how) = database.getNewTask(customername, pname)
        if not succ:
            return errormsg("Database failed " + how)

        # Record in-session that the task was given out
        cherrypy.session["issuedTasks"] = cherrypy.session["issuedTasks"] + [bID]
        return cbor.dumps({"success": True, "error": "", "taskID": bID})

    # Takes the token, the customer name and project name being worked on, the task ID, and blobsandmetas, a list of
    # tuples mapping each blob to its metadata
    @cherrypy.expose
    def taskDone(self, token, customername, pname, taskID, blobsandmetas):
        # Sanity check inputs, check access level
        try:
            token = int(token)
            customername = str(customername)
            pname = str(pname)
            taskID = int(taskID)
        except Exception:
            return errormsg("Invalid inputs")
        
        if not all(isInstance(item, tuple) for item in blobsandmetas):
            return errormsg("Blobs and metas in invalid format - supposed to be a list of tuples")

        if not checkSessionActive(cherrypy.session, token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        if taskID not in cherrypy.session["issuedTasks"]:
            return errormsg("You were not issued this task.")

        if not database.taskDone(customername, pname, taskID, blobsandmetas):
            return errormsg("Database error")

        return success()


if __name__ == '__main__':
    cherrypy.config.update({'server.socket_host': '0.0.0.0',
                            'server.socket_port': 8081,
                            'tools.sessions.on' : True,
                            'tools.sessions.timeout': 10    # Sessions time out after 10 mins
                            })
                            
    cherrypy.quickstart(RootServer())

