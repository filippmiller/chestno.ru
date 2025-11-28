from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status
from psycopg.rows import dict_row

from app.core.db import get_connection
from app.services.admin_guard import assert_platform_admin


def list_integrations(user_id: str) -> list[dict]:
    assert_platform_admin(user_id)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute('SELECT * FROM ai_integrations ORDER BY created_at ASC')
        return cur.fetchall()


def create_integration(
    user_id: str,
    provider: str,
    display_name: str,
    env_var_name: str,
    is_enabled: bool = True,
) -> dict:
    assert_platform_admin(user_id)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            INSERT INTO ai_integrations (provider, display_name, env_var_name, is_enabled)
            VALUES (%s, %s, %s, %s)
            RETURNING *
            ''',
            (provider, display_name, env_var_name, is_enabled),
        )
        row = cur.fetchone()
        conn.commit()
        return row


def update_integration(
    user_id: str,
    integration_id: str,
    payload: dict,
) -> dict:
    assert_platform_admin(user_id)
    fields = []
    values = []
    for field in ('display_name', 'env_var_name', 'is_enabled'):
        if field in payload:
            fields.append(f'{field} = %s')
            values.append(payload[field])
    if not fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='No fields to update')
    values.append(integration_id)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f'''
            UPDATE ai_integrations
            SET {', '.join(fields)}
            WHERE id = %s
            RETURNING *
            ''',
            values,
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Integration not found')
        conn.commit()
        return row


def run_health_check(user_id: str, integration_id: str) -> dict:
    assert_platform_admin(user_id)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute('SELECT * FROM ai_integrations WHERE id = %s', (integration_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Integration not found')
    env_value = os.getenv(row['env_var_name'])
    now = datetime.now(timezone.utc)
    status_value = 'error'
    message = 'ENV variable not set'
    if env_value:
        status_value, message = _perform_provider_check(row['provider'], env_value)
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            UPDATE ai_integrations
            SET last_check_at = %s,
                last_check_status = %s,
                last_check_message = %s
            WHERE id = %s
            RETURNING *
            ''',
            (now, status_value, message, integration_id),
        )
        updated = cur.fetchone()
        conn.commit()
    if status_value != 'ok':
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message)
    return updated


def _perform_provider_check(provider: str, token: str) -> tuple[str, str]:
    provider = provider.lower()
    try:
        if provider == 'openai':
            response = httpx.get(
                'https://api.openai.com/v1/models?limit=1',
                headers={'Authorization': f'Bearer {token}'},
                timeout=10.0,
            )
            if response.status_code == 200:
                return 'ok', 'OpenAI reachable'
            return 'error', f'OpenAI error: {response.status_code}'
        elif provider in {'yandex_ai', 'yandexgpt'}:
            # Yandex GPT API health check через минимальный completion запрос
            try:
                # Используем минимальный запрос для проверки валидности API ключа
                response = httpx.post(
                    'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
                    headers={
                        'Authorization': f'Api-Key {token}',
                        'Content-Type': 'application/json',
                    },
                    json={
                        'modelUri': 'gpt://yandexgpt/latest',
                        'completionOptions': {
                            'stream': False,
                            'temperature': 0.1,
                            'maxTokens': 1,
                        },
                        'messages': [
                            {
                                'role': 'user',
                                'text': 'ok',
                            },
                        ],
                    },
                    timeout=10.0,
                )
                if response.status_code == 200:
                    return 'ok', 'Yandex GPT API reachable'
                elif response.status_code == 401:
                    return 'error', 'Yandex GPT API: Invalid API key'
                elif response.status_code == 403:
                    return 'error', 'Yandex GPT API: Access forbidden'
                else:
                    error_detail = response.text[:200] if response.text else f'Status {response.status_code}'
                    return 'error', f'Yandex GPT API error: {error_detail}'
            except httpx.TimeoutException:
                return 'error', 'Yandex GPT API: Request timeout'
            except Exception as e:
                return 'error', f'Yandex GPT API: {str(e)[:100]}'
        else:
            return 'ok', 'ENV present'
    except httpx.HTTPError as exc:
        return 'error', f'HTTP error: {exc}'

