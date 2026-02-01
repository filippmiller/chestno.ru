"""
Message Formatters for Telegram Bot

Formats various data types into Telegram-friendly HTML messages.
"""

from typing import Optional

from app.telegram_bot.models import CompanyInfo, PendingReview, ProducerFollow


def format_company_card(company: CompanyInfo) -> str:
    """Format company info as a rich Telegram message."""
    # Status badges
    status_badge = ''
    if company.is_verified:
        status_badge = ' ✅'
    elif company.verification_status == 'pending':
        status_badge = ' ⏳'

    # Rating stars
    rating_str = ''
    if company.rating:
        full_stars = int(company.rating)
        half_star = company.rating - full_stars >= 0.5
        rating_str = '⭐' * full_stars + ('½' if half_star else '')
        rating_str = f'{rating_str} {company.rating:.1f}'
    else:
        rating_str = 'Нет оценок'

    # Build message parts
    lines = [
        f'🏢 <b>{escape_html(company.name)}</b>{status_badge}',
        '',
    ]

    if company.legal_name and company.legal_name != company.name:
        lines.append(f'📋 {escape_html(company.legal_name)}')

    if company.inn:
        lines.append(f'🔢 ИНН: <code>{company.inn}</code>')

    if company.ogrn:
        lines.append(f'🔢 ОГРН: <code>{company.ogrn}</code>')

    if company.address:
        lines.append(f'📍 {escape_html(company.address)}')

    if company.phone:
        lines.append(f'📞 {escape_html(company.phone)}')

    if company.website:
        lines.append(f'🌐 {escape_html(company.website)}')

    lines.append('')
    lines.append(f'⭐ Рейтинг: {rating_str}')
    lines.append(f'💬 Отзывов: {company.review_count}')
    lines.append(f'📦 Продуктов: {company.product_count}')

    if company.short_description:
        lines.append('')
        lines.append(f'📝 {escape_html(company.short_description[:200])}')

    lines.append('')
    lines.append(f'🔗 <a href="{company.profile_url}">Подробнее на chestno.ru</a>')

    return '\n'.join(lines)


def format_follows_list(follows: list[ProducerFollow]) -> str:
    """Format list of followed producers."""
    if not follows:
        return '📋 У вас пока нет подписок на производителей.'

    lines = [f'📋 <b>Мои подписки ({len(follows)}):</b>', '']

    for i, follow in enumerate(follows, 1):
        # Notification flags
        flags = []
        if follow.notify_new_products:
            flags.append('📦')
        if follow.notify_certifications:
            flags.append('📜')
        if follow.notify_news:
            flags.append('📰')

        flags_str = ' '.join(flags) if flags else '🔕'
        lines.append(f'{i}. <b>{escape_html(follow.organization_name)}</b> {flags_str}')

    lines.append('')
    lines.append('💡 Нажмите на название, чтобы управлять подпиской')

    return '\n'.join(lines)


def format_pending_review(review: PendingReview) -> str:
    """Format pending review info."""
    rating_stars = '⭐' * (review.rating or 0)

    lines = [
        '📝 <b>Ваш отзыв готов к публикации</b>',
        '',
        f'🏢 {escape_html(review.organization_name or "Компания")}',
        f'⭐ Оценка: {rating_stars}',
    ]

    if review.review_text:
        preview = review.review_text[:100]
        if len(review.review_text) > 100:
            preview += '...'
        lines.append(f'💬 "{escape_html(preview)}"')

    lines.append('')
    lines.append('Для публикации перейдите по ссылке:')
    lines.append(f'🔗 <a href="{review.completion_url}">Завершить публикацию</a>')
    lines.append('')
    lines.append(f'⏰ Ссылка действительна до: {review.expires_at.strftime("%d.%m.%Y %H:%M")}')

    return '\n'.join(lines)


def format_notification_producer_update(
    producer_name: str,
    update_type: str,
    update_title: str,
    update_text: str,
    link: str
) -> str:
    """Format producer update notification."""
    type_emoji = {
        'new_product': '📦',
        'certification': '📜',
        'news': '📰',
    }.get(update_type, '📢')

    lines = [
        f'{type_emoji} <b>Обновление от {escape_html(producer_name)}</b>',
        '',
        f'<b>{escape_html(update_title)}</b>',
        '',
        escape_html(update_text[:300]),
    ]

    if len(update_text) > 300:
        lines[-1] += '...'

    lines.append('')
    lines.append(f'🔗 <a href="{link}">Подробнее</a>')

    return '\n'.join(lines)


def format_notification_review_reply(
    company_name: str,
    reply_text: str,
    link: str
) -> str:
    """Format review reply notification."""
    lines = [
        f'💬 <b>Ответ на ваш отзыв</b>',
        '',
        f'Компания <b>{escape_html(company_name)}</b> ответила:',
        '',
        f'"{escape_html(reply_text[:500])}"',
    ]

    if len(reply_text) > 500:
        lines[-1] = lines[-1][:-1] + '..."'

    lines.append('')
    lines.append(f'🔗 <a href="{link}">Посмотреть отзыв</a>')

    return '\n'.join(lines)


def format_settings_menu(
    notifications_enabled: bool,
    notify_producer_updates: bool,
    notify_review_replies: bool,
    notify_new_reviews: bool
) -> str:
    """Format settings menu."""
    def status(enabled: bool) -> str:
        return '✅ Вкл' if enabled else '❌ Выкл'

    lines = [
        '⚙️ <b>Настройки уведомлений</b>',
        '',
        f'🔔 Уведомления: {status(notifications_enabled)}',
        '',
        '<b>Когда присылать:</b>',
        f'📢 Обновления производителей: {status(notify_producer_updates)}',
        f'💬 Ответы на отзывы: {status(notify_review_replies)}',
        f'📝 Новые отзывы (для бизнеса): {status(notify_new_reviews)}',
        '',
        '💡 Используйте кнопки ниже для настройки',
    ]

    return '\n'.join(lines)


def format_rate_limit_message(remaining: int, reset_at) -> str:
    """Format rate limit warning."""
    reset_time = reset_at.strftime('%d.%m.%Y %H:%M')
    return (
        f'⏳ <b>Превышен лимит запросов</b>\n\n'
        f'Осталось запросов сегодня: {remaining}\n'
        f'Сброс лимита: {reset_time}\n\n'
        f'💡 Привяжите аккаунт для увеличенного лимита'
    )


def format_error_message(error_code: str) -> str:
    """Format user-friendly error message."""
    errors = {
        'not_found': '❌ Компания с таким номером не найдена',
        'invalid_inn': '❌ Некорректный ИНН. Должно быть 10 или 12 цифр.',
        'invalid_ogrn': '❌ Некорректный ОГРН. Должно быть 13 или 15 цифр.',
        'rate_limited': '⏳ Слишком много запросов. Попробуйте позже.',
        'link_required': '🔗 Для этого действия нужно привязать аккаунт. /link',
        'link_expired': '❌ Ссылка для привязки устарела. Запросите новую: /link',
        'timeout': '⏱ Превышено время ожидания. Попробуйте позже.',
        'generic': '⚠️ Произошла ошибка. Пожалуйста, попробуйте позже.',
    }
    return errors.get(error_code, errors['generic'])


def escape_html(text: str) -> str:
    """Escape HTML special characters for Telegram."""
    if not text:
        return ''
    return (
        text
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
    )
