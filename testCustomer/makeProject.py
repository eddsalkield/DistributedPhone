from tests import *
import sys
import time

reboot()
time.sleep(1)

try:
    username = sys.argv[1]
    password = sys.argv[2]
    projectName = sys.argv[3]
except:
    print("Please enter a username, password and projectname")
    sys.exit()

try:
    testPing()
except Exception:
    print("Server is down")
    sys.exit()

(success, dataRegister) = registerCustomer(username, password)
if (not success):
    print ("sad")
    print (dataRegister["error"])
    sys.exit()

(success, dataLogin) = login(username, password, "customer")
if (not success):
    print ("Sad 2 ): ")
    sys.exit()

token = dataLogin["token"]
(success, data) = createNewProject(token, "Project", "test1")

(success, dataLogout) = logout(token)
if (success):
    print ("Rebooted, Registered Customer, Created new project")
    print ("username: " + username)
    print ("password: " + password)
    print ("projectName: " + projectName)
