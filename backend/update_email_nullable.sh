#!/bin/bash

# Make the email column nullable since we're using phone_number now
psql -U anshviswanathan -d patch_db -c "
ALTER TABLE users 
ALTER COLUMN email DROP NOT NULL;
"

echo "Email column is now nullable!" 