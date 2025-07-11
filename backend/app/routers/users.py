from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.orm import Session
from typing import List, Dict
from ..database import get_db
from ..models.user import User
from ..schemas.user import UserCreate, User as UserSchema, UserUpdate, UserLogin, ContactsCheck
from passlib.context import CryptContext
from datetime import datetime
import logging
import re
from sqlalchemy import func
import math
from ..models.friendship import Friendship

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def normalize_phone_number(phone_number: str) -> str:
    """Normalize phone number to E.164 format"""
    # Remove any non-digit characters
    phone = re.sub(r'\D', '', phone_number)
    
    # Format as E.164 standard: +[country code][number]
    # For simplicity, assuming US/Canada numbers if no country code
    if not phone.startswith('1') and len(phone) == 10:
        phone = '1' + phone
        
    return '+' + phone

# Calculate distance between two points using Haversine formula
def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in miles"""
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 3956  # Radius of earth in miles
    return c * r

@router.post("/login")
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    # Find user by username
    user = db.query(User).filter(User.username == user_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    # Verify password
    if not verify_password(user_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    logger.info(f"User logged in: {user.id} - {user.username}")
    
    # Return user data (excluding password)
    return {
        "id": user.id,
        "username": user.username,
        "phone_number": user.phone_number,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "interests": user.interests,
        "school": user.school,
        "hometown": user.hometown,
        "job": user.job,
        "links": user.links,
        "profile_picture": user.profile_picture,
        "discovery_radius": user.discovery_radius,
        "latitude": user.latitude,
        "longitude": user.longitude
    }

@router.post("/register")
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Check if phone number already exists
    existing_user = db.query(User).filter(User.phone_number == user_data.phone_number).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        phone_number=user_data.phone_number,
        username=user_data.username,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        password=hashed_password,
        interests=user_data.interests,
        school=user_data.school,
        hometown=user_data.hometown,
        job=user_data.job,
        links=user_data.links,
        profile_picture=user_data.profile_picture,
        discovery_radius=user_data.discovery_radius,
        latitude=user_data.latitude,
        longitude=user_data.longitude,
        last_location_update=datetime.now() if user_data.latitude and user_data.longitude else None
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    logger.info(f"New user registered: {db_user.id} - {db_user.username}")
    
    # Return user data (excluding password) similar to login
    return {
        "id": db_user.id,
        "username": db_user.username,
        "phone_number": db_user.phone_number,
        "first_name": db_user.first_name,
        "last_name": db_user.last_name,
        "interests": db_user.interests,
        "school": db_user.school,
        "hometown": db_user.hometown,
        "job": db_user.job,
        "links": db_user.links,
        "profile_picture": db_user.profile_picture,
        "discovery_radius": db_user.discovery_radius,
        "latitude": db_user.latitude,
        "longitude": db_user.longitude
    }

@router.post("/contacts/check")
def check_contacts(contact_data: ContactsCheck, db: Session = Depends(get_db)):
    """Check which phone numbers from contacts are registered users"""
    # Normalize all phone numbers
    normalized_numbers = [normalize_phone_number(phone) for phone in contact_data.phone_numbers]
    
    # Find users with matching phone numbers
    registered_users = db.query(User).filter(User.phone_number.in_(normalized_numbers)).all()
    
    # Create a map of phone number to user data
    result = {}
    for user in registered_users:
        result[user.phone_number] = {
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_registered": True
        }
    
    # Add non-registered numbers
    for phone in normalized_numbers:
        if phone not in result:
            result[phone] = {
                "is_registered": False
            }
    
    return result

@router.get("/", response_model=List[UserSchema])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@router.get("/{user_id}", response_model=UserSchema)
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.put("/{user_id}", response_model=UserSchema)
def update_user(user_id: int, user: UserUpdate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update user fields
    update_data = user.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password"] = get_password_hash(update_data["password"])
    
    # If location is being updated, set the last_location_update timestamp
    if "latitude" in update_data or "longitude" in update_data:
        update_data["last_location_update"] = datetime.now()
    
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

@router.patch("/{user_id}/location")
def update_user_location(
    request: Request,
    user_id: int,
    location_data: Dict[str, float] = Body(...),
    db: Session = Depends(get_db)
):
    logger.info(f"Location update request for user {user_id}")
    logger.info(f"Request headers: {request.headers}")
    logger.info(f"Location data: {location_data}")
    
    # Check if the user exists
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        logger.error(f"User {user_id} not found")
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update location data
    if "latitude" in location_data and "longitude" in location_data:
        db_user.latitude = location_data["latitude"]
        db_user.longitude = location_data["longitude"]
        db_user.last_location_update = datetime.now()
        
        db.commit()
        db.refresh(db_user)
        
        logger.info(f"Location updated for user {user_id}: lat={db_user.latitude}, lng={db_user.longitude}")
        
        return {
            "id": db_user.id,
            "latitude": db_user.latitude,
            "longitude": db_user.longitude,
            "last_location_update": db_user.last_location_update
        }
    else:
        logger.error(f"Invalid location data for user {user_id}: {location_data}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both latitude and longitude are required"
        )

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}

@router.post("/{user_id}/nearby-contacts")
def find_nearby_contacts(
    user_id: int, 
    contact_data: ContactsCheck,
    db: Session = Depends(get_db)
):
    """Find users who share mutual contacts with the given user and are within discovery radius"""
    # Get the current user
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has location data
    if not current_user.latitude or not current_user.longitude:
        raise HTTPException(
            status_code=400, 
            detail="Location data not available. Please update your location."
        )
    
    # Normalize all phone numbers from the request
    normalized_numbers = [normalize_phone_number(phone) for phone in contact_data.phone_numbers]
    
    # Find users with matching phone numbers - these are the user's direct contacts
    direct_contacts = db.query(User).filter(
        User.phone_number.in_(normalized_numbers),
        User.id != user_id  # Exclude the current user
    ).all()
    
    # Create a set of user IDs who are direct contacts
    direct_contact_ids = {user.id for user in direct_contacts}
    direct_contact_phones = {user.phone_number for user in direct_contacts}
    
    # Get existing friendships to exclude them
    existing_friendships = db.query(Friendship).filter(
        (Friendship.user_id == user_id) | (Friendship.friend_id == user_id)
    ).all()
    
    # Create a set of user IDs who are already friends
    friend_ids = set()
    for friendship in existing_friendships:
        if friendship.user_id == user_id:
            friend_ids.add(friendship.friend_id)
        else:
            friend_ids.add(friendship.user_id)
    
    # Find all users who might be nearby
    potential_nearby_users = db.query(User).filter(
        User.id != user_id,
        User.latitude.isnot(None),
        User.longitude.isnot(None),
        ~User.id.in_(friend_ids),  # Exclude friends
        ~User.id.in_(direct_contact_ids),  # Exclude direct contacts
        ~User.phone_number.in_(normalized_numbers)  # Make sure they're not in the user's contacts
    ).all()
    
    # Find nearby users with shared contacts
    nearby_users = []
    
    for user in potential_nearby_users:
        # Calculate distance
        distance = calculate_distance(
            current_user.latitude, current_user.longitude,
            user.latitude, user.longitude
        )
        
        # Check if within discovery radius (use the smaller of the two radiuses)
        max_distance = min(current_user.discovery_radius, user.discovery_radius)
        
        if distance <= max_distance:
            # Now we need to find if this user has any contacts in common with the current user
            # For this demo, we'll check if this user is in the contacts of any of the user's direct contacts
            
            # Get all users who have this user's phone number in their contacts
            # In a real app, we'd query a contacts table, but for this demo, we'll assume
            # that if A has B's number, then B has A's number
            
            # Check if this user is a contact of any of the user's direct contacts
            shared_contacts = []
            
            for contact in direct_contacts:
                # In a real app, you'd check a contacts database
                # For now, we'll just assume mutual contacts exist if they're both registered users
                # This is a simplification for the demo
                shared_contacts.append({
                    "id": contact.id,
                    "name": f"{contact.first_name} {contact.last_name}" if contact.first_name and contact.last_name else contact.username,
                    "username": contact.username
                })
            
            if shared_contacts:
                nearby_users.append({
                    "id": user.id,
                    "username": user.username,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "distance": round(distance, 1),
                    "phone_number": user.phone_number,
                    "profile_picture": user.profile_picture,
                    "mutual_contacts": shared_contacts
                })
    
    return nearby_users 