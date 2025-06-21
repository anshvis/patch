from sqlalchemy import Column, Integer, String, JSON, ForeignKey, DateTime, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
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
    latitude = Column(Float, nullable=True)  # User's last known latitude
    longitude = Column(Float, nullable=True)  # User's last known longitude
    last_location_update = Column(DateTime(timezone=True), nullable=True)  # When location was last updated
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now()) 