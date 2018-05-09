from serverRequest import *
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
(success, data) = createNewProject(token, projectName, "Help us solve the Collatz conjecture")

graphs = { 
   "highestResults": { 
        "type": 'scatter',
        "data": {
            "datasets": [{
                "label": 'Longest sequences computed from tasks',
                "borderColor": 'rgb(0, 255, 0)',
                "data": {"x": 0, <C-F11><C-F11><C-F11>},
                "showLine": True,
                "lineTension": 0.0 
            }]
        },
        "options": {
            "scales": {
                "xAxes": [{
                    "time": {
                        "unit": 'second'    
                    }
                }]
            }
        }
   }
}

updateGraphs(token, graphs, projectName)

(success, dataLogout) = logout(token)
if (success):
    print ("Rebooted, Registered Customer, Created new project")
    print ("username: " + username)
    print ("password: " + password)
    print ("projectName: " + projectName)

