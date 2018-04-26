#!/bin/bash

# Run server tests
#cd server
#python3 server.py 9999 & # Run server in background. Need to get PID to kill it later
#cd servertests
#python3 autotester.py quiet # Run tests on server. Need to make successful overall tests return 0

# Asssuming tests went okay
echo Copying server data
cp -r /home/ec2-user/DistributedPhone/server /data
echo Done
