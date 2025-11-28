# Chestno.ru — Project Rules

## 1. Общие ограничения проекта

- **Backend:** Python + FastAPI, структура строго через `/backend/app`
- **Миграции:** Supabase Postgres migrations в `/supabase/migrations`
- **Frontend:** Vite/React/TypeScript, деплой через Railway (статический фронтенд)
- **Деплой backend:** Railway, переменные уровня проекта обязательны
- **База данных:** Supabase Postgres с RLS (Row Level Security)
- **Индексация:** Cursor должен учитывать только рабочие файлы, не читать лог-файлы, кэш и сборки

## 2. Архитектурные принципы Chestno.ru

### 2.1. Аутентификация

- **Supabase Auth:**
  - Использовать `getSupabaseClient()` для фронтенда
  - Backend: `get_current_user_id` для проверки авторизации
  - Роли: `platform_admin`, `platform_owner` для админ-панели
  - Все токены через Supabase Auth, не хранить в БД

### 2.2. База данных

- **Миграции:**
  - Все изменения схемы через миграции в `/supabase/migrations`
  - Нумерация: `00XX_description.sql`
  - RLS политики обязательны для всех таблиц
  - Не использовать прямые ALTER TABLE в коде

- **Структура:**
  - `organizations` — основные данные организаций
  - `organization_profiles` — расширенные профили
  - `app_users` — пользователи приложения
  - `platform_roles` — роли пользователей
  - `reviews` — отзывы пользователей
  - `organization_posts` — новости/посты организаций

### 2.3. API Endpoints

- **Публичные:** `/api/public/*` — без авторизации
- **Защищенные:** `/api/*` — требуют авторизации
- **Админ:** `/api/admin/*` — требуют `platform_admin` роль

### 2.4. Frontend

- **Роутинг:** React Router, SPA routing
- **State:** Zustand для глобального состояния
- **API:** Axios через `httpClient.ts`
- **Стили:** Tailwind CSS + shadcn/ui
- **Типы:** TypeScript, синхронизация с Pydantic схемами

### 2.5. Медиа

- **Хранилище:** Supabase Storage
- **Buckets:** `org-media`, `review-media`
- **Загрузка:** через `MediaUploader` компонент
- **Форматы:** изображения (JPG, PNG), видео (MP4 H.264+AAC)

## 3. Безопасность

- Никогда не открывать файлы `.env`, `secrets/`, Railway Variables
- Не выводить реальные ключи Supabase, Railway
- При обращении к config — использовать `get_settings()` из `app.core.config`
- RLS политики для всех таблиц
- Валидация входных данных через Pydantic

## 4. Git-поток

- Все изменения — через PR
- Нельзя коммитить в main напрямую
- После крупного изменения — предложить smoke test:
  - GET `/health` или `/docs`
  - Проверка основных API endpoints
  - Проверка фронтенда на Railway

## 5. Test-driven

- Каждую измененную логику FastAPI — покрыть хотя бы минимальными тестами
- Для фронтенда:
  - `npm run lint`
  - `npm run build`
  - Smoke test: проверка ключевых роутов

## 6. MCP-специфические правила

- **MCP filesystem:**
  - Можно открывать только файлы `backend/app`, `frontend/src`, `docs`, `supabase/migrations`
  - Нельзя открывать `.env`, `railway.json`, секреты

- **MCP docs:**
  - Использовать для FastAPI, Supabase JS/Python, React, TypeScript

- **MCP memory:**
  - Сохранять: схемы таблиц, форматы API, порядок OAuth flows, структуру миграций

## 7. Особенности Chestno.ru

### 7.1. Организации

- Использовать ID вместо slug для публичных страниц
- `public_visible = true` для публичных организаций
- `verification_status = 'verified'` не обязателен (можно убрать из WHERE)

### 7.2. Отзывы

- Статусы: `pending`, `approved`, `rejected`
- Модерация через админ-панель
- Ответы организаций на отзывы
- Уведомления для владельцев при новых отзывах

### 7.3. Посты организаций

- Статусы: `draft`, `published`, `archived`
- Публичные посты только со статусом `published`
- Галерея изображений, видео, основной текст

### 7.4. Деплой

- **Railway:** автоматический деплой из main
- **Dockerfile:** multi-stage build (frontend + backend)
- **Переменные:** через Railway Variables
- **Frontend:** собирается в Dockerfile, раздается через FastAPI static files

## 8. Работа с ошибками

- Всегда проверять логи Railway при ошибках
- Проверять структуру БД перед использованием колонок
- Использовать `test_db_connection.py` для диагностики
- Создавать скрипты для проверки данных

