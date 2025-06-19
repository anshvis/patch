from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import datetime

# Only these keys are allowed in links
SOCIAL_KEYS = ["instagram", "snapchat", "spotify", "linkedin", "github"]

class UserBase(BaseModel):
    email: EmailStr
    username: str
    first_name: Optional[str] = None  # First name
    last_name: Optional[str] = None   # Last name
    interests: Optional[List[str]] = []
    school: Optional[str] = None
    hometown: Optional[str] = None
    job: Optional[str] = None
    # links: Only these keys allowed: instagram, snapchat, spotify, linkedin, github
    links: Optional[Dict[str, Optional[str]]] = {k: None for k in SOCIAL_KEYS}

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None
    interests: Optional[List[str]] = None
    school: Optional[str] = None
    hometown: Optional[str] = None
    job: Optional[str] = None
    # Only these keys allowed in links
    links: Optional[Dict[str, Optional[str]]] = None

class User(UserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str 