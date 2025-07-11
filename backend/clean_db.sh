#!/bin/bash

# This script deletes all data from the users and friendships tables
# without dropping the tables themselves

echo "WARNING: This will delete ALL user data from the database."
echo "Press ENTER to continue or CTRL+C to cancel..."
read

# Delete all records from the friendships table first (due to foreign key constraints)
psql -U anshviswanathan -d patch_db -c "DELETE FROM friendships;"
echo "All friendships deleted."

# Delete all records from the users table
psql -U anshviswanathan -d patch_db -c "DELETE FROM users;"
echo "All users deleted."

echo "Database cleaned successfully. You can now add new users manually with phone numbers." 