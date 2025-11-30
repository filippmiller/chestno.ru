from typing import Any, Dict

import httpx
from fastapi import HTTPException, status

from .config import get_settings


class SupabaseAdminClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.base_auth_url = settings.supabase_auth_url
        self.admin_headers = {
            'apikey': settings.supabase_service_role_key,
            'Authorization': f'Bearer {settings.supabase_service_role_key}',
            'Content-Type': 'application/json',
        }
        self.public_headers = {
            'apikey': settings.supabase_anon_key,
            'Content-Type': 'application/json',
        }
        self._client = httpx.Client(timeout=10.0)

    def _raise_for_status(self, response: httpx.Response) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.json() if exc.response.content else {'message': exc.response.text}
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=detail,
            ) from exc

    def get_user(self, user_id: str) -> Dict[str, Any]:
        response = self._client.get(f'{self.base_auth_url}/admin/users/{user_id}', headers=self.admin_headers)
        self._raise_for_status(response)
        return response.json()

    def get_user_by_email(self, email: str) -> Dict[str, Any] | None:
        response = self._client.get(
            f'{self.base_auth_url}/admin/users',
            headers=self.admin_headers,
            params={'email': email},
        )
        self._raise_for_status(response)
        data = response.json()
        users = data.get('users') if isinstance(data, dict) else data
        if users:
            return users[0]
        return None

    def create_user(self, email: str, password: str, user_metadata: Dict[str, Any] | None = None) -> Dict[str, Any]:
        payload = {
            'email': email,
            'password': password,
            'email_confirm': True,
            'user_metadata': user_metadata or {},
        }
        response = self._client.post(f'{self.base_auth_url}/admin/users', headers=self.admin_headers, json=payload)
        self._raise_for_status(response)
        return response.json()

    def get_user_by_access_token(self, token: str) -> Dict[str, Any]:
        settings = get_settings()
        headers = {
            'Authorization': f'Bearer {token}',
            'apikey': settings.supabase_anon_key,
        }
        response = self._client.get(f'{self.base_auth_url}/user', headers=headers)
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid Supabase token')
        self._raise_for_status(response)
        return response.json()

    def password_sign_in(self, email: str, password: str) -> Dict[str, Any]:
        payload = {'email': email, 'password': password}
        response = self._client.post(
            f'{self.base_auth_url}/token?grant_type=password',
            headers=self.public_headers,
            json=payload,
        )
        self._raise_for_status(response)
        return response.json()


supabase_admin = SupabaseAdminClient()

