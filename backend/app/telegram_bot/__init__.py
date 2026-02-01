"""
Telegram Bot for chestno.ru

A Telegram bot that enables instant business verification for Russian companies.
Built with aiogram 3.x for async operation.

Features:
- INN/OGRN lookup for instant company info
- QR code scanning results
- Producer follow notifications
- Quick review submission
- Account linking with chestno.ru
"""

from app.telegram_bot.bot import create_bot, create_dispatcher

__all__ = ['create_bot', 'create_dispatcher']
