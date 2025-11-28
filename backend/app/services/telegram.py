from __future__ import annotations

import httpx

from app.core.config import get_settings


async def send_telegram_message(chat_id: str, text: str) -> bool:
    """
    Отправляет сообщение в Telegram через Bot API.
    Возвращает True при успехе, False при ошибке.
    """
    settings = get_settings()
    
    if not settings.telegram_bot_token:
        print('[Telegram] Bot token not configured, skipping')
        return False
    
    try:
        url = f'https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage'
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json={
                    'chat_id': chat_id,
                    'text': text,
                    'parse_mode': 'HTML',
                },
                timeout=10.0,
            )
            if response.status_code == 200:
                return True
            print(f'[Telegram] Failed to send message: {response.status_code} - {response.text}')
            return False
    except Exception as e:
        print(f'[Telegram] Error sending message: {e}')
        return False


def format_notification_telegram(title: str, body: str) -> str:
    """
    Форматирует уведомление для Telegram (HTML формат).
    """
    # Экранируем HTML символы
    title_escaped = title.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    body_escaped = body.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return f'<b>{title_escaped}</b>\n\n{body_escaped}'

