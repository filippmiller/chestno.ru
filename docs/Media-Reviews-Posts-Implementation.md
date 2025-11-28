# Реализация: Медиа, Отзывы и Посты

**Дата:** Ноябрь 2024  
**Версия:** 1.1.0

---

## Обзор

Этот документ описывает реализацию функционала медиа-контента, отзывов пользователей и новостей/постов производителей для платформы Chestno.ru.

---

## Новые таблицы БД

### 1. Расширение `organization_profiles`

Добавлены поля для контактов и социальных сетей:

- `contact_email` (text)
- `contact_phone` (text)
- `contact_website` (text)
- `contact_address` (text)
- `contact_telegram` (text)
- `contact_whatsapp` (text)
- `social_links` (jsonb) - массив объектов `{type, label, url}`

**Миграция:** `0016_media_reviews_posts.sql`

---

### 2. Таблица `organization_posts`

Новости и посты, публикуемые производителями.

**Поля:**
- `id` (uuid, PK)
- `organization_id` (uuid, FK → organizations)
- `author_user_id` (uuid, FK → app_users)
- `slug` (text, уникален в рамках организации)
- `title` (text)
- `excerpt` (text, опционально)
- `body` (text)
- `status` ('draft' | 'published' | 'archived')
- `main_image_url` (text)
- `gallery` (jsonb) - массив `[{url, alt?, sort_order?}]`
- `video_url` (text)
- `published_at` (timestamptz)
- `is_pinned` (boolean)
- `created_at`, `updated_at` (timestamptz)

**RLS:**
- Публичное чтение: только `status='published'` для организаций с `public_visible=true`
- Внутреннее чтение: все посты для членов организации
- Запись: только роли `owner|admin|manager|editor`

**Миграция:** `0016_media_reviews_posts.sql`

---

### 3. Таблица `reviews`

Отзывы пользователей о производителях и товарах.

**Поля:**
- `id` (uuid, PK)
- `organization_id` (uuid, FK → organizations)
- `product_id` (uuid, FK → products, nullable)
- `author_user_id` (uuid, FK → app_users)
- `rating` (smallint, 1-5)
- `title` (text, опционально)
- `body` (text)
- `media` (jsonb) - массив `[{type: 'image'|'video', url, thumbnail_url?, alt?}]`
- `status` ('pending' | 'approved' | 'rejected')
- `moderated_by` (uuid, FK → app_users)
- `moderated_at` (timestamptz)
- `moderation_comment` (text)
- `created_at`, `updated_at` (timestamptz)

**RLS:**
- Публичное чтение: только `status='approved'` для организаций с `public_visible=true`
- Внутреннее чтение: все отзывы для членов организации
- Автор видит свой отзыв независимо от статуса
- Запись: любой авторизованный пользователь
- Модерация: роли `owner|admin|manager` в организации

**Миграция:** `0016_media_reviews_posts.sql`

---

## Backend API

### Посты

#### Для кабинета организации

- `GET /api/organizations/{organization_id}/posts` - список постов
  - Параметры: `status?`, `search?`, `limit?`, `offset?`
- `GET /api/organizations/{organization_id}/posts/{post_id}` - получить пост
- `POST /api/organizations/{organization_id}/posts` - создать пост
- `PATCH /api/organizations/{organization_id}/posts/{post_id}` - обновить пост

#### Публичные

- `GET /api/public/organizations/by-slug/{slug}/posts` - список опубликованных постов
- `GET /api/public/organizations/by-slug/{slug}/posts/{post_slug}` - получить опубликованный пост

**Схемы:** `app/schemas/posts.py`  
**Сервисы:** `app/services/posts.py`  
**Роуты:** `app/api/routes/posts.py`

---

### Отзывы

#### Для кабинета организации

- `GET /api/organizations/{organization_id}/reviews` - список отзывов
  - Параметры: `status?`, `product_id?`, `limit?`, `offset?`
- `GET /api/organizations/{organization_id}/reviews/stats` - статистика отзывов
- `PATCH /api/organizations/{organization_id}/reviews/{review_id}/moderate` - модерировать отзыв

#### Публичные

- `GET /api/public/organizations/by-slug/{slug}/reviews` - список опубликованных отзывов
  - Параметры: `product_slug?`, `limit?`, `offset?`, `order?` ('newest' | 'highest_rating')
- `POST /api/public/organizations/by-slug/{slug}/reviews` - создать отзыв (требует авторизации)

**Схемы:** `app/schemas/reviews.py`  
**Сервисы:** `app/services/reviews.py`  
**Роуты:** `app/api/routes/reviews.py`

---

### Обновленный профиль организации

- `GET /api/organizations/{organization_id}/profile` - теперь возвращает контакты и соцсети
- `PATCH /api/organizations/{organization_id}/profile` - теперь принимает контакты и соцсети

**Обновлено:** `app/services/organization_profiles.py`

---

## Frontend

### Новые страницы

1. **`/dashboard/organization/posts`** - список постов организации
2. **`/dashboard/organization/posts/new`** - создание поста
3. **`/dashboard/organization/posts/:postId`** - редактирование поста
4. **`/dashboard/organization/reviews`** - управление отзывами

