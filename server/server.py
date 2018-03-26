import cherrypy, os, cbor
from urllib.parse import urlparse
import database



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
    def register(username, password, accesslevel):
        if accesslevel not in ["customer", "worker"]:
            return errormsg("Invalid accesslevel. Should be 'customer' or 'worker'.")

        # Registers a new user
        if not database.register(username, password, accesslevel):
            return errormsg("Registration failed.")

        return success()

    @cherrypy.expose
    def login(username, password, accesslevel):
        # Reset the current session
        cherrypy.session.regenerate()
        if accesslevel not in ["customer", "worker"]:
            return errormsg("Invalid accesslevel. Should be 'customer' or 'worker'.")

        if not database.login(username, password, accesslevel):
            return errormsg("Invalid username or password.")

        # Session successfully initiated
        token = generateToken()
        cherrypy.session['username'] = username
        cherrypy.session['token'] = token
        cherrypy.session['accesslevel'] = accesslevel
        return(cbor.dumps({'success': True, 'error': '', 'token': token}))
        
    def logout(username, token):
        # Check that the user has an active session
        if not checkSessionActive(cherrypy.session, token):
            return errormsg("Session expired or invalid token in logout. Please try again.")
        
        if username != cherrypy.session['username']:
            return errormsg("Invalid username in logout.")
        
        destroySession(cherrypy.session)

        return success()

    ## Customer methods ##

    @cherrypy.expose
    def createNewProject(token, pname, pdescription):
        if not checkSessionActive(cherrypy.session, token):
            return errormsg("Session expired or invalid token in logout. Please try again.")

        # Sanity check inputs
        if type(pname) != str or type(pdescription != str):
            return errormsg("Invalid project name or description")

        if cherrypy.session['accesslevel'] != "customer":
            return errormsg("Invalid access level")
        
        (succ, pID) = database.createNewProject(cherrypy.session["username"], pname, pdescription)
        if not succ:
            return errormsg("Database failed on createNewProject")

        return(cbor.dumps({'success': True, 'error': '', 'pID': pID}))


if __name__ == '__main__':
    cherrypy.config.update({'server.socket_host': '0.0.0.0',
                            'server.socket_port': 8081,
                            'tools.sessions.on' : True,
                            'tools.sessions.timeout': 10    # Sessions time out after 10 mins
                            })
                            
    cherrypy.quickstart(RootServer())

