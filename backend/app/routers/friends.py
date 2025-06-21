from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List
from ..database import get_db
from ..models.user import User
from ..models.friendship import Friendship
from ..schemas.user import User as UserSchema
from ..schemas.friendship import FriendRequest, FriendshipUpdate

router = APIRouter(
    prefix="/users",
    tags=["friends"]
)

@router.get("/{user_id}/friends", response_model=List[UserSchema])
def get_user_friends(user_id: int, db: Session = Depends(get_db)):
    """Get all friends for a user (both accepted and pending)"""
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all accepted friendships where the user is either the requester or the recipient
    friendships = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == user_id, Friendship.is_accepted == True),
            and_(Friendship.friend_id == user_id, Friendship.is_accepted == True)
        )
    ).all()
    
    # Extract friend IDs (the other user in each friendship)
    friend_ids = []
    for friendship in friendships:
        if friendship.user_id == user_id:
            friend_ids.append(friendship.friend_id)
        else:
            friend_ids.append(friendship.user_id)
    
    # Get all friend users
    friends = db.query(User).filter(User.id.in_(friend_ids)).all()
    
    return friends

@router.post("/{user_id}/friends", status_code=status.HTTP_201_CREATED)
def add_friend(user_id: int, friend_request: FriendRequest, db: Session = Depends(get_db)):
    """Send a friend request"""
    # Check if both users exist
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    friend = db.query(User).filter(User.id == friend_request.friend_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="Friend not found")
    
    # Check if friendship already exists
    existing_friendship = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == user_id, Friendship.friend_id == friend_request.friend_id),
            and_(Friendship.user_id == friend_request.friend_id, Friendship.friend_id == user_id)
        )
    ).first()
    
    if existing_friendship:
        raise HTTPException(status_code=400, detail="Friendship already exists")
    
    # Create new friendship (friend request)
    new_friendship = Friendship(
        user_id=user_id,
        friend_id=friend_request.friend_id,
        is_accepted=False  # Default is pending
    )
    
    db.add(new_friendship)
    db.commit()
    db.refresh(new_friendship)
    
    return {"message": "Friend request sent successfully"}

@router.get("/{user_id}/friend-requests", response_model=List[UserSchema])
def get_friend_requests(user_id: int, db: Session = Depends(get_db)):
    """Get all pending friend requests for a user"""
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all pending friendships where the user is the recipient
    pending_friendships = db.query(Friendship).filter(
        Friendship.friend_id == user_id,
        Friendship.is_accepted == False
    ).all()
    
    # Extract requester IDs
    requester_ids = [friendship.user_id for friendship in pending_friendships]
    
    # Get all requester users
    requesters = db.query(User).filter(User.id.in_(requester_ids)).all()
    
    # Enrich user objects with friendship_id
    for i, user in enumerate(requesters):
        # Find the corresponding friendship
        for friendship in pending_friendships:
            if friendship.user_id == user.id:
                # Add friendship_id to the user object
                setattr(user, "friendship_id", friendship.id)
                break
    
    return requesters

@router.put("/{user_id}/friend-requests/{friendship_id}", status_code=status.HTTP_200_OK)
def respond_to_friend_request(
    user_id: int, 
    friendship_id: int, 
    response: FriendshipUpdate, 
    db: Session = Depends(get_db)
):
    """Accept or reject a friend request"""
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if friendship exists and user is the recipient
    friendship = db.query(Friendship).filter(
        Friendship.id == friendship_id,
        Friendship.friend_id == user_id
    ).first()
    
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if response.is_accepted:
        # Accept the friend request
        friendship.is_accepted = True
        db.commit()
        return {"message": "Friend request accepted"}
    else:
        # Reject the friend request (delete it)
        db.delete(friendship)
        db.commit()
        return {"message": "Friend request rejected"}

@router.delete("/{user_id}/friends/{friend_id}", status_code=status.HTTP_200_OK)
def remove_friend(user_id: int, friend_id: int, db: Session = Depends(get_db)):
    """Remove a friend"""
    # Check if both users exist
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    friend = db.query(User).filter(User.id == friend_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="Friend not found")
    
    # Check if friendship exists
    friendship = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == user_id, Friendship.friend_id == friend_id),
            and_(Friendship.user_id == friend_id, Friendship.friend_id == user_id)
        )
    ).first()
    
    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")
    
    # Delete the friendship
    db.delete(friendship)
    db.commit()
    
    return {"message": "Friend removed successfully"}

@router.get("/search", response_model=List[UserSchema])
def search_users(query: str, db: Session = Depends(get_db)):
    """Search for users by username or name"""
    if len(query) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
    
    # Search by username, first name, or last name
    users = db.query(User).filter(
        or_(
            User.username.ilike(f"%{query}%"),
            User.first_name.ilike(f"%{query}%"),
            User.last_name.ilike(f"%{query}%")
        )
    ).limit(10).all()
    
    return users 