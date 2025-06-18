from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    username: str
    interests: Optional[List[str]] = []
    school: Optional[str] = None
    hometown: Optional[str] = None
    job: Optional[str] = None
    links: Optional[Dict[str, str]] = {}

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: Optional[str] = None
    interests: Optional[List[str]] = None
    school: Optional[str] = None
    hometown: Optional[str] = None
    job: Optional[str] = None
    links: Optional[Dict[str, str]] = None

class User(UserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True 