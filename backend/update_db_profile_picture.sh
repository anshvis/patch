#!/bin/bash

# Add profile_picture column to users table
psql -U anshviswanathan -d patch_db -c "ALTER TABLE users ADD COLUMN profile_picture VARCHAR;"

echo "Added profile_picture column to users table" 