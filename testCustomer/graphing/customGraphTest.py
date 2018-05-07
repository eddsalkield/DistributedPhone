# Automated tests for graph drawing
import sys
from tests import *
import time
import random, string


VERBOSE = True  # Set to true if you want all data to be printed
PROJECT_NAME = "Project"
PROJECT_DESCRIPTION = "This is the project description"
CUSTOMER_NAME = "Edd"
CUSTOMER_PASS = "password"


def test(res, testname):
    (succ, data) = res
    time.sleep(0.1)
    if succ:
        print(testname + " AOK")
        if VERBOSE:
            print(data)
        return data        
    else:
        print(testname + " FAILED")
        if VERBOSE:
            print(data)
        sys.exit(str(data))


# Create a custom graph to upload
customGraphs = {
    "testGraph1": {
        "type": 'scatter',
        "data": {
            "datasets": [
                {
                    "label": 'good1m80',
                    "borderColor": 'rgb(0, 255, 0)',
                    "data": [
                        {"x": 0, "y": 0},
                        {"x": 1, "y": 1},
                        {"x": 2, "y": 2}
                    ],
                    "showLine": True,
                    "lineTension": 0.1
                },
                {
                    "label": 'bad1m90',
                    "borderColor": 'rgb(0, 0, 255)',
                    "data": [
                        {"x": 0, "y": 0},
                        {"x": 1, "y": 5},
                        {"x": 2, "y": 5}
                    ],
                    "showLine": False,
                    "lineTension": 0.1
                }]
        },
        "options": {
            "scales": {
                "xAxes": [{
                    "type": 'time',
                    "time": {
                            "unit": 'second'
                    }
                }]
            }
        }
    },
    "testGraph2": {
        "type": 'scatter',
        "data": {
            "datasets": [
                {
                    "label": 'Good',
                    "borderColor": 'rgb(0, 255, 0)',
                    "data": [
                        {"x": 0, "y": 0},
                        {"x": 50, "y": 150},
                        {"x": 100, "y": 100}
                    ],
                    "showLine": True,
                    "lineTension": 0.1
                }
            ]
        },
        "options": {
            "scales": {
                "xAxes": [{
                    #"type": 'time',
                    #"time": {
                    #        "unit": 'second'
                    #}
                }]
            }
        }
    }
}


time.sleep(1)
data = test(registerCustomer(CUSTOMER_NAME, CUSTOMER_PASS), "Test register customer")
ctok = test(login(CUSTOMER_NAME, CUSTOMER_PASS, "customer"), "testCustomerLogin")["token"]
test(createNewProject(ctok, PROJECT_NAME, PROJECT_DESCRIPTION), "testCreateNewProject")

test(updateGraphs(ctok, customGraphs, PROJECT_NAME), "testUpdateGraphs")
