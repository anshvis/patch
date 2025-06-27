from sqlalchemy import Column, Integer, String, JSON, ForeignKey, DateTime, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True, nullable=False)  # Phone number instead of email
    username = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String)  # User's first name
    last_name = Column(String)   # User's last name
    password = Column(String, nullable=False)
    interests = Column(JSON, default=list)
    school = Column(String)
    hometown = Column(String)  # We'll store location as a string for now
    job = Column(String)
    # links: JSON with keys: 'instagram', 'snapchat', 'spotify', 'linkedin', 'github'
    links = Column(JSON, default=dict)
    profile_picture = Column(String, nullable=True)  # URL or base64 string for profile picture
    discovery_radius = Column(Float, default=10)  # Default discovery radius of 10 miles
    latitude = Column(Float, nullable=True)  # User's last known latitude
    longitude = Column(Float, nullable=True)  # User's last known longitude
    last_location_update = Column(DateTime(timezone=True), nullable=True)  # When location was last updated
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Friendship relationships
    friendships = relationship("Friendship", foreign_keys="Friendship.user_id", back_populates="user", cascade="all, delete-orphan")
    friend_of = relationship("Friendship", foreign_keys="Friendship.friend_id", back_populates="friend", cascade="all, delete-orphan") 