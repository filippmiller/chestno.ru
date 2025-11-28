# November 27th — Initial Stage Brief

## Overview

Chestno.ru прошёл базовые этапы (регистрация производителей, модерация, инвайты, QR-коды) и получил крупное расширение на этапах 4–5:

- **Notifications & reminders** — единый модуль для событий и отложенных напоминаний.
- **Products & public storefronts** — производители управляют товарами, витрина выводится на публичной странице.
- **Subscription plans & limits** — тарифы платформы, подсчёт usage и блокировка превышений.
- **Admin tools** — AI integrations, Dev To-Do, Database Explorer, платформенный мини-дашборд.
- **Документация** — README обновлён, добавлен этот brief и расширение по Stage 5.

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

## Stage 5 — Публичный каталог, онбординг и аналитика

### База данных

- `supabase/migrations/0015_org_profile_extended.sql` добавляет к `organization_profiles` поля `founded_year`, `employee_count`, `factory_size`, `category`, `certifications jsonb`, `sustainability_practices`, `quality_standards`, `buy_links jsonb`, а также `primary_category` и `tags` в `organizations`.

### Backend

- `app/services/organization_profiles.py` дополнился функциями:
  - `search_public_organizations(...)` — фильтрует `public_visible` организации по стране/категории/верификации и текстовому запросу, возвращает `PublicOrganizationSummary` + total.
  - `get_public_organization_details_by_slug(slug)` — объединяет `organizations`, `organization_profiles`, опубликованные `products`, преобразует JSONB в DTO (gallery, buy_links, certifications).
- Новый модуль `app/services/onboarding.py` считает `OnboardingSummary` (5 шагов: профиль, товары, QR, верификация, инвайты).
- `app/services/analytics.py` агрегирует `qr_events` (total, first/last scan, daily histogram) с проверкой membership.
- `app/services/admin_dashboard.py` даёт суммарные показатели по организациям/товарам/QR событиям (доступно только platform_admin).

### REST API

- `/api/public/organizations/search` — список производителей с пагинацией.
- `/api/public/organizations/details/{slug}` — расширенный профиль производителя.
- `/api/organizations/{organization_id}/onboarding` — прогресс заполненности.
- `/api/analytics/organizations/{organization_id}/qr-overview?days=30` — аналитика сканов.
- `/api/admin/dashboard/summary` — агрегированные показатели платформы.

### Frontend

- `/orgs` теперь использует реальные данные поиска, фильтры по стране/категории и бейджи «Проверено».
- `/org/:slug` выводит дополнительные секции (товары, сертификаты, sustainability/quality, buy-links).
- `/dashboard/organization/onboarding` — прогресс-бар, статусы шагов и ссылки на действия.
- `/dashboard/organization/analytics` — выбор периода (7/30/90 дней), карточки total/first/last scan и простая визуализация по дням.
- `/dashboard/admin` — мини-дашборд для platform_admin.
- Главная страница кабинета получила дополнительные CTA (онбординг, аналитика, админ-дашборд).

### Пример: поиск организаций

```python
# backend/app/services/organization_profiles.py
def search_public_organizations(q, country, category, verified_only, limit, offset):
    where = ['o.public_visible = true']
    if verified_only:
        where.append("o.verification_status = 'verified'")
    ...
    return summaries, total
```

### Пример: онбординг

```python
# backend/app/services/onboarding.py
def get_onboarding_summary(organization_id, user_id):
    steps = [
        OnboardingStep(key='profile', label='Заполните профиль производства', completed=profile_complete),
        ...
    ]
    percent = int(round(100 * completed / len(steps)))
    return OnboardingSummary(organization_id=organization_id, completion_percent=percent, steps=steps)
```

## Admin Tooling Recap

- AI Integrations (health-check env ключей).
- Dev / To-Do таблица для интеграций.
- Database Explorer `/admin/db` (сейфовые миграционные drafts).
- Admin Notifications endpoint для ручной отправки системных уведомлений.

## Testing / Verification

- Frontend: `cd frontend && npm run lint`.
- Backend: `cd backend && python -m compileall app`.
- Supabase: `scripts\apply_migrations.ps1 -DatabaseUrl "<connection string>"` (до `0015_org_profile_extended` включительно).

## Key Flows Summary

1. **Регистрация и роль** — Supabase Auth → `after-signup` создаёт `app_users`, `organizations`, membership.
2. **Уведомления** — любое событие вызывает `notifications.emit_notification`, формируются deliveries + in-app UI обновляется.
3. **Товары** — пользователи с ролью editor+ добавляют товары → лимиты проверяются → публичная витрина обновляется автоматически.
4. **Тарифы** — platform_admin настраивает планы и присваивает их организациям; usage отображается в кабинете и используется при проверке лимитов.
5. **Онбординг** — API возвращает прогресс по ключевым шагам, фронт ведёт пользователя к нужным разделам.
6. **Аналитика** — события QR складываются в `qr_events`, агрегаты доступны как производителю, так и платформе.

## Next Steps / TODO

- ✅ Реализовать фоновые воркеры для `reminders` (cron) — реализовано: `process_reminders()` и endpoint `/api/admin/notifications/reminders/process`.
- ✅ Дать платформенным админам UI для смены тарифа в Moderation Dashboard — реализовано.
- ✅ Реализовать Pending Registrations в Admin Panel — реализовано: список заявок с возможностью подтверждения/отклонения.
- Подключить дополнительные каналы уведомлений (почта, push, Telegram).
- Расширить аналитику (экспорт, графики) и дать платформенным пользователям больше метрик.

