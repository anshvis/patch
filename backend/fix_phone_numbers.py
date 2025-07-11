#!/usr/bin/env python3
import re
import sys
import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Function to normalize phone numbers to E.164 format
def normalize_phone_number(phone_number):
    """Normalize phone number to E.164 format"""
    # Remove any non-digit characters
    phone = re.sub(r'\D', '', phone_number)
    
    # Format as E.164 standard: +[country code][number]
    # For simplicity, assuming US/Canada numbers if no country code
    if not phone.startswith('1') and len(phone) == 10:
        phone = '1' + phone
        
    return '+' + phone

def main():
    # Connect to the database
    try:
        conn = psycopg2.connect(
            dbname="patch_db",
            user="anshviswanathan",
            host="localhost"
        )
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        print("Connected to database successfully!")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)
    
    try:
        # Get all users
        cursor.execute("SELECT id, username, phone_number FROM users")
        users = cursor.fetchall()
        
        print(f"Found {len(users)} users in the database")
        
        # Process each user's phone number
        updates = 0
        for user in users:
            user_id = user['id']
            username = user['username']
            current_phone = user['phone_number']
            
            # Normalize phone number
            normalized_phone = normalize_phone_number(current_phone)
            
            # Update if different
            if normalized_phone != current_phone:
                print(f"User {username} (ID: {user_id}): {current_phone} -> {normalized_phone}")
                
                try:
                    cursor.execute(
                        "UPDATE users SET phone_number = %s WHERE id = %s",
                        (normalized_phone, user_id)
                    )
                    updates += 1
                except Exception as e:
                    print(f"Error updating user {username}: {e}")
                    # If there's a duplicate phone number, print more details
                    if "duplicate key" in str(e).lower():
                        cursor.execute(
                            "SELECT username FROM users WHERE phone_number = %s",
                            (normalized_phone,)
                        )
                        existing = cursor.fetchone()
                        if existing:
                            print(f"Phone number {normalized_phone} already belongs to user {existing['username']}")
            else:
                print(f"User {username} (ID: {user_id}): Phone number already normalized ({current_phone})")
        
        # Commit changes
        if updates > 0:
            conn.commit()
            print(f"Successfully updated {updates} phone numbers")
        else:
            print("No phone numbers needed updating")
            
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main() 