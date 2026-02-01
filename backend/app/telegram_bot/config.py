"""
Telegram Bot Configuration
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from app.core.config import get_settings


@dataclass
class TelegramBotConfig:
    """Configuration for the Telegram bot."""

    # Bot credentials
    token: str
    webhook_secret: str

    # URLs
    frontend_url: str
    backend_url: str

    # Rate limiting
    daily_request_limit: int = 100
    burst_limit: int = 10  # Max requests per minute

    # Timeouts (seconds)
    lookup_timeout: int = 10
    webhook_timeout: int = 60

    # Feature flags
    allow_anonymous_lookups: bool = True
    require_link_for_reviews: bool = True


@lru_cache
def get_bot_config() -> Optional[TelegramBotConfig]:
    """Get Telegram bot configuration from settings."""
    settings = get_settings()

    if not settings.telegram_bot_token:
        return None

    # Generate webhook secret from token if not configured
    import hashlib
    webhook_secret = hashlib.sha256(
        f'{settings.telegram_bot_token}:webhook'.encode()
    ).hexdigest()[:32]

    return TelegramBotConfig(
        token=settings.telegram_bot_token,
        webhook_secret=webhook_secret,
        frontend_url=settings.frontend_url,
        backend_url=settings.backend_url,
    )


# Bot commands for BotFather /setcommands
BOT_COMMANDS = """
start - Начать работу с ботом
help - Справка по командам
inn - Проверить компанию по ИНН
ogrn - Проверить компанию по ОГРН
link - Привязать аккаунт chestno.ru
unlink - Отвязать аккаунт
settings - Настройки уведомлений
follows - Мои подписки на производителей
review - Оставить отзыв
"""

# Russian messages
MESSAGES = {
    # Welcome
    'welcome': (
        '👋 Добро пожаловать в <b>Работаем Честно!</b>\n\n'
        'Я помогу вам проверить информацию о компаниях и производителях.\n\n'
        '📋 <b>Что я умею:</b>\n'
        '• Проверка компании по ИНН или ОГРН\n'
        '• Сканирование QR-кодов продуктов\n'
        '• Уведомления об обновлениях производителей\n'
        '• Быстрые отзывы\n\n'
        '💡 <b>Попробуйте:</b>\n'
        'Просто отправьте ИНН (10-12 цифр) или ОГРН (13-15 цифр)'
    ),

    'help': (
        '📚 <b>Справка по командам:</b>\n\n'
        '/inn <code>номер</code> - Проверить по ИНН\n'
        '/ogrn <code>номер</code> - Проверить по ОГРН\n'
        '/link - Привязать аккаунт chestno.ru\n'
        '/unlink - Отвязать аккаунт\n'
        '/settings - Настройки уведомлений\n'
        '/follows - Мои подписки\n'
        '/review - Оставить отзыв\n\n'
        '💡 <b>Совет:</b> Можно просто отправить номер ИНН/ОГРН без команды'
    ),

    # Lookups
    'lookup_processing': '🔍 Ищу информацию...',
    'lookup_not_found': '❌ Компания с таким номером не найдена',
    'lookup_error': '⚠️ Произошла ошибка при поиске. Попробуйте позже.',
    'lookup_invalid_inn': '❌ Некорректный ИНН. Должно быть 10 или 12 цифр.',
    'lookup_invalid_ogrn': '❌ Некорректный ОГРН. Должно быть 13 или 15 цифр.',

    # Rate limiting
    'rate_limited': (
        '⏳ Превышен лимит запросов.\n\n'
        'Дневной лимит: {limit} запросов\n'
        'Осталось: {remaining}\n'
        'Сброс: {reset_time}'
    ),

    # Account linking
    'link_start': (
        '🔗 <b>Привязка аккаунта</b>\n\n'
        'Для полного доступа к функциям привяжите ваш аккаунт chestno.ru.\n\n'
        'Нажмите кнопку ниже, чтобы перейти на сайт и завершить привязку:'
    ),
    'link_success': '✅ Аккаунт успешно привязан!',
    'link_already': '✅ Ваш аккаунт уже привязан',
    'link_expired': '❌ Ссылка для привязки устарела. Запросите новую: /link',

    'unlink_confirm': (
        '⚠️ <b>Отвязка аккаунта</b>\n\n'
        'Вы уверены, что хотите отвязать аккаунт?\n'
        'Вы потеряете доступ к подпискам и истории.'
    ),
    'unlink_success': '✅ Аккаунт отвязан',
    'unlink_no_account': '❌ У вас нет привязанного аккаунта',

    # Settings
    'settings_menu': (
        '⚙️ <b>Настройки уведомлений</b>\n\n'
        '📢 Обновления производителей: {producer_updates}\n'
        '💬 Ответы на отзывы: {review_replies}\n'
        '📝 Новые отзывы (для бизнеса): {new_reviews}'
    ),

    # Follows
    'follows_empty': (
        '📋 <b>Мои подписки</b>\n\n'
        'У вас пока нет подписок на производителей.\n\n'
        'Найдите интересующую компанию по ИНН или ОГРН и подпишитесь!'
    ),
    'follows_list': '📋 <b>Мои подписки ({count}):</b>\n\n',
    'follow_success': '✅ Вы подписались на <b>{name}</b>',
    'follow_already': '✅ Вы уже подписаны на <b>{name}</b>',
    'unfollow_success': '✅ Вы отписались от <b>{name}</b>',

    # Reviews
    'review_start': (
        '📝 <b>Оставить отзыв</b>\n\n'
        'Отправьте ИНН или ОГРН компании, о которой хотите написать отзыв:'
    ),
    'review_rating': (
        '⭐ <b>Оцените компанию</b>\n\n'
        '<b>{company_name}</b>\n\n'
        'Выберите оценку от 1 до 5:'
    ),
    'review_text': (
        '💬 <b>Напишите отзыв</b>\n\n'
        'Ваша оценка: {"⭐" * rating}\n\n'
        'Теперь напишите ваш отзыв (минимум 50 символов):'
    ),
    'review_complete_web': (
        '✅ <b>Почти готово!</b>\n\n'
        'Для публикации отзыва перейдите по ссылке и подтвердите:'
    ),
    'review_too_short': '❌ Отзыв слишком короткий. Минимум 50 символов.',

    # QR Scan
    'qr_result_header': '📦 <b>Информация о продукте</b>\n\n',

    # Notifications
    'notification_producer_update': (
        '📢 <b>Обновление от {producer_name}</b>\n\n'
        '{update_text}\n\n'
        '🔗 Подробнее: {link}'
    ),
    'notification_review_reply': (
        '💬 <b>Ответ на ваш отзыв</b>\n\n'
        'Компания <b>{company_name}</b> ответила на ваш отзыв:\n\n'
        '"{reply_text}"\n\n'
        '🔗 Посмотреть: {link}'
    ),

    # Errors
    'error_generic': '⚠️ Произошла ошибка. Пожалуйста, попробуйте позже.',
    'error_maintenance': '🔧 Бот на техническом обслуживании. Попробуйте позже.',
}


def get_message(key: str, **kwargs) -> str:
    """Get a localized message with optional formatting."""
    template = MESSAGES.get(key, MESSAGES['error_generic'])
    if kwargs:
        try:
            return template.format(**kwargs)
        except KeyError:
            return template
    return template
