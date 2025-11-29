"""
Authentication dependencies for FastAPI.

This module provides JWT validation for Supabase tokens.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from .config import get_settings

security = HTTPBearer()


async def get_current_user_id(
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
        # Decode JWT using Supabase's JWT secret
        # This is the secret shown in Supabase Dashboard → Settings → API → JWT Secret
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,  # Use the dedicated JWT secret
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
