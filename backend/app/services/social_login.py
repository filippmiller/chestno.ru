from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Dict, Tuple
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.core.db import get_connection
from app.core.supabase import supabase_admin

STATE_TTL_SECONDS = 600

settings = get_settings()


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')


def _base64url_decode(data: str) -> bytes:
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _create_state(provider: str, redirect_to: str) -> str:
    payload = {
        'provider': provider,
        'redirect_to': redirect_to,
        'ts': int(time.time()),
        'nonce': secrets.token_urlsafe(8),
    }
    serialized = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    sig = hmac.new(settings.social_state_secret.encode('utf-8'), serialized, hashlib.sha256).hexdigest()
    return f"{_base64url_encode(serialized)}.{sig}"


def _verify_state(state: str, provider: str) -> Dict[str, str]:
    try:
        payload_b64, sig = state.split('.', 1)
        serialized = _base64url_decode(payload_b64)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid state') from exc
    expected_sig = hmac.new(settings.social_state_secret.encode('utf-8'), serialized, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, sig):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid state signature')
    payload = json.loads(serialized.decode('utf-8'))
    if payload.get('provider') != provider:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='State/provider mismatch')
    timestamp = payload.get('ts')
    if not isinstance(timestamp, int) or time.time() - timestamp > STATE_TTL_SECONDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='State expired')
    return payload


def _provider_password(provider: str, provider_user_id: str) -> str:
    raw = f'{settings.social_login_salt}:{provider}:{provider_user_id}'.encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def _sanitize_redirect(redirect_to: str | None, provider: str) -> str:
    if not redirect_to:
        return f"{settings.frontend_base}/auth/callback?provider={provider}"
    if redirect_to.startswith(settings.frontend_base):
        return redirect_to
    return f"{settings.frontend_base}/auth/callback?provider={provider}"


def start_yandex_login(redirect_to: str | None = None) -> str:
    if not settings.yandex_oauth_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='Yandex OAuth not configured')
    redirect_to = _sanitize_redirect(redirect_to, 'yandex')
    state = _create_state('yandex', redirect_to)
    params = {
        'response_type': 'code',
        'client_id': settings.yandex_client_id,
        'redirect_uri': settings.yandex_redirect_uri,
        'scope': 'login:email login:info',
        'state': state,
        'force_confirm': 'yes',
    }
    return f"https://oauth.yandex.ru/authorize?{urlencode(params)}"


def handle_yandex_callback(code: str, state: str) -> Tuple[Dict[str, str], str]:
    if not settings.yandex_oauth_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='Yandex OAuth not configured')
    payload = _verify_state(state, 'yandex')
    token_data = _exchange_yandex_code(code)
    profile = _fetch_yandex_profile(token_data['access_token'])
    provider_user_id = str(profile.get('id') or profile.get('psuid'))
    if not provider_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid Yandex profile')
    email = profile.get('default_email') or (profile.get('emails') or [None])[0]
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Email not provided by Yandex')
    full_name = profile.get('real_name') or profile.get('display_name') or profile.get('first_name') or ''
    user_id, auth_email = _ensure_user_for_provider('yandex', provider_user_id, email, full_name)
    session = supabase_admin.password_sign_in(auth_email, _provider_password('yandex', provider_user_id))
    return session, payload['redirect_to']


def _exchange_yandex_code(code: str) -> Dict[str, str]:
    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'client_id': settings.yandex_client_id,
        'client_secret': settings.yandex_client_secret,
        'redirect_uri': settings.yandex_redirect_uri,
    }
    response = httpx.post('https://oauth.yandex.ru/token', data=data, timeout=10.0)
    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Failed to exchange Yandex code')
    return response.json()


def _fetch_yandex_profile(access_token: str) -> Dict[str, str]:
    headers = {'Authorization': f'OAuth {access_token}'}
    response = httpx.get('https://login.yandex.ru/info?format=json', headers=headers, timeout=10.0)
    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Failed to fetch Yandex profile')
    return response.json()


def _ensure_user_for_provider(
    provider: str,
    provider_user_id: str,
    email: str,
    full_name: str,
) -> Tuple[str, str]:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                '''
                SELECT user_id FROM auth_providers
                WHERE provider = %s AND provider_user_id = %s
                ''',
                (provider, provider_user_id),
            )
            row = cur.fetchone()
            if row:
                user_id = row['user_id']
                auth_email = email
                return user_id, auth_email

    supabase_user = supabase_admin.get_user_by_email(email)
    if supabase_user:
        # TODO: allow linking to existing accounts gracefully.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='Email already registered. Please log in with email/password and link Yandex in profile (TODO).',
        )

    password = _provider_password(provider, provider_user_id)
    new_user = supabase_admin.create_user(email=email, password=password, user_metadata={'full_name': full_name})
    user_id = new_user['id']
    _ensure_app_user(user_id, email, full_name)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO auth_providers (user_id, provider, provider_user_id, email)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (provider, provider_user_id) DO NOTHING
                ''',
                (user_id, provider, provider_user_id, email),
            )
            conn.commit()

    return user_id, email


def _ensure_app_user(user_id: str, email: str, full_name: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO app_users (id, email, full_name)
                VALUES (%s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                ''',
                (user_id, email, full_name),
            )
            conn.commit()

