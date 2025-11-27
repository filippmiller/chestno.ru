from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.core.supabase import supabase_admin
from app.schemas.auth import AfterSignupRequest, LoginRequest, LoginResponse, SessionResponse
from app.services import login_throttle
from app.services.accounts import get_session_data, handle_after_signup

router = APIRouter(prefix='/api/auth', tags=['auth'])


def _parse_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing bearer token')
    return authorization.split(' ', 1)[1]


def get_current_user_id(authorization: str | None = Header(default=None)) -> str:
    token = _parse_bearer_token(authorization)
    supabase_user = supabase_admin.get_user_by_access_token(token)
    user_id = supabase_user.get('id')
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid Supabase user')
    return user_id


@router.post('/after-signup', response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def after_signup(payload: AfterSignupRequest) -> SessionResponse:
    supabase_user = supabase_admin.get_user(payload.auth_user_id)
    supabase_email = supabase_user.get('email')
    if supabase_email and supabase_email.lower() != payload.email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Email mismatch with Supabase user')
    return await run_in_threadpool(handle_after_signup, payload)


@router.get('/session', response_model=SessionResponse)
async def session(current_user_id: str = Depends(get_current_user_id)) -> SessionResponse:
    return await run_in_threadpool(get_session_data, current_user_id)


@router.post('/login', response_model=LoginResponse)
async def login(payload: LoginRequest) -> LoginResponse:
    state = login_throttle.get_state(payload.email)
    if state and state.retry_after > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={'message': 'Слишком много попыток. Попробуйте позже.', 'retry_after_seconds': state.retry_after},
        )

    try:
        auth_response = supabase_admin.password_sign_in(payload.email, payload.password)
    except HTTPException as exc:
        if exc.status_code in {status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED}:
            delay = login_throttle.register_failure(payload.email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={'message': 'Неверный email или пароль', 'retry_after_seconds': delay},
            ) from exc
        raise

    login_throttle.reset(payload.email)
    user = auth_response.get('user') or {}
    user_id = user.get('id')
    if not user_id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Supabase user id not found')

    session = await run_in_threadpool(get_session_data, user_id)
    access_token = auth_response.get('access_token')
    refresh_token = auth_response.get('refresh_token')
    if not access_token or not refresh_token:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Supabase tokens not received')

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=auth_response.get('expires_in'),
        token_type=auth_response.get('token_type', 'bearer'),
        user=session.user,
        organizations=session.organizations,
        memberships=session.memberships,
    )

