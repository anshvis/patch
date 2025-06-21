from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import re

# Only these keys are allowed in links
SOCIAL_KEYS = ["instagram", "snapchat", "spotify", "linkedin", "github"]

class UserBase(BaseModel):
    phone_number: str
    username: str
    first_name: Optional[str] = None  # First name
    last_name: Optional[str] = None   # Last name
    interests: List[str] = []
    school: Optional[str] = None
    hometown: Optional[str] = None
    job: Optional[str] = None
    # links: Only these keys allowed: instagram, snapchat, spotify, linkedin, github
    links: Dict[str, str] = {}
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    @validator('phone_number')
    def validate_phone_number(cls, v):
        # Simple validation for phone number format
        if not re.match(r'^\+?[0-9]{10,15}$', v):
            raise ValueError('Invalid phone number format')
        return v

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    phone_number: Optional[str] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None
    interests: Optional[List[str]] = None
    school: Optional[str] = None
    hometown: Optional[str] = None
    job: Optional[str] = None
    # Only these keys allowed in links
    links: Optional[Dict[str, str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    @validator('phone_number')
    def validate_phone_number(cls, v):
        if v is None:
            return v
            
        # Simple validation for phone number format
        if not re.match(r'^\+?[0-9]{10,15}$', v):
            raise ValueError('Invalid phone number format')
        return v

class User(UserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_location_update: Optional[datetime] = None
    friendship_id: Optional[int] = None  # For friend requests

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class UserLocationUpdate(BaseModel):
    latitude: float
    longitude: float

class ContactsCheck(BaseModel):
    phone_numbers: List[str] 