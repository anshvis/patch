#!/bin/bash

# Create the database (ignore error if it exists)
psql -U anshviswanathan -c "CREATE DATABASE patch_db;" 2>/dev/null

# Drop the tables if they exist
psql -U anshviswanathan -d patch_db -c "DROP TABLE IF EXISTS friendships CASCADE;"
psql -U anshviswanathan -d patch_db -c "DROP TABLE IF EXISTS users CASCADE;"

# Create the users table with the current schema
psql -U anshviswanathan -d patch_db -c "
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR NOT NULL UNIQUE,
    username VARCHAR NOT NULL UNIQUE,
    first_name VARCHAR,
    last_name VARCHAR,
    password VARCHAR NOT NULL,
    interests JSON,
    school VARCHAR,
    hometown VARCHAR,
    job VARCHAR,
    links JSON,
    latitude FLOAT,
    longitude FLOAT,
    last_location_update TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);
"

# Create the friendships table
psql -U anshviswanathan -d patch_db -c "
CREATE TABLE friendships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    UNIQUE(user_id, friend_id)
);
" 