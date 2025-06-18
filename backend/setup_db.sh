#!/bin/bash

# Create the database
psql -U postgres -c "CREATE DATABASE patch_db;"

# Connect to the database and create the test table
psql -U postgres -d patch_db -c "
CREATE TABLE IF NOT EXISTS test_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);" 