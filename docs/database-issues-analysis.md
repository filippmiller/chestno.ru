# Анализ проблем с базой данных

## Дата анализа: 2025-11-28

## Проблема 1: Ошибка 500 в API `/api/public/organizations/{id}`

### Симптомы
- API endpoint возвращал HTTP 500 (Internal Server Error)
- Страница организации не загружалась
- В логах ошибка: `column does not exist`

### Причина
Функция `get_public_organization_details_by_id` в `backend/app/services/organization_profiles.py` использовала SQL-запрос с несуществующими колонками.

### Обнаруженные проблемы

#### 1. Колонка `o.tags` не существует
**Ошибка:** `column o.tags does not exist`
- В таблице `organizations` нет колонки `tags`
- Колонка `tags` существует только в таблице `organization_profiles` как `p.tags`

**Исправление:**
```sql
-- Было:
o.verification_status, o.tags,

-- Стало:
o.verification_status, COALESCE(p.tags, '') as tags,
```

#### 2. Колонка `p.category` не существует
**Ошибка:** `column p.category does not exist`
- В таблице `organization_profiles` нет колонки `category`
- Структура таблицы `organization_profiles` (19 колонок):
  - id, organization_id, short_description, long_description, production_description
  - safety_and_quality, video_url, gallery, tags, language
  - created_at, updated_at
  - contact_email, contact_phone, contact_website, contact_address
  - contact_telegram, contact_whatsapp, social_links

**Исправление:**
```sql
-- Было:
p.category, p.founded_year, p.employee_count, p.factory_size,
p.certifications, p.sustainability_practices, p.quality_standards, p.buy_links,

-- Стало:
NULL as category, NULL as founded_year, NULL as employee_count, NULL as factory_size,
NULL::jsonb as certifications, NULL as sustainability_practices, NULL as quality_standards, NULL::jsonb as buy_links,
```

### Структура таблиц

#### Таблица `organizations`
Основные колонки:
- id, name, slug, country, city, website_url
- is_verified, verification_status, public_visible
- created_at, updated_at, verified_at, verified_by

**НЕТ колонок:**
- tags (есть только в organization_profiles)

#### Таблица `organization_profiles`
Колонки (19):
- id, organization_id
- short_description, long_description, production_description
- safety_and_quality, video_url, gallery, tags, language
- created_at, updated_at
- contact_email, contact_phone, contact_website, contact_address
- contact_telegram, contact_whatsapp, social_links

**НЕТ колонок:**
- category
- founded_year
- employee_count
- factory_size
- certifications
- sustainability_practices
- quality_standards
- buy_links

## Проблема 2: Отсутствие пользователя в app_users

### Симптомы
- Пользователь `filippmiller@gmail.com` существовал в Supabase Auth
- Но отсутствовал в таблице `app_users`
- Роль `platform_admin` не была назначена

### Причина
Пользователь был создан в Supabase Auth, но:
1. Запись в `app_users` не была создана автоматически
2. Роль `platform_admin` не была назначена

### Решение
Создан скрипт `backend/scripts/check_and_create_admin.py`, который:
1. Проверяет наличие пользователя в `app_users`
2. Если не найден - проверяет Supabase Auth
3. Создает запись в `app_users` если пользователь есть в Auth
4. Назначает роль `platform_admin`

## Проблема 3: Подключение к базе данных

### Статус
✅ **Подключение работает нормально**

Проверка показала:
- Подключение к PostgreSQL успешно
- Версия: PostgreSQL 17.6
- Все запросы выполняются корректно (после исправления SQL)

### Тестирование подключения
Создан скрипт `backend/scripts/test_db_connection.py` для проверки:
- Подключения к БД
- Структуры таблиц
- Выполнения SQL-запросов

## Исправления

### 1. Исправлен SQL-запрос в `get_public_organization_details_by_id`
**Файл:** `backend/app/services/organization_profiles.py`

**Изменения:**
- `o.tags` → `COALESCE(p.tags, '') as tags`
- `p.category` → `NULL as category`
- Все несуществующие колонки заменены на `NULL`

### 2. Обновлена логика создания `PublicOrganizationDetails`
**Файл:** `backend/app/services/organization_profiles.py`

**Изменения:**
- Все несуществующие поля установлены в `None`
- `tags` берется из `p.tags` или `None`

### 3. Создан администратор
**Скрипт:** `backend/scripts/check_and_create_admin.py`

**Результат:**
- Пользователь `filippmiller@gmail.com` добавлен в `app_users`
- Роль `platform_admin` назначена

## Рекомендации

### 1. Проверить миграции
Убедиться, что все миграции применены и структура БД соответствует ожиданиям кода.

### 2. Добавить недостающие колонки (если нужны)
Если поля `category`, `founded_year`, `employee_count`, `factory_size`, `certifications`, `sustainability_practices`, `quality_standards`, `buy_links` действительно нужны, создать миграцию для их добавления.

### 3. Синхронизировать схемы
Убедиться, что:
- Pydantic схемы соответствуют структуре БД
- TypeScript типы соответствуют Pydantic схемам
- SQL-запросы используют только существующие колонки

### 4. Добавить валидацию
Добавить проверки существования колонок перед выполнением запросов или использовать ORM для автоматической валидации.

## Статус исправлений

✅ **Исправлено:**
- SQL-запрос в `get_public_organization_details_by_id`
- Создание администратора
- Подключение к БД работает

⏳ **Ожидает деплоя:**
- Изменения закоммичены и запушены
- После деплоя API должен работать корректно

