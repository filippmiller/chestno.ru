# eBay Connector App — Project Rules

## 1. Общие ограничения проекта

- Бэкенд: Python + FastAPI, структура строго через `/backend/app`.
- Миграции: Alembic, единый источник истины — Supabase Postgres (pooler, sslmode=require).
- Frontend: Vite/React, Cloudflare Pages, переменные — только публичные (VITE_…).
- Деплой backend: Railway, переменные уровня проекта обязательны.
- Индексация: Cursor должен учитывать только рабочие файлы, не читать лог-файлы, кэш и сборки.

## 2. Архитектурные принципы eBay Connector

### 2.1. OAuth

- eBay OAuth:
  - Не менять порядок refresh token flow.
  - Все токены: хранить в PostgreSQL → таблица oauth_tokens.
  - Worker проверки expiry раз в 10 минут.
  - Все изменения вокруг OAuth — через существующие модули (не создавать новые клиенты).

- Gmail OAuth:
  - Использовать redirect: https://ebay-connector-frontend.pages.dev/api
  - Не показывать реальный GMAIL_CLIENT_SECRET.
  - Логи OAuth писать строго в DB, а не print.

### 2.2. eBay Notifications / Ingestion Worker

- Любые изменения ingestion:
  - Сначала показать plan.md,
  - Потом обновление моделей Pydantic,
  - Потом ручной diff,
  - Потом обновить Alembic.

- Все eBay уведомления (account deletion, item events, message events):
  - Должны записываться в таблицу notifications_raw целиком (headers + payload + verified).

### 2.3. Listing Worker

- Любые изменения в логике создания лотов eBay — строго через существующие классы в `backend/app/listing`.
- Нельзя менять связь: Inventory → PartsDetail → ListingStatus.

### 2.4. Messages Worker + AI AutoReply

- Все черновики — писать в таблицу approved_replies (если не существует — предложить миграцию).
- Нельзя отправлять клиенту автоответ без REVIEW флага.

### 2.5. Analytics / eBay DB Map

- Все изменения аналитики:
  - использовать только чтение (read-only),
  - запреты: ALTER, UPDATE, DELETE в MSSQL Dashboard,
  - соблюдать COLLATE DATABASE_DEFAULT при join.

## 3. Безопасность

- Никогда не открывать файлы `.env`, `secrets/`, Railway Variables.
- Не выводить реальные ключи eBay, Supabase, Gmail, OpenAI.
- При обращении к config — использовать абстракцию вроде `settings.<field>`.

## 4. Git-поток

- Все изменения — через PR.
- Нельзя коммитить в main.
- После крупного изменения — Cursor должен предложить smoke test:
  - GET /health,
  - /docs,
  - eBay OAuth попытка refresh (dry-run),
  - Gmail OAuth dry-run.

## 5. Test-driven

- Каждую измененную логику FastAPI — покрыть хотя бы минимальными тестами:
  - test_oauth.py
  - test_ingestion.py
  - test_listing.py
  - test_messages.py

- Для фронтенда:
  - npm run lint
  - npm run build
  - smoke test: проверка, существуют ли ключевые роуты.

## 6. MCP-специфические правила

- MCP filesystem:
  - можно открывать только файлы backend/app, frontend/src, docs, alembic/versions.
  - нельзя открывать .env, railway.json, key.json, secrets.

- MCP docs:
  - использовать для eBay API, FastAPI, Supabase JS/Python, Gmail API.

- MCP memory:
  - сохранять: схемы таблиц, форматы уведомлений eBay, порядок OAuth flows, структуру Alembic.

