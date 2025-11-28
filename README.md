# Работаем Честно! — монорепозиторий

Платформа для производителей, которые хотят прозрачно показывать своё производство. Текущий этап охватывает регистрацию/логин производителей, базовый кабинет, а также backend-службу с безопасной логикой.

## Структура

```
frontend/   # Vite + React + TypeScript + Tailwind + shadcn/ui
backend/    # FastAPI (Python 3.11) + Supabase service key
supabase/   # SQL миграции (таблицы, RLS)
```

## Переменные окружения

### Frontend (`frontend/env.local`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BACKEND_URL=http://localhost:8000
```

### Backend (`backend/.env` или `backend/env.local`)

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
QR_IP_HASH_SALT=please-change-me
SOCIAL_LOGIN_SALT=...
SOCIAL_STATE_SECRET=...
YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
YANDEX_REDIRECT_URI=https://backend.example.com/api/auth/yandex/callback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@chestno.ru
SMTP_FROM_NAME=Работаем Честно!
SMTP_USE_TLS=true
TELEGRAM_BOT_TOKEN=
TELEGRAM_DEFAULT_CHAT_ID=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:noreply@chestno.ru
```

## Локальный запуск

### Быстрый старт

**Гибридный вариант (рекомендуется):**
- Frontend и Backend запускаются локально
- База данных и Auth используют Supabase (удалённые)

**Подробная инструкция:** См. `QUICK_START.md` или `LOCAL_SETUP.md`

**Кратко:**

```powershell
# Терминал 1 - Backend
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload

# Терминал 2 - Frontend  
cd frontend
npm run dev

# Откройте: http://localhost:5173
```

**Автоматическая настройка:**
```powershell
.\start-local.ps1
```

### Frontend

```
cd frontend
cp env.example .env.local  # заполните значениями
npm install
npm run dev
```

**Важно:** В `.env.local` укажите:
- `VITE_BACKEND_URL=http://localhost:8000` (для локального backend)
- Или `VITE_BACKEND_URL=https://your-backend.railway.app` (для Railway backend)

### Backend

```
cd backend
cp env.example .env
python -m venv .venv
.venv\Scripts\activate  # Windows (или source .venv/bin/activate на Unix)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Важно:** В `.env` укажите:
- `ALLOWED_ORIGINS=http://localhost:5173` (для локального frontend)
- `DATABASE_URL` должен указывать на Supabase (или локальную PostgreSQL)

### Supabase миграции

```
# через скрипт PowerShell (требуется psql в PATH):
scripts\apply_migrations.ps1 -DatabaseUrl "<postgres connection string>"

# либо вручную psql:
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_roles_and_profiles.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_login_throttle.sql
psql "$DATABASE_URL" -f supabase/migrations/0004_organization_invites.sql
psql "$DATABASE_URL" -f supabase/migrations/0005_moderation_flags.sql
psql "$DATABASE_URL" -f supabase/migrations/0006_qr_codes.sql
psql "$DATABASE_URL" -f supabase/migrations/0007_auth_providers.sql
psql "$DATABASE_URL" -f supabase/migrations/0008_ai_integrations.sql
psql "$DATABASE_URL" -f supabase/migrations/0009_dev_tasks.sql
psql "$DATABASE_URL" -f supabase/migrations/0010_fix_org_policies.sql
psql "$DATABASE_URL" -f supabase/migrations/0011_migration_drafts.sql
psql "$DATABASE_URL" -f supabase/migrations/0012_notifications.sql
psql "$DATABASE_URL" -f supabase/migrations/0013_products.sql
psql "$DATABASE_URL" -f supabase/migrations/0014_subscriptions.sql
psql "$DATABASE_URL" -f supabase/migrations/0015_org_profile_extended.sql
```

`DATABASE_URL` берём из Supabase (pooler: `postgresql://...pooler.supabase.com:6543/postgres?sslmode=require`) либо из Railway переменных.

## Реализовано

