# Patch Backend

This is the backend server for the Patch application, built with FastAPI.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up PostgreSQL database:
- Install PostgreSQL if you haven't already
- Create a database named 'patch_db'
- Update the database URL in `app/database.py` if needed

4. Run the server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The server will start at http://localhost:8000

## API Documentation

Once the server is running, you can access:
- Interactive API docs (Swagger UI): http://localhost:8000/docs
- Alternative API docs (ReDoc): http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── main.py           # FastAPI application
│   ├── database.py       # Database configuration
│   ├── models/          # SQLAlchemy models
│   ├── schemas/         # Pydantic schemas
│   ├── routers/         # API routes
│   └── core/            # Core functionality (auth, config)
├── requirements.txt     # Python dependencies
└── README.md           # This file
``` 

5. Check DB
- psql -U anshviswanathan -d patch_db
    \d users #check fields