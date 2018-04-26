#!/bin/bash
cd /home/ec2-user/DistributedPhone
git pull
echo Pull finished
./build.sh
