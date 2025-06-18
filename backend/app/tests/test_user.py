from ..database import SessionLocal
from ..models.user import User
from ..routers.users import get_password_hash

def test_create_user():
    db = SessionLocal()
    try:
        # Create a test user
        test_user = User(
            email="ansh.viswanathan@gmail.com",
            username="anshvis",
            password="anshv23",
            interests=["coding", "reading"],
            school="UMD",
            hometown="DC",
            job="Software Engineer",
            links={"github": "https://github.com/anshvis"}
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