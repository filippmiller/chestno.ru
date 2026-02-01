"""
Authentication dependencies for FastAPI routes.

Provides user authentication helpers that can be used as FastAPI dependencies.
"""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from .config import get_settings

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Validate Supabase JWT and extract user_id.

    Args:
        credentials: HTTP Bearer token from Authorization header

    Returns:
        str: The authenticated user's ID (UUID)

    Raises:
        HTTPException: If token is invalid or expired
    """
    token = credentials.credentials
    settings = get_settings()

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject"
            )

        return user_id

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}"
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)
) -> Optional[str]:
    """
    Optionally validate Supabase JWT and extract user_id.

    Returns None if no token provided or token is invalid.
    Does not raise an error for missing/invalid tokens.

    Args:
        credentials: Optional HTTP Bearer token from Authorization header

    Returns:
        Optional[str]: The authenticated user's ID (UUID) or None
    """
    if not credentials:
        return None

    token = credentials.credentials
    settings = get_settings()

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )

        return payload.get("sub")

    except JWTError:
        return None


# Alias for backwards compatibility
get_optional_current_user = get_optional_user
