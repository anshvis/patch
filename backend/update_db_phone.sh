#!/bin/bash

# Add the phone_number column if it doesn't exist
psql -U anshviswanathan -d patch_db -c "
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR UNIQUE;
"

# Update existing users with placeholder phone numbers if needed
# This is a one-time migration - in production you'd want to handle this differently
psql -U anshviswanathan -d patch_db -c "
UPDATE users 
SET phone_number = CONCAT('+1555', LPAD(id::text, 7, '0')) 
WHERE phone_number IS NULL;
"

# Make phone_number NOT NULL after ensuring all users have a value
psql -U anshviswanathan -d patch_db -c "
ALTER TABLE users 
ALTER COLUMN phone_number SET NOT NULL;
"

echo "Database updated with phone_number column!" 