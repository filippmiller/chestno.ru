"""
Telegram Bot Keyboards

Inline and reply keyboards for bot interactions.
"""

from typing import Optional

from app.telegram_bot.models import CompanyInfo


def get_main_menu_keyboard() -> dict:
    """Get main menu inline keyboard."""
    return {
        'inline_keyboard': [
            [
                {'text': '🔍 Проверить ИНН', 'callback_data': 'cmd:inn'},
                {'text': '🔍 Проверить ОГРН', 'callback_data': 'cmd:ogrn'},
            ],
            [
                {'text': '📋 Мои подписки', 'callback_data': 'cmd:follows'},
                {'text': '⚙️ Настройки', 'callback_data': 'cmd:settings'},
            ],
            [
                {'text': '📝 Оставить отзыв', 'callback_data': 'cmd:review'},
            ],
            [
                {'text': '🔗 Привязать аккаунт', 'callback_data': 'cmd:link'},
            ],
        ]
    }


def get_company_card_keyboard(
    company: CompanyInfo,
    is_following: bool = False
) -> dict:
    """Get inline keyboard for company card."""
    follow_text = '❌ Отписаться' if is_following else '🔔 Подписаться'
    follow_data = f'unfollow:{company.id}' if is_following else f'follow:{company.id}'

    return {
        'inline_keyboard': [
            [
                {'text': follow_text, 'callback_data': follow_data},
                {'text': '📝 Написать отзыв', 'callback_data': f'review:{company.id}'},
            ],
            [
                {'text': '🌐 Открыть на сайте', 'url': company.profile_url},
            ],
        ]
    }


def get_rating_keyboard(organization_id: str) -> dict:
    """Get rating selection keyboard."""
    return {
        'inline_keyboard': [
            [
                {'text': '⭐ 1', 'callback_data': f'rate:{organization_id}:1'},
                {'text': '⭐⭐ 2', 'callback_data': f'rate:{organization_id}:2'},
                {'text': '⭐⭐⭐ 3', 'callback_data': f'rate:{organization_id}:3'},
            ],
            [
                {'text': '⭐⭐⭐⭐ 4', 'callback_data': f'rate:{organization_id}:4'},
                {'text': '⭐⭐⭐⭐⭐ 5', 'callback_data': f'rate:{organization_id}:5'},
            ],
            [
                {'text': '❌ Отмена', 'callback_data': 'cancel'},
            ],
        ]
    }


def get_settings_keyboard(
    notifications_enabled: bool,
    notify_producer_updates: bool,
    notify_review_replies: bool,
    notify_new_reviews: bool
) -> dict:
    """Get settings inline keyboard."""
    def toggle_text(name: str, enabled: bool) -> str:
        return f'{"✅" if enabled else "❌"} {name}'

    return {
        'inline_keyboard': [
            [
                {
                    'text': toggle_text('Уведомления', notifications_enabled),
                    'callback_data': f'setting:notifications:{not notifications_enabled}'
                },
            ],
            [
                {
                    'text': toggle_text('Обновления', notify_producer_updates),
                    'callback_data': f'setting:producer_updates:{not notify_producer_updates}'
                },
            ],
            [
                {
                    'text': toggle_text('Ответы на отзывы', notify_review_replies),
                    'callback_data': f'setting:review_replies:{not notify_review_replies}'
                },
            ],
            [
                {
                    'text': toggle_text('Новые отзывы', notify_new_reviews),
                    'callback_data': f'setting:new_reviews:{not notify_new_reviews}'
                },
            ],
            [
                {'text': '◀️ Назад', 'callback_data': 'menu'},
            ],
        ]
    }


def get_follows_keyboard(follows: list) -> dict:
    """Get keyboard for follows list."""
    buttons = []

    for follow in follows[:10]:  # Limit to 10
        buttons.append([
            {
                'text': f'🏢 {follow.organization_name[:30]}',
                'callback_data': f'follow_manage:{follow.organization_id}'
            }
        ])

    buttons.append([
        {'text': '◀️ Назад', 'callback_data': 'menu'},
    ])

    return {'inline_keyboard': buttons}


def get_follow_manage_keyboard(organization_id: str, organization_name: str) -> dict:
    """Get keyboard for managing a single follow."""
    return {
        'inline_keyboard': [
            [
                {'text': '❌ Отписаться', 'callback_data': f'unfollow:{organization_id}'},
            ],
            [
                {'text': '🔔 Настроить уведомления', 'callback_data': f'follow_settings:{organization_id}'},
            ],
            [
                {'text': '◀️ Назад к подпискам', 'callback_data': 'cmd:follows'},
            ],
        ]
    }


def get_link_keyboard(link_url: str) -> dict:
    """Get keyboard for account linking."""
    return {
        'inline_keyboard': [
            [
                {'text': '🔗 Привязать аккаунт', 'url': link_url},
            ],
            [
                {'text': '❌ Отмена', 'callback_data': 'cancel'},
            ],
        ]
    }


def get_unlink_confirm_keyboard() -> dict:
    """Get confirmation keyboard for unlinking."""
    return {
        'inline_keyboard': [
            [
                {'text': '✅ Да, отвязать', 'callback_data': 'unlink:confirm'},
                {'text': '❌ Нет, отмена', 'callback_data': 'cancel'},
            ],
        ]
    }


def get_review_complete_keyboard(completion_url: str) -> dict:
    """Get keyboard for completing review on web."""
    return {
        'inline_keyboard': [
            [
                {'text': '📝 Завершить на сайте', 'url': completion_url},
            ],
            [
                {'text': '❌ Отмена', 'callback_data': 'cancel'},
            ],
        ]
    }


def get_cancel_keyboard() -> dict:
    """Get simple cancel keyboard."""
    return {
        'inline_keyboard': [
            [
                {'text': '❌ Отмена', 'callback_data': 'cancel'},
            ],
        ]
    }


def get_back_to_menu_keyboard() -> dict:
    """Get back to menu keyboard."""
    return {
        'inline_keyboard': [
            [
                {'text': '◀️ Главное меню', 'callback_data': 'menu'},
            ],
        ]
    }
