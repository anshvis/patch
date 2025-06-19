#!/bin/bash

# Create the database (ignore error if it exists)
psql -U anshviswanathan -c "CREATE DATABASE patch_db;" 2>/dev/null

# Drop the users table if it exists
psql -U anshviswanathan -d patch_db -c "DROP TABLE IF EXISTS users CASCADE;"

# Create the users table with the current schema
psql -U anshviswanathan -d patch_db -c "
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    username VARCHAR NOT NULL UNIQUE,
    first_name VARCHAR,
    last_name VARCHAR,
    password VARCHAR NOT NULL,
    interests JSON,
    school VARCHAR,
    hometown VARCHAR,
    job VARCHAR,
    links JSON,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);
" 