# Chestno.ru — Полная Документация Платформы

**Версия:** 1.0.0  
**Дата:** Ноябрь 2024  
**Статус:** Production Ready

---

## Оглавление

1. [Обзор платформы](#обзор-платформы)
2. [Архитектура системы](#архитектура-системы)
3. [База данных](#база-данных)
4. [Backend API](#backend-api)
5. [Frontend](#frontend)
6. [Система уведомлений](#система-уведомлений)
7. [Аутентификация и авторизация](#аутентификация-и-авторизация)
8. [QR-коды и аналитика](#qr-коды-и-аналитика)
9. [Товары и подписки](#товары-и-подписки)
10. [Админ-панель](#админ-панель)
11. [Развертывание](#развертывание)
12. [Примеры использования](#примеры-использования)

---

## Обзор платформы

**Chestno.ru** (Работаем Честно!) — это платформа для производителей, которые хотят прозрачно показывать своё производство. Платформа позволяет:

- Создавать публичные профили производителей с информацией о производстве
- Управлять товарами и публичными витринами
- Генерировать QR-коды для отслеживания и аналитики
- Получать уведомления о важных событиях
- Управлять командой через систему инвайтов
- Отслеживать аналитику использования QR-кодов

### Технологический стек

**Frontend:**
- React 18+ с TypeScript
- Vite для сборки
- Tailwind CSS для стилей
- shadcn/ui для компонентов
- React Router для маршрутизации
- Zustand для управления состоянием
- Axios для HTTP запросов

**Backend:**
- FastAPI (Python 3.11+)
- PostgreSQL (через Supabase)
- Pydantic для валидации данных
- Psycopg для работы с БД

**База данных:**
- Supabase (PostgreSQL с RLS)
- Row Level Security для безопасности

**Инфраструктура:**
- Frontend: Cloudflare Pages
- Backend: Railway
- Database: Supabase

---

## Архитектура системы

### Структура проекта

```
Chestno.ru/
├── frontend/          # React приложение
│   ├── src/
│   │   ├── api/      # API клиенты
│   │   ├── components/ # UI компоненты
│   │   ├── pages/    # Страницы приложения
│   │   ├── routes/   # Маршрутизация
│   │   ├── store/    # Zustand stores
│   │   ├── types/    # TypeScript типы
│   │   └── utils/   # Утилиты
│   └── public/       # Статические файлы (Service Worker)
├── backend/          # FastAPI приложение
│   ├── app/
│   │   ├── api/      # API роуты
│   │   ├── core/     # Конфигурация, БД, Supabase
│   │   ├── schemas/  # Pydantic схемы
│   │   └── services/ # Бизнес-логика
│   └── requirements.txt
└── supabase/         # SQL миграции
    └── migrations/   # Файлы миграций 0001-0015
```

### Поток данных

```
Frontend (React) 
    ↓ HTTP/HTTPS
Backend (FastAPI)
    ↓ SQL через Psycopg
PostgreSQL (Supabase)
    ↓ RLS Policies
Данные пользователя
```

### Безопасность

- **Row Level Security (RLS)**: Все таблицы защищены политиками доступа
- **JWT токены**: Аутентификация через Supabase Auth
- **Service Role Key**: Используется только на backend для привилегированных операций
- **Rate Limiting**: Защита от брутфорса при логине
- **IP Hashing**: Анонимизация IP адресов в QR событиях

---

## База данных

### Основные таблицы

#### `app_users`
Хранит информацию о пользователях платформы.

```sql
CREATE TABLE public.app_users (
    id uuid PRIMARY KEY REFERENCES auth.users(id),
    email text NOT NULL UNIQUE,
    full_name text,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

**RLS:** Пользователи видят только свои данные.

#### `organizations`
Организации (производители) на платформе.

```sql
CREATE TABLE public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    public_visible boolean NOT NULL DEFAULT false,
    verification_status text NOT NULL DEFAULT 'pending',
    primary_category text,
    tags text,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

**RLS:** 
- SELECT: Члены организации + platform_admin
- UPDATE: owner/admin/manager внутри организации + platform_admin

#### `organization_members`
Связь пользователей с организациями и их роли.

```sql
CREATE TABLE public.organization_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    user_id uuid NOT NULL REFERENCES app_users(id),
    role text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);
```

**Роли:**
- `owner` — владелец (полный доступ)
- `admin` — администратор
- `manager` — менеджер
- `editor` — редактор (может редактировать контент)
- `analyst` — аналитик (только просмотр аналитики)
- `viewer` — наблюдатель (только просмотр)

#### `organization_profiles`
Расширенный профиль организации.

```sql
CREATE TABLE public.organization_profiles (
    organization_id uuid PRIMARY KEY REFERENCES organizations(id),
    short_description text,
    long_description text,
    production_description text,
    safety_and_quality text,
    video_url text,
    main_image_url text,
    gallery jsonb DEFAULT '[]'::jsonb,
    founded_year integer,
    employee_count integer,
    factory_size text,
    category text,
    certifications jsonb DEFAULT '[]'::jsonb,
    sustainability_practices text,
    quality_standards text,
    buy_links jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### `products`
Товары производителей.

```sql
CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    slug text NOT NULL,
    name text NOT NULL,
    short_description text,
    long_description text,
    category text,
    tags text,
    price_cents integer,
    currency text DEFAULT 'RUB',
    status text NOT NULL DEFAULT 'draft',
    is_featured boolean NOT NULL DEFAULT false,
    main_image_url text,
    gallery jsonb,
    external_url text,
    created_by uuid NOT NULL REFERENCES app_users(id),
    updated_by uuid NOT NULL REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(organization_id, slug)
);
```

**Статусы:** `draft`, `published`, `archived`

#### `subscription_plans`
Тарифные планы платформы.

```sql
CREATE TABLE public.subscription_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    price_monthly_cents integer DEFAULT 0,
    price_yearly_cents integer,
    currency text NOT NULL DEFAULT 'RUB',
    max_products integer,
    max_qr_codes integer,
    max_members integer,
    analytics_level text NOT NULL DEFAULT 'basic',
    is_default boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### `organization_subscriptions`
Подписки организаций на тарифы.

```sql
CREATE TABLE public.organization_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    plan_id uuid NOT NULL REFERENCES subscription_plans(id),
    status text NOT NULL DEFAULT 'active',
    current_period_start timestamptz NOT NULL DEFAULT now(),
    current_period_end timestamptz,
    cancel_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(organization_id) WHERE status = 'active'
);
```

#### `qr_codes`
QR-коды организаций.

```sql
CREATE TABLE public.qr_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    code text NOT NULL UNIQUE,
    name text,
    redirect_url text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid NOT NULL REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
```

#### `qr_events`
События сканирования QR-кодов.

```sql
CREATE TABLE public.qr_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_code_id uuid NOT NULL REFERENCES qr_codes(id),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    ip_hash text,
    country text,
    city text,
    user_agent text,
    utm_source text,
    utm_medium text,
    utm_campaign text
);
```

#### `notification_types`
Типы уведомлений (справочник).

```sql
CREATE TABLE public.notification_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    category text NOT NULL,
    severity text NOT NULL,
    title_template text NOT NULL,
    body_template text NOT NULL,
    default_channels text[] NOT NULL DEFAULT ARRAY['in_app'],
    created_at timestamptz NOT NULL DEFAULT now()
);
```

#### `notifications`
Уведомления (события).

```sql
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type_id uuid NOT NULL REFERENCES notification_types(id),
    org_id uuid,
    recipient_user_id uuid,
    recipient_scope text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    payload jsonb,
    severity text NOT NULL,
    category text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamptz,
    is_dismissed boolean NOT NULL DEFAULT false,
    dismissed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

#### `notification_deliveries`
Доставка уведомлений по каналам.

```sql
CREATE TABLE public.notification_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    channel text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    scheduled_at timestamptz,
    sent_at timestamptz,
    read_at timestamptz,
    dismissed_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

**Каналы:** `in_app`, `email`, `telegram`, `push`  
**Статусы:** `pending`, `ready`, `sent`, `failed`, `read`, `dismissed`

#### `reminders`
Отложенные напоминания.

```sql
CREATE TABLE public.reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text,
    user_id uuid,
    org_id uuid,
    notification_type_id uuid NOT NULL REFERENCES notification_types(id),
    payload jsonb,
    first_run_at timestamptz NOT NULL,
    next_run_at timestamptz NOT NULL,
    last_run_at timestamptz,
    recurrence text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Миграции

Все миграции находятся в `supabase/migrations/`:

- `0001_init.sql` — базовые таблицы (app_users, organizations, organization_members, platform_roles)
- `0002_roles_and_profiles.sql` — organization_profiles
- `0003_login_throttle.sql` — защита от брутфорса
- `0004_organization_invites.sql` — система инвайтов
- `0005_moderation_flags.sql` — модерация организаций
- `0006_qr_codes.sql` — QR-коды и события
- `0007_auth_providers.sql` — социальные логины
- `0008_ai_integrations.sql` — AI интеграции
- `0009_dev_tasks.sql` — задачи разработки
- `0010_fix_org_policies.sql` — исправление RLS политик
- `0011_migration_drafts.sql` — черновики миграций
- `0012_notifications.sql` — система уведомлений
- `0013_products.sql` — товары
- `0014_subscriptions.sql` — подписки и тарифы
- `0015_org_profile_extended.sql` — расширение профилей

---

## Backend API

### Базовый URL

```
https://your-backend.railway.app
```

### Аутентификация

Все защищённые endpoints требуют заголовок:

```
Authorization: Bearer <access_token>
```

Токен получается через Supabase Auth или `/api/auth/login`.

### Endpoints

#### Аутентификация

##### `POST /api/auth/after-signup`
Создание пользователя после регистрации в Supabase.

**Request:**
```json
{
  "auth_user_id": "uuid",
  "email": "user@example.com",
  "full_name": "Иван Иванов",
  "organization_name": "ООО Производство",
  "user_type": "producer"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Иван Иванов"
  },
  "organizations": [...],
  "memberships": [...],
  "platform_roles": []
}
```

##### `GET /api/auth/session`
Получение текущей сессии пользователя.

**Response:** `SessionResponse` (тот же формат, что и after-signup)

##### `POST /api/auth/login`
Вход через email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 3600,
  "token_type": "bearer",
  "user": {...},
  "organizations": [...],
  "memberships": [...]
}
```

##### `GET /api/auth/linked-accounts`
Список связанных социальных аккаунтов.

**Response:**
```json
[
  {
    "provider": "yandex",
    "provider_user_id": "123456",
    "email": "user@yandex.ru",
    "created_at": "2024-11-28T10:00:00Z"
  }
]
```

#### Организации

##### `GET /api/organizations/{organization_id}/profile`
Получение профиля организации.

**Response:**
```json
{
  "organization_id": "uuid",
  "name": "ООО Производство",
  "slug": "ooo-proizvodstvo",
  "short_description": "Описание",
  "long_description": "...",
  "gallery": [...]
}
```

##### `PATCH /api/organizations/{organization_id}/profile`
Обновление профиля организации.

**Request:**
```json
{
  "short_description": "Новое описание",
  "main_image_url": "https://..."
}
```

##### `GET /api/organizations/{organization_id}/onboarding`
Прогресс онбординга организации.

**Response:**
```json
{
  "organization_id": "uuid",
  "completion_percent": 60,
  "steps": [
    {
      "key": "profile",
      "label": "Заполните профиль",
      "completed": true
    },
    {
      "key": "products",
      "label": "Добавьте товары",
      "completed": false
    }
  ]
}
```

#### Товары

##### `GET /api/organizations/{organization_id}/products`
Список товаров организации.

**Query params:**
- `status` (optional): `draft` | `published` | `archived`
- `limit` (optional): число
- `offset` (optional): число

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Товар 1",
    "slug": "tovar-1",
    "price_cents": 10000,
    "currency": "RUB",
    "status": "published"
  }
]
```

##### `POST /api/organizations/{organization_id}/products`
Создание товара.

**Request:**
```json
{
  "name": "Новый товар",
  "slug": "novyy-tovar",
  "short_description": "Описание",
  "price_cents": 5000,
  "status": "draft"
}
```

**Ошибка при превышении лимита:**
```json
{
  "detail": {
    "code": "limit_reached",
    "metric": "products",
    "limit": 50
  }
}
```

##### `PATCH /api/organizations/{organization_id}/products/{product_id}`
Обновление товара.

##### `POST /api/organizations/{organization_id}/products/{product_id}/archive`
Архивация товара.

#### Подписки

##### `GET /api/organizations/{organization_id}/subscription`
Информация о подписке организации.

**Response:**
```json
{
  "plan": {
    "name": "Pro",
    "code": "pro",
    "max_products": 100,
    "max_qr_codes": 50
  },
  "usage": {
    "products_used": 25,
    "qr_codes_used": 10,
    "members_used": 5
  }
}
```

#### QR-коды

##### `GET /api/organizations/{organization_id}/qr-codes`
Список QR-кодов организации.

##### `POST /api/organizations/{organization_id}/qr-codes`
Создание QR-кода.

**Request:**
```json
{
  "name": "QR для упаковки",
  "redirect_url": "https://example.com/product/123"
}
```

**Response:**
```json
{
  "id": "uuid",
  "code": "CHSTN-ABC123",
  "qr_url": "https://your-backend.app/q/CHSTN-ABC123",
  "redirect_url": "https://example.com/product/123"
}
```

##### `GET /q/{code}`
Публичный редирект по QR-коду (логирует событие и перенаправляет).

#### Аналитика

##### `GET /api/analytics/organizations/{organization_id}/qr-overview`
Обзор аналитики QR-сканов.

**Query params:**
- `days` (default: 30): число дней

**Response:**
```json
{
  "total_scans": 1250,
  "first_scan_at": "2024-11-01T10:00:00Z",
  "last_scan_at": "2024-11-28T15:30:00Z",
  "daily": [
    {"date": "2024-11-28", "count": 45}
  ],
  "by_country": [
    {"country": "RU", "count": 800},
    {"country": "KZ", "count": 200}
  ],
  "by_source": [
    {"source": "instagram", "count": 300}
  ]
}
```

##### `GET /api/analytics/organizations/{organization_id}/qr-export`
Экспорт аналитики.

**Query params:**
- `days` (default: 30)
- `format`: `csv` | `json`

**Response:** Файл CSV или JSON

#### Уведомления

##### `GET /api/notifications`
Список уведомлений пользователя.

**Query params:**
- `status`: `unread` | `all`
- `limit` (default: 20)
- `cursor` (optional): offset

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "notification": {
        "title": "У вас новый отзыв",
        "body": "...",
        "created_at": "2024-11-28T10:00:00Z"
      },
      "status": "unread"
    }
  ],
  "next_cursor": 20
}
```

##### `GET /api/notifications/unread-count`
Количество непрочитанных уведомлений.

**Response:**
```json
{
  "count": 5
}
```

##### `POST /api/notifications/{id}/read`
Пометить уведомление как прочитанное.

##### `POST /api/notifications/{id}/dismiss`
Скрыть уведомление.

##### `GET /api/notification-settings`
Настройки уведомлений пользователя.

**Response:**
```json
[
  {
    "notification_type_id": "uuid",
    "notification_type": {
      "key": "business.new_review",
      "category": "review"
    },
    "channels": ["in_app", "email"],
    "muted": false
  }
]
```

##### `PATCH /api/notification-settings`
Обновление настроек.

**Request:**
```json
[
  {
    "notification_type_id": "uuid",
    "channels": ["in_app", "email", "push"],
    "muted": false
  }
]
```

#### Публичный API

##### `GET /api/public/organizations/search`
Поиск организаций в публичном каталоге.

**Query params:**
- `q` (optional): поисковый запрос
- `country` (optional): фильтр по стране
- `category` (optional): фильтр по категории
- `verified_only` (optional): только проверенные
- `limit` (default: 20)
- `offset` (default: 0)

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "ООО Производство",
      "slug": "ooo-proizvodstvo",
      "country": "RU",
      "is_verified": true,
      "short_description": "..."
    }
  ],
  "total": 150
}
```

##### `GET /api/public/organizations/details/{slug}`
Детальная информация об организации.

**Response:**
```json
{
  "name": "ООО Производство",
  "slug": "ooo-proizvodstvo",
  "long_description": "...",
  "products": [...],
  "certifications": [...],
  "buy_links": [...]
}
```

##### `GET /api/public/organizations/by-slug/{slug}/products`
Список опубликованных товаров организации.

#### Админ API

##### `GET /api/admin/dashboard/summary`
Сводка по платформе (требует `platform_admin`).

**Response:**
```json
{
  "total_organizations": 150,
  "verified_organizations": 120,
  "public_organizations": 100,
  "total_qr_codes": 500,
  "total_qr_events": 10000,
  "total_products": 800
}
```

##### `POST /api/admin/notifications/emit`
Отправка системного уведомления.

**Request:**
```json
{
  "type_key": "platform.new_pending_registration",
  "org_id": "uuid",
  "recipient_scope": "platform",
  "payload": {
    "company_name": "ООО Новое"
  }
}
```

##### `POST /api/admin/notifications/reminders/process`
Обработка напоминаний (воркер).

**Response:**
```json
{
  "message": "Reminders processed successfully",
  "processed": 10,
  "notifications_created": 8
}
```

##### `POST /api/admin/notifications/email/process`
Обработка email доставок.

##### `POST /api/admin/notifications/telegram/process`
Обработка Telegram доставок.

##### `POST /api/admin/notifications/push/process`
Обработка push доставок.

##### `GET /api/moderation/organizations`
Список организаций для модерации.

**Query params:**
- `status`: `pending` | `verified` | `rejected`

##### `POST /api/moderation/organizations/{id}/verify`
Подтверждение организации.

**Request:**
```json
{
  "status": "verified",
  "notes": "Все проверено"
}
```

##### `GET /api/admin/subscriptions/plans`
Список тарифных планов.

##### `POST /api/admin/subscriptions/organizations/{organization_id}/subscription`
Установка подписки для организации.

**Query params:**
- `plan_id`: UUID плана

---

## Frontend

### Структура страниц

#### Публичные страницы

- `/` — Landing page
- `/orgs` — Каталог производителей
- `/org/:slug` — Публичная страница производителя
- `/invite/:code` — Страница принятия инвайта

#### Аутентификация

- `/register` — Регистрация
- `/login` — Вход
- `/auth/callback` — Callback для OAuth

#### Кабинет

- `/dashboard` — Главная страница кабинета
- `/dashboard/organization/profile` — Профиль организации
- `/dashboard/organization/products` — Товары
- `/dashboard/organization/qr` — QR-коды
- `/dashboard/organization/plan` — Тариф и лимиты
- `/dashboard/organization/invites` — Инвайты
- `/dashboard/organization/onboarding` — Онбординг
- `/dashboard/organization/analytics` — Аналитика

#### Уведомления

- `/notifications` — Список уведомлений
- `/settings/notifications` — Настройки уведомлений
- `/settings/linked-accounts` — Связанные аккаунты

#### Админ

- `/admin` — Админ-панель
- `/admin/db` — Database Explorer
- `/dashboard/admin` — Админ-дашборд
- `/dashboard/moderation/organizations` — Модерация

### Компоненты

#### Navbar
Шапка приложения с навигацией и колокольчиком уведомлений.

```tsx
<Navbar 
  userEmail={user?.email} 
  onLogout={handleLogout} 
  isAdmin={isAdmin} 
/>
```

#### NotificationBell
Иконка уведомлений с счётчиком непрочитанных.

```tsx
<NotificationBell />
```

### State Management

Используется Zustand для глобального состояния.

**Store:** `frontend/src/store/userStore.ts`

```typescript
interface UserState {
  user: User | null
  organizations: Organization[]
  selectedOrganizationId: string | null
  platformRoles: string[]
  // ...
}
```

### API Client

Все API вызовы через `frontend/src/api/authService.ts`.

**Пример:**
```typescript
import { getQrOverview } from '@/api/authService'

const data = await getQrOverview(organizationId, 30)
```

---

## Система уведомлений

### Архитектура

1. **Событие** → Вызов `emit_notification()`
2. **Создание записи** в `notifications`
3. **Определение получателей** (user/org/platform)
4. **Создание deliveries** для каждого канала
5. **Обработка workers** → Отправка через каналы

### Типы уведомлений

Примеры типов (seed данные):

- `business.new_review` — новый отзыв
- `business.new_views` — новые просмотры
- `billing.invoice_unpaid` — неоплаченный счёт
- `billing.subscription_expiring` — истекает подписка
- `platform.new_pending_registration` — новая заявка
- `system.integration_failed` — ошибка интеграции

### Каналы доставки

#### In-App
Уведомления отображаются в приложении (колокольчик, страница `/notifications`).

#### Email
Отправка через SMTP.

**Настройка:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

**Worker:**
```bash
POST /api/admin/notifications/email/process
```

#### Telegram
Отправка через Telegram Bot API.

**Настройка:**
```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_DEFAULT_CHAT_ID=your-chat-id
```

**Worker:**
```bash
POST /api/admin/notifications/telegram/process
```

#### Push (Web Push)
Браузерные push-уведомления через Service Worker.

**Настройка:**
```env
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:noreply@chestno.ru
```

**Service Worker:** `frontend/public/sw.js`

**Worker:**
```bash
POST /api/admin/notifications/push/process
```

### Напоминания (Reminders)

Отложенные уведомления с повторением.

**Пример создания:**
```python
# В коде сервиса
create_reminder(
    key='billing.subscription_expiring',
    user_id=user_id,
    org_id=org_id,
    notification_type_id=type_id,
    first_run_at=datetime.now() + timedelta(days=7),
    recurrence='daily'
)
```

**Обработка:**
```bash
POST /api/admin/notifications/reminders/process
```

---

## Аутентификация и авторизация

### Методы входа

#### Email/Password
1. Пользователь вводит email/password
2. Запрос на `/api/auth/login`
3. Backend проверяет через Supabase Auth
4. Возвращает JWT токены

#### Google OAuth
1. Пользователь нажимает "Войти через Google"
2. Редирект на Supabase OAuth
3. Callback на `/auth/callback`
4. Создание/обновление пользователя

#### Yandex OAuth
1. Пользователь нажимает "Войти через Yandex"
2. Запрос на `/api/auth/yandex/start`
3. Редирект на Yandex OAuth
4. Callback на `/api/auth/yandex/callback`
5. Создание Supabase сессии
6. Автоматическое связывание аккаунтов при совпадении email

### Роли и права

#### Платформенные роли
- `platform_owner` — владелец платформы
- `platform_admin` — администратор платформы
- `moderator` — модератор

#### Роли в организации
- `owner` — полный доступ
- `admin` — администратор
- `manager` — менеджер
- `editor` — редактирование контента
- `analyst` — просмотр аналитики
- `viewer` — только просмотр

### Проверка прав

**Backend:**
```python
from app.services.subscriptions import ensure_org_member

ensure_org_member(user_id, organization_id)
```

**Frontend:**
```typescript
const canEdit = ['owner', 'admin', 'manager', 'editor'].includes(role)
```

---

## QR-коды и аналитика

### Создание QR-кода

**Backend:**
```python
POST /api/organizations/{org_id}/qr-codes
{
  "name": "QR для упаковки",
  "redirect_url": "https://example.com/product/123"
}
```

**Response:**
```json
{
  "code": "CHSTN-ABC123",
  "qr_url": "https://backend.app/q/CHSTN-ABC123"
}
```

### Сканирование

При переходе на `/q/{code}`:
1. Логируется событие в `qr_events`
2. IP хешируется для анонимности
3. Сохраняются UTM параметры (если есть)
4. Редирект на `redirect_url`

### Аналитика

**Метрики:**
- Общее количество сканов
- Первый/последний скан
- Сканы по дням
- Сканы по странам
- Сканы по источникам (UTM)

**Экспорт:**
```bash
GET /api/analytics/organizations/{org_id}/qr-export?format=csv&days=30
```

---

## Товары и подписки

### Управление товарами

**Создание:**
```typescript
await createProduct(orgId, {
  name: "Товар",
  slug: "tovar",
  price_cents: 5000,
  status: "published"
})
```

**Проверка лимитов:**
При создании товара автоматически проверяется лимит плана. При превышении возвращается ошибка:

```json
{
  "detail": {
    "code": "limit_reached",
    "metric": "products",
    "limit": 50
  }
}
```

### Тарифные планы

**Структура плана:**
```json
{
  "code": "pro",
  "name": "Pro",
  "max_products": 100,
  "max_qr_codes": 50,
  "max_members": 10,
  "price_monthly_cents": 5000
}
```

**Установка плана (админ):**
```bash
POST /api/admin/subscriptions/organizations/{org_id}/subscription?plan_id={plan_id}
```

---

## Админ-панель

### Функции

1. **Pending Registrations** — список заявок на регистрацию
2. **AI Integrations** — управление AI провайдерами
3. **Dev / To-Do** — задачи разработки
4. **Database Explorer** — просмотр БД и создание миграций
5. **Admin Dashboard** — метрики платформы
6. **Moderation Dashboard** — модерация организаций и управление тарифами

### AI Integrations

**Health-check:**
```bash
POST /api/admin/ai-integrations/{id}/health-check
```

Проверяет валидность API ключей для OpenAI и Yandex GPT.

---

## Развертывание

### Переменные окружения

#### Frontend
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_BACKEND_URL=https://your-backend.railway.app
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

#### Backend
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
DATABASE_URL=postgresql://...
ALLOWED_ORIGINS=https://your-frontend.pages.dev
FRONTEND_URL=https://your-frontend.pages.dev
SMTP_HOST=smtp.gmail.com
SMTP_USER=...
SMTP_PASSWORD=...
TELEGRAM_BOT_TOKEN=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

### Миграции

**Применение:**
```powershell
.\scripts\apply_migrations.ps1 -DatabaseUrl "postgresql://..."
```

Или вручную:
```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
# ... и так далее для всех миграций
```

### Workers

Настройте cron для автоматического запуска workers:

```bash
# Каждые 5 минут
*/5 * * * * curl -X POST https://backend.app/api/admin/notifications/email/process -H "Authorization: Bearer $ADMIN_TOKEN"

# Каждые 10 минут
*/10 * * * * curl -X POST https://backend.app/api/admin/notifications/reminders/process -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Примеры использования

### Создание уведомления

**Backend:**
```python
from app.services import notifications

notifications.emit_notification(
    NotificationEmitRequest(
        type_key='business.new_review',
        org_id=organization_id,
        recipient_scope='organization',
        payload={'review_id': review_id}
    ),
    actor_user_id=current_user_id
)
```

### Проверка лимита

**Backend:**
```python
from app.services.subscriptions import check_org_limit

try:
    check_org_limit(organization_id, 'products')
    # Создать товар
except HTTPException as e:
    # Лимит превышен
    pass
```

### Получение аналитики

**Frontend:**
```typescript
import { getQrOverview } from '@/api/authService'

const analytics = await getQrOverview(organizationId, 30)
console.log(`Всего сканов: ${analytics.total_scans}`)
```

### Экспорт данных

**Frontend:**
```typescript
import { exportQrData } from '@/api/authService'

await exportQrData(organizationId, 30, 'csv')
// Файл автоматически скачается
```

---

## Заключение

Эта документация покрывает все основные аспекты платформы Chestno.ru. Для дополнительной информации обращайтесь к исходному коду или создавайте issues в репозитории.

**Версия документа:** 1.0.0  
**Последнее обновление:** Ноябрь 2024

