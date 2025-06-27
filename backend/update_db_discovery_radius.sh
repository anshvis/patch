#!/bin/bash

# Add discovery_radius column to users table
psql -U anshviswanathan -d patch_db -c "ALTER TABLE users ADD COLUMN discovery_radius FLOAT DEFAULT 10;"

echo "Added discovery_radius column to users table with default value of 10 miles" 