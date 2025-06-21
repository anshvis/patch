from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class FriendshipBase(BaseModel):
    user_id: int
    friend_id: int

class FriendshipCreate(FriendshipBase):
    pass

class FriendshipUpdate(BaseModel):
    is_accepted: bool

class Friendship(FriendshipBase):
    id: int
    is_accepted: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class FriendRequest(BaseModel):
    friend_id: int 