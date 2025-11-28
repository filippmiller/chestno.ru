from __future__ import annotations

import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import get_settings


async def send_email(to_email: str, subject: str, body_text: str, body_html: str | None = None) -> bool:
    """
    Отправляет email через SMTP.
    Возвращает True при успехе, False при ошибке.
    """
    settings = get_settings()
    
    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        # SMTP не настроен, пропускаем отправку
        print(f'[Email] SMTP not configured, skipping email to {to_email}')
        return False
    
    try:
        message = MIMEMultipart('alternative')
        message['From'] = f'{settings.smtp_from_name} <{settings.smtp_from_email or settings.smtp_user}>'
        message['To'] = to_email
        message['Subject'] = subject
        
        message.attach(MIMEText(body_text, 'plain', 'utf-8'))
        if body_html:
            message.attach(MIMEText(body_html, 'html', 'utf-8'))
        
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            use_tls=settings.smtp_use_tls,
        )
        return True
    except Exception as e:
        print(f'[Email] Failed to send email to {to_email}: {e}')
        return False


def format_notification_email(title: str, body: str) -> tuple[str, str]:
    """
    Форматирует уведомление в текстовый и HTML формат email.
    Возвращает (text, html).
    """
    text = f'{title}\n\n{body}'
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; background-color: #f9fafb; }}
            .footer {{ padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Работаем Честно!</h1>
            </div>
            <div class="content">
                <h2>{title}</h2>
                <p>{body.replace(chr(10), '<br>')}</p>
            </div>
            <div class="footer">
                <p>Это автоматическое уведомление от платформы Chestno.ru</p>
            </div>
        </div>
    </body>
    </html>
    '''
    return text, html

