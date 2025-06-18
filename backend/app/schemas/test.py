from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TestBase(BaseModel):
    name: str
    description: str

class TestCreate(TestBase):
    pass

class Test(TestBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True 