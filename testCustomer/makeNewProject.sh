#!/bin/bash
# Creates a new project

if [ -z "$3" ]; then
	echo "Usage"
       	echo "./makeNewProject username password projectname"
	echo "username - the name of the customer to be created, who owns the project."
	echo "password - the password of this user."
	echo "projectname - the name of the project they are creating."
else
	python3 makeProject.py "$1" "$2" "$3" && python3 collatzCustomer.py "$1" "$2" "$3"
fi
