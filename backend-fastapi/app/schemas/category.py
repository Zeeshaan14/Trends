from pydantic import BaseModel, Field

class CreateCategoryRequest(BaseModel):
    id: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    image: str
    description: str
