#!/bin/bash

# Add the new columns to the users table if they don't exist
psql -U anshviswanathan -d patch_db -c "
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS latitude FLOAT,
ADD COLUMN IF NOT EXISTS longitude FLOAT,
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;
"

echo "Database updated with location columns!" 