- Регистрация (`/register`): два режима — производитель или пользователь. Для соц-логина доступны кнопки Google/Yandex.
- Авторизация (`/login`): email+пароль → `/api/auth/login`; Google через Supabase OAuth; Яндекс через FastAPI `/api/auth/yandex/*` с возвратом Supabase session на `/auth/callback`.
- Кабинет (`/dashboard`): выбор организации, карточка профиля, ссылки на инвайты/QR/модерацию/admin.
- Профиль организации (`/dashboard/organization/profile`): просмотр + редактирование (owner/admin/manager/editor).
- Инвайты (`/dashboard/organization/invites`, `/invite/:code`): создание менеджерами, принятие по ссылке.
- Модерация (`/dashboard/moderation/organizations`): platform_owner/platform_admin видят pending/verified/rejected и обновляют статусы.
- Admin-панель (`/admin`): вкладки Pending Registrations (заглушка), AI Integrations (CRUD + health-check), Dev / To-Do (чеклист интеграций).
- Database Explorer (`/admin/db`): просмотр таблиц, колонок, данных и создание миграционных черновиков (`migration_drafts`).
- Публичные страницы (`/org/:slug`): Read-only данные только для `public_visible=true` и `verified`.
- QR-коды (`/dashboard/organization/qr`, `/q/{code}`): генерация ссылок, логирование `qr_events`, базовая статистика.
- Notifications: in-app уведомления с колокольчиком в шапке, отдельная страница `/notifications` и настройки `/settings/notifications`. Бэкенд: таблицы `notification_types`, `notifications`, `notification_deliveries`, `user_notification_settings`, `reminders`.
- Products: управление товарами организации (`/dashboard/organization/products`) + публичная витрина на странице производителя.
- Subscription plans & limits: таблицы `subscription_plans`, `organization_subscriptions`, страница `/dashboard/organization/plan`, проверка лимитов при создании товаров и QR-кодов.
- Публичный каталог (`/orgs`, `/api/public/organizations/search`) с фильтрами и поиском; расширенная публичная страница производителя (`/org/:slug`) с товарами, сертификатами и ссылками «Где купить».
- Онбординг (`/dashboard/organization/onboarding`) с прогресс-баром и шагами (профиль, товары, QR-коды, верификация, инвайты).
- Аналитика (`/dashboard/organization/analytics`, `/api/analytics/organizations/{id}/qr-overview`) — статистика QR-сканов по дням, по странам, по источникам (UTM), экспорт в CSV/JSON.
- Мини-админка платформы (`/dashboard/admin`) — агрегированные показатели по организациям, товарам, QR.
- Email-уведомления: SMTP интеграция, worker для обработки pending email deliveries (`/api/admin/notifications/email/process`).
- Telegram-уведомления: интеграция с Telegram Bot API, worker для обработки (`/api/admin/notifications/telegram/process`).
- Web Push-уведомления: Service Worker для браузерных push-уведомлений, worker для обработки (`/api/admin/notifications/push/process`).
- Связывание аккаунтов: автоматическое связывание социальных аккаунтов (Yandex, Google) с существующими email, endpoint `/api/auth/linked-accounts`, UI страница `/settings/linked-accounts`.
- Health-check для Yandex AI: реальная проверка валидности API ключа через Yandex GPT API.
- Supabase миграции:
  - `0001_init`
  - `0002_roles_and_profiles`
  - `0003_login_throttle`
  - `0004_organization_invites`
  - `0005_moderation_flags`
  - `0006_qr_codes`
  - `0007_auth_providers`
  - `0008_ai_integrations`
  - `0009_dev_tasks`
  - `0010_fix_org_policies`
  - `0011_migration_drafts`
  - `0012_notifications`
  - `0013_products`
  - `0014_subscriptions`
  - `0015_org_profile_extended`

## Хостинг (ориентир)

- Frontend → Cloudflare Pages (Vite build).
- Backend → Railway.
- Supabase → Postgres + Auth (RLS включён в миграции).

### Railway backend

1. Настрой `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS`.
2. Деплой (например через GitHub или `railway up`).
3. Быстрая проверка из CLI:

```
npx -y @railway/cli@latest run --service chestno.ru -- python -m compileall app
```

## Проверки / тесты

- Frontend: `cd frontend && npm run lint`
- Backend: `cd backend && python -m compileall app`

## Примеры запросов

```bash
# Создать инвайт (нужен JWT с ролью owner/admin/manager)
curl -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","role":"editor"}' \
  https://<backend>/api/organizations/<org_id>/invites

# Принять инвайт после логина
curl -H "Authorization: Bearer <token>" -X POST https://<backend>/api/invites/<code>/accept

# QR redirect (событие + 302 на публичную страницу)
curl -I https://<backend>/q/<qr_code>

# Админ: список AI-интеграций
curl -H "Authorization: Bearer <admin_token>" https://<backend>/api/admin/ai/integrations

# Админ: создать dev-задачу
curl -H "Authorization: Bearer <admin_token>" -H "Content-Type: application/json" \
  -d '{"title":"Настроить Яндекс OAuth","category":"auth","related_provider":"yandex"}' \
  https://<backend>/api/admin/dev-tasks

# Database Explorer: список таблиц
curl -H "Authorization: Bearer <admin_token>" https://<backend>/api/admin/db/tables

# Создать товар
curl -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"Продукт","slug":"produkt","status":"published"}' \
  https://<backend>/api/organizations/<org_id>/products

# Получить тариф и лимиты
curl -H "Authorization: Bearer <token>" https://<backend>/api/organizations/<org_id>/subscription

# Уведомления (список)
curl -H "Authorization: Bearer <token>" https://<backend>/api/notifications

# Экспорт аналитики (CSV)
curl -H "Authorization: Bearer <token>" https://<backend>/api/analytics/organizations/<org_id>/qr-export?format=csv&days=30

# Обработка email deliveries (admin)
curl -X POST -H "Authorization: Bearer <admin_token>" https://<backend>/api/admin/notifications/email/process

# Обработка telegram deliveries (admin)
curl -X POST -H "Authorization: Bearer <admin_token>" https://<backend>/api/admin/notifications/telegram/process

# Обработка push deliveries (admin)
curl -X POST -H "Authorization: Bearer <admin_token>" https://<backend>/api/admin/notifications/push/process

# Публичный каталог производителей
curl "https://<backend>/api/public/organizations/search?q=текстиль&verified_only=true"

# Онбординг
curl -H "Authorization: Bearer <token>" https://<backend>/api/organizations/<org_id>/onboarding

# Аналитика QR
curl -H "Authorization: Bearer <token>" "https://<backend>/api/analytics/organizations/<org_id>/qr-overview?days=30"
```

