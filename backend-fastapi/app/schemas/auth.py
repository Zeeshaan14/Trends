from pydantic import BaseModel, EmailStr

class RegisterUserRequest(BaseModel):
    companyName: str
    email: EmailStr
    phone: str

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"
    user: dict

class RefreshTokenRequest(BaseModel):
    refreshToken: str
