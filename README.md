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
```

## Локальный запуск

### Frontend

```
cd frontend
cp env.example env.local  # заполните значениями
npm install
npm run dev
```

### Backend

```
cd backend
cp env.example .env
python -m venv .venv
.venv\Scripts\activate  # Windows (или source .venv/bin/activate на Unix)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

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
- Публичные страницы (`/org/:slug`): Read-only данные только для `public_visible=true` и `verified`.
- QR-коды (`/dashboard/organization/qr`, `/q/{code}`): генерация ссылок, логирование `qr_events`, базовая статистика.
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
```