### Обновленные страницы

1. **`/dashboard/organization/profile`** - добавлены:
   - Поля контактов (email, телефон, сайт, адрес, Telegram, WhatsApp)
   - Компонент MediaUploader для загрузки фото и видео
   - Галерея фотографий

2. **`/org/:slug`** (публичная страница) - добавлены:
   - Блок контактов и соцсетей
   - Блок новостей (последние 5 постов)
   - Блок отзывов (последние 5 отзывов, средний рейтинг)

### Новые компоненты

- **`MediaUploader`** (`frontend/src/components/MediaUploader.tsx`)
  - Загрузка файлов в Supabase Storage
  - Поддержка изображений и видео
  - Валидация размера и формата

### Новые утилиты

- **`mediaUploader.ts`** (`frontend/src/utils/mediaUploader.ts`)
  - Функции для загрузки в разные bucket'ы
  - Валидация файлов

### Новые типы

- `frontend/src/types/posts.ts` - типы для постов
- `frontend/src/types/reviews.ts` - типы для отзывов
- Обновлен `frontend/src/types/auth.ts` - добавлены контакты и соцсети

### Новые API сервисы

- `frontend/src/api/postsService.ts` - клиент для работы с постами
- `frontend/src/api/reviewsService.ts` - клиент для работы с отзывами

---

## Медиа-хранилище (Supabase Storage)

### Buckets

1. **`org-media`** - медиа контент производителя
   - Структура: `org-{org_id}/profile/main/`, `org-{org_id}/posts/{post_id}/`, `org-{org_id}/products/{product_id}/`

2. **`review-media`** - UGC-контент (отзывы)
   - Структура: `org-{org_id}/product-{product_id or 'org'}/review-{review_id}/`

### Правила

- **Изображения:** JPEG, PNG, WebP, до 10 МБ
- **Видео:** MP4 (H.264 + AAC), до 3 ГБ, до 40 минут, 1080p

**Документация:** `docs/media-storage.md`

---

## Уведомления

### Новый тип уведомления

- **`business.new_review`** - уведомление о новом отзыве
  - Категория: `review`
  - Каналы по умолчанию: `['in_app', 'email']`
  - Отправляется членам организации с ролями `owner|admin|manager`

**Миграция:** `0017_add_review_notification_type.sql`

---

## Онбординг

### Расширенные шаги

Онбординг теперь включает 9 шагов:

1. `profile_basic` - заполнение основного профиля
2. `contacts` - добавление контактов
3. `story_and_photos` - история и фотографии
4. `video_presentation` - видеопрезентация
5. `products` - добавление товаров
6. `qr_codes` - создание QR-кодов
7. `verification` - верификация
8. `invites` - приглашение коллег
9. `first_post` - публикация первого поста

**Обновлено:** `backend/app/services/onboarding.py`, `backend/app/schemas/onboarding.py`

---

## Пример использования

### Создание поста

```typescript
import { createOrganizationPost } from '@/api/postsService'

const post = await createOrganizationPost(organizationId, {
  slug: 'our-new-product',
  title: 'Наш новый продукт',
  excerpt: 'Краткое описание',
  body: 'Полный текст поста...',
  status: 'published',
  main_image_url: 'https://...',
  gallery: [{ url: 'https://...', alt: 'Фото 1' }],
  is_pinned: false,
})
```

### Создание отзыва

```typescript
import { createPublicReview } from '@/api/reviewsService'

const review = await createPublicReview(organizationSlug, {
  product_id: productId, // или null для отзыва о производителе
  rating: 5,
  title: 'Отличный товар!',
  body: 'Очень доволен качеством...',
  media: [{ type: 'image', url: 'https://...', alt: 'Фото товара' }],
})
```

### Загрузка медиа

```typescript
import { uploadProfileImage } from '@/utils/mediaUploader'

const file = event.target.files[0]
const url = await uploadProfileImage(organizationId, file)
// url можно использовать в форме профиля
```

---

## Миграции

1. **`0016_media_reviews_posts.sql`**
   - Расширение `organization_profiles` (контакты)
   - Создание `organization_posts`
   - Создание `reviews`
   - RLS политики

2. **`0017_add_review_notification_type.sql`**
   - Добавление типа уведомления `business.new_review`

---

## Следующие шаги (опционально)

- [ ] Публичные страницы постов (`/org/:slug/posts/:postSlug`)
- [ ] Форма оставления отзывов на публичной странице
- [ ] Лайки/полезность отзывов
- [ ] Комментарии к постам
- [ ] Приватные bucket'ы с подписанными URL
- [ ] Автоматическая обработка видео (транскодирование)

---

## Чеклист для разработчика

- [x] Миграции БД применены
- [x] Backend API реализован
- [x] Frontend страницы созданы
- [x] MediaUploader интегрирован
- [x] Уведомления настроены
- [x] Онбординг расширен
- [x] Линтинг и компиляция проходят
- [ ] Тестирование в браузере
- [ ] Настройка Supabase Storage buckets

---

## Контакты

При возникновении вопросов обращайтесь к команде разработки.

