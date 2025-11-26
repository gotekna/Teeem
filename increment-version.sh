#!/bin/bash
# Script to increment version after frontend deploy
curl -X POST https://teeem-backend-447058022b51.herokuapp.com/version/increment
echo ""
echo "Version incremented!"
