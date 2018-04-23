# A skeleton database program
# NB: INPUTS ARE NOT GUARANTEED SAFE OR SANITISED. PLEASE SANITISE YOUR INPUTS FOR THE DATABASE

## AUTHENTICATION ##
# Registers a new user in the database
def register(username, password, accesslevel):
    return True

# Returns whether the username corresponds to the password of a user, of level accesslevel
def login(username, password, accesslevel):
    return True

# Returns the requested user's token, in case the server needs it again
# Also returns whether the user was currently logged in
def getToken(username): 
    token = None # Get token from database
    return (True, token)
    

## CUSTOMER METHODS ##
# Creates a new project on behalf of customer username. The project is called pname, has
# description pdescription, and is initialised in the database. It is given it a unique project
# ID (pID) which is returned, along with whether the operation was successful
def createNewProject(username, pname, pdescription):
    #find largest pID to date (by counting rows) and add 1
    pID = 1 + c.execute("SELECT COUNT(*) FROM Project")
    #find id relating to username
    u = (username,)
    customerID = c.execute('SELECT customerID FROM Project WHERE customername=?', u)
    #put info into Project table
    c.execute("INSERT INTO Project (pID, pname, pdescription, customerID) VALUES (pID, pname, pdescription, customerID)")
    return (True, pID)

# Stores task in the list of unfinished tasks associated with project pID. Each task should
# have a unique task ID
def createNewTask(pID, task):
    #find largest taskID to date (by counting rows) and add 1
    taskID = 1 + c.execute("SELECT COUNT(*) FROM Project_task")
    c.execute("INSERT INTO Project_task (taskID, task, pID) VALUES (taskID, task, pID)")
    return True

# Convert blob blobID in project pID into a task, which is stored in the list of unfinished tasks
def blobToTask(pID, blobID):
    return True

# Creates a new blob, and stores it along with its metadata
def createNewBlob(pID, blob, metadata):
    blobID = 0
    return blobID

# Return a dict mapping blobs IDs to their metadata. Can optionally specity a list of blobs
# whose metadata we'd like
def getBlobMetadata(*args):
#    blobs = {
#        1: blob1metadata,
#        2: blob2metadata,...
#    }
    blobs = None
    return blobs

# Return blob blobID from project pID, along with its metadata
def getBlob(pID, blobID):
    metadata = None
    blob = None
    return (metadata, blob)

# Deletes blob blobID from project pID, returns if successful
def deleteBlob(pID, blobID):
    return True


## WORKER METHODS ##

# Returns a new task from the tasklist for the worker to get on with, along with a unique
# identifier for the task
def getNewTask(pID):
    task = None
    taskID = 0
    return (task, taskID)

# Stores the list of blobs in the database, along with the metadata
def taskDone(pID, taskID, blobs, blobmetadatas):
   return True 




# logout should automatically be called by the server after the right amount of time
# Tokens will be kept server-side somewhat, how often should cookies refresh etc?
