from app.database import SessionLocal
from app.models.user import User
from app.routers.users import get_password_hash

def test_create_user():
    db = SessionLocal()
    try:
        # Create a test user
        test_user = User(
            email="test@example.com",
            username="testuser",
            password=get_password_hash("testpassword123"),
            interests=["coding", "reading"],
            school="Test University",
            hometown="Test City",
            job="Software Engineer",
            links={"github": "https://github.com/testuser"}
        )
        
        # Add to database
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        
        print(f"Successfully created test user with ID: {test_user.id}")
        
    except Exception as e:
        print(f"Error creating test user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    test_create_user() 