import bcrypt
import hmac

def is_bcrypt_hash(stored_password: str) -> bool:
    return stored_password.startswith(("$2a$", "$2b$", "$2y$"))

def verify_password(plain_password: str, stored_password: str) -> bool:
    if is_bcrypt_hash(stored_password):
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            stored_password.encode("utf-8"),
        )
    # Legacy plain-text passwords from the Express backend — constant-time compare
    return hmac.compare_digest(plain_password, stored_password)

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
