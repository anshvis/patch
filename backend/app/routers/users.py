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