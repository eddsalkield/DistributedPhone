import sys, cbor, socket, urllib2
from time import sleep

eddserver = 'http://35.178.90.246:8081/'
project_name = "collatz"
pdescription = "Finding numbers with long collatz sequences"

class TaskDistributor:

	## --- Work in Progress --- ### (won't compile)

	# Areas for improvement:
	# 	-- Better distribution of task sizes / greater variety in interval length
	#	-- Better storage of results (and actually doing something with them)
	# 	-- Cap on the number of tasks put out there, with constant filling up:
	#			At the moment we just put the entire range out there to be done by workers, 
	#			then wait for them all to be computed. Although this isn't so bad as the blobs / 
	#			tasks are quite small in size, it's not ideal. Instead we should put, say,
	#			100 tasks out at a time, and replace them with new ones each time they done.

	# For now we just have a fixed range.
	# Starting at 'search_start', we have 'number_tasks' intervals of length 'fixed_range'
	# So the total search will be between [search_start ... search_start + fixed_range * number_tasks)
	search_start = 900000
	fixed_range  = 10000
	number_tasks = 100

	def __init__ (self, token, projectID, scanPeriod):
		self.results = [] 			  # List of results: List of (number, sequenceLength) pairs -- may be ordered ?? will be big
		self.relevantBlobs = []		  # List of relevant blobs - may not be best DS and may not be needed.
		self.token = token
		self.projectID = projectID
		self.scanPeriod = scanPeriod # How often should it scan the DB looking for finished blobs?
		initTasks()
		monitorBlobs()
	
	def initTasks (self)
		for taskNo in range (0, number_tasks):
			start = search_start + taskNo * fixedRange
			newBlobID = _makeTask (start, start + fixedRange - 1)
			self.relevantBlobs.append(newBlobID)

	## --- Work in Progress --- ##
	def _makeTask (self, start, end):
		blob = STRING/CBOR of (start, end) tuple ??
		metadata = JSON/CBOR of { *metadata stuff* }
		blobID = something.createNewBlob (self.token, self.projectID, blob, metadata)
		taskifyBlob (blobID)
		return blobID
 Updated 35 minutes ago by OliverWD
0
1

	# When a worker finished a computation, it places a blob in the database along with metadata
	# indicating whether the task is finished. The customer will routinely scan (will it?) the database for
	# finished blobs and will acquire their results before deleting them.
	def monitorBlobs(self):

		while (1):

			metaBlobs = getBlobMetadata(self.token, self.projectID, self.relevantBlobs)

			# If there are no blobs	left
			if len(metaBlobs) == 0:
				break

			# Get IDs of all finished blobs
			finishedBlobIDs = []		
			for blob in metaBlobs:
				if (blob.finished):
					finishedBlobIDs.append(blob.ID)

		 	# Go through all finished blobs, get their results, save those results, print (for testing) and delete
			for blobIDs in finishedBlobIDs:
				blobGrab = getBlob(self.token, self.projectID, blobID)
				blobData = decodeBlobData
			
				# Data will be something of the form: (Start Range; End Range) and a list of (End Range - Start Range + 1) numbers
				startRange = blobData.startRange
				endRange = blobData.endRange
				seqLengthList = blobData.getSequences # : List[Int]

				number = startRange
				for seqLength in seqLengthList:
					self.results.append((number, seqLength))
					number += 1
					print((number, seqLength))

				# Finally, delete the blob
				deleteBlob(self.token, self.projectID, blobID)

			# Sleep before scanning again
			sleep(self.scanPeriod)


# Login to the server with command-line arguments (username, password)
# Returns session token
def login ():
	
	# Pass the username and password as command-line arguments:
	try:
		username = sys.argv[1]
		password = sys.argv[2]
	except:
		raise Exception('Please enter a username and password!')

	# Login to the server
	loginString = 'login?username=' + username + '&password=' + password + '&accesslevel=customer'
	loginRead = urllib2.urlopen(eddserver + loginString).read()
	loginDump = cbor.loads(loginRead)
	
	# Extract details from get request
	successLogin = loginDump.get('success')
	errorLogin   = loginDump.get('error')
	token			 = loginDump.get('token')	

	# If bad login, report & exit
	if not successLogin:
		print(errorLogin)
		sys.exit()

	return token

# Creates a new project with project name and description (above)
# Returns projectID
def createProject():

	projectString = 'createNewProject?token=' + str(token) + '&pname=collatz&pdescription=' + pdescription
	projectRead = urllib2.urlopen(eddserver + projectString).read()
	projectDump = cbor.loads(projectRead)

	successProject = projectDump.get('success')
	errorProject = projectDump.get('error')
	projectID = projectDump.get('pID')

	if not successProject:
		print(errorProject)
		sys.exit()

	return projectID

############### START HERE ################
if __name__ == '__main__':

	# Just ping server to check it's up and running
	try: 
    	 urllib2.urlopen(eddserver + 'ping', timeout = 1)
	except urllib2.URLError as e:
		 raise Exception('URL error: %r' % e)    			 
	except socket.timeout as e:
		 raise Exception("Socket timeout %r" % e)	

	token = login()
	projectID = createProject() 

	# Now we can actually start making and distributing tasks... set scanning to 5s period
	distributor = TaskDistributor(token, projectID, 5)
