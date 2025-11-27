# November 27th — Initial Stage Brief

## Overview

Chestno.ru прошёл базовые этапы (регистрация производителей, модерация, инвайты, QR-коды) и получил крупное расширение на этапе 4:

- **Notifications & reminders** — единый модуль для событий и отложенных напоминаний.
- **Products & public storefronts** — производители управляют товарами, витрина выводится на публичной странице.
- **Subscription plans & limits** — тарифы платформы, подсчёт usage и блокировка превышений.
- **Admin tools** — AI integrations, Dev To-Do, Database Explorer.
- **Документация** — README обновлён, добавлен этот brief.

## Notifications Module

### База данных

- `notification_types`, `notifications`, `notification_deliveries`, `user_notification_settings`, `reminders`.
- Политики RLS: пользователи читают только свои deliveries/settings, платформенные роли управляют справочником и reminders.

### Backend

- `app/services/notifications.py` реализует:
  - `list_notifications`, `get_unread_count`, `mark_notification_read`, `dismiss_notification`.
  - `list_notification_settings`, `update_notification_settings`.
  - `emit_notification` с генерацией фан-аутов по ролям (user / org / platform).
  - Темплейты подставляются через `render_template`.
- Роуты:
  - `/api/notifications`, `/api/notifications/unread-count`, `/api/notifications/{id}/read|dismiss`.
  - `/api/notification-settings` (GET/PATCH).
  - `/api/admin/notifications` — protected endpoint для платформы.

### Frontend

- Колокольчик в навбаре показывает счётчик и последние события.
- Страницы:
  - `/notifications` — полный список с пагинацией.
  - `/settings/notifications` — включение in-app/email каналов, mute.

Пример сервиса:

```python
# backend/app/services/notifications.py
def list_notifications(user_id: str, cursor: Optional[int], limit: int) -> NotificationListResponse:
    ...
```

## Products & Public Storefronts

### База данных

- `products` (slug уникален внутри организации, статусы draft/published/archived).
- RLS: члены организации видят свои товары, platform_admin — все; редактирование только owner|admin|manager|editor.

### Backend

- `app/services/products.py`: CRUD с проверкой ролей и вызовом `subscriptions.check_org_limit`.
- Публичный API (`/api/public/organizations/{slug}/products`) отдаёт опубликованные товары.

### Frontend

- `/dashboard/organization/products` — список, фильтрация по статусу, форма создания/редактирования, архивация.
- В `Dashboard` добавлены ссылки на «Товары» и «Тариф и лимиты».
- Публичная страница (`/org/:slug`) отображает карточки товаров.

Пример части сервиса:

```python
# backend/app/services/products.py
def create_product(organization_id: str, user_id: str, payload: ProductCreate) -> Product:
    _require_role(cur, organization_id, user_id, EDITOR_ROLES)
    subscription_service.check_org_limit(organization_id, 'products')
    ...
```

На фронте — контролируемая форма, автоматический `slugify` и конвертация цены в `price_cents`.

## Subscription Plans & Limits

### База данных

- `subscription_plans` (seed: free, standard, pro).
- `organization_subscriptions` (одна активная запись на организацию).
- RLS: планы доступны всем для чтения, изменения только платформой.

### Backend

- `app/services/subscriptions.py`:
  - `list_plans`, `create_plan`, `update_plan`, `set_org_subscription`.
  - `get_org_subscription_summary` + `get_org_usage`.
  - `check_org_limit` используется в продуктах и QR-кодах; на превышении бросает `HTTP 403` c detail `limit_reached`.

```python
# backend/app/services/subscriptions.py
def check_org_limit(organization_id: str, metric: Literal['products', 'qr_codes', 'members']) -> None:
    summary = get_org_subscription_summary(organization_id)
    ...
    if limit_value is not None and current_value >= limit_value:
        raise HTTPException(status_code=403, detail={'code': 'limit_reached', ...})
```

### Frontend

- `/dashboard/organization/plan` — отображение текущего плана, usage и подсветка близости к лимиту.
- Ошибки лимита (например, при создании товара) показывают подсказку перейти в раздел тарифа.

## Admin Tooling Recap

- AI Integrations (health-check env ключей).
- Dev / To-Do таблица для интеграций.
- Database Explorer `/admin/db` (сейфовые миграционные drafts).
- Admin Notifications endpoint для ручной отправки системных уведомлений.

## Testing / Verification

- Frontend: `cd frontend && npm run lint`.
- Backend: `cd backend && python -m compileall app`.
- Supabase: `scripts\apply_migrations.ps1 -DatabaseUrl "<connection string>"` (порядок до 0014).

## Key Flows Summary

1. **Регистрация и роль** — Supabase Auth → `after-signup` создаёт `app_users`, `organizations`, membership.
2. **Уведомления** — любое событие вызывает `notifications.emit_notification`, формируются deliveries + in-app UI обновляется.
3. **Товары** — пользователи с ролью editor+ добавляют товары → лимиты проверяются → публичная витрина обновляется автоматически.
4. **Тарифы** — platform_admin настраивает планы и присваивает их организациям; usage отображается в кабинете и используется при проверке лимитов.

## Next Steps / TODO

- Реализовать фоновые воркеры для `reminders` (cron).
- Дать платформенным админам UI для смены тарифа в Moderation Dashboard.
- Подключить дополнительные каналы уведомлений (почта, push, Telegram).

