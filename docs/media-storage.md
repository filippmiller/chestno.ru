# Медиа-хранилище Chestno.ru

**Версия:** 1.0.0  
**Дата:** Ноябрь 2024

---

## Обзор

Документ описывает архитектуру хранения медиа-файлов (фото, видео) в Supabase Storage для платформы Chestno.ru.

---

## Структура Buckets

### 1. `org-media` — Медиа контент производителя

**Назначение:** Файлы, загружаемые самим производителем для своего профиля, товаров и постов.

**Структура путей:**

```
org-{organization_id}/
  ├── profile/
  │   ├── main/
  │   │   └── {filename}                    # Главное фото профиля
  │   └── gallery/
  │       └── {uuid}.{ext}                  # Фото галереи профиля
  ├── posts/
  │   └── {post_id}/
  │       ├── {uuid}.{ext}                  # Фото/видео поста
  │       └── gallery/
  │           └── {uuid}.{ext}              # Галерея поста
  └── products/
      └── {product_id}/
          ├── {uuid}.{ext}                  # Главное фото товара
          └── gallery/
              └── {uuid}.{ext}              # Галерея товара
```

**Примеры:**
- `org-123e4567-e89b-12d3-a456-426614174000/profile/main/banner.jpg`
- `org-123e4567-e89b-12d3-a456-426614174000/posts/abc-123-def/image-1.jpg`
- `org-123e4567-e89b-12d3-a456-426614174000/products/xyz-789/gallery/photo-1.png`

---

### 2. `review-media` — UGC-контент (отзывы пользователей)

**Назначение:** Фото и видео, загружаемые пользователями в отзывах.

**Структура путей:**

```
org-{organization_id}/
  └── product-{product_id or 'org'}/
      └── review-{review_id}/
          └── {uuid}.{ext}                  # Фото/видео отзыва
```

**Примеры:**
- `org-123e4567-e89b-12d3-a456-426614174000/product-xyz-789/review-abc-123/photo-1.jpg`
- `org-123e4567-e89b-12d3-a456-426614174000/product-org/review-def-456/video-1.mp4`

**Примечание:** Если отзыв о производителе в целом (не о конкретном товаре), используйте `product-org` вместо `product-{product_id}`.

---

## Правила и ограничения

### Форматы файлов

**Изображения:**
- Рекомендуемые форматы: `JPEG`, `PNG`, `WebP`
- Максимальный размер: **10 МБ** на файл
- Рекомендуемое разрешение: до **2048x2048px** (для фото профиля/товаров)

**Видео:**
- Рекомендуемый формат: **MP4 (H.264 + AAC)**
- Максимальное разрешение: **1080p (1920x1080)**
- Максимальная длительность: **40 минут** (для видеопрезентаций)
- Максимальный размер: **2–3 ГБ** на файл
- Рекомендуемый bitrate: **5–10 Mbps** для 1080p

**Примечание:** Перед загрузкой видео желательно пережимать его для оптимизации размера и скорости загрузки.

---

### Ограничения количества

**Галерея профиля:**
- Максимум **50 элементов** в `organization_profiles.gallery`

**Галерея поста:**
- Максимум **20 элементов** в `organization_posts.gallery`

**Галерея товара:**
- Максимум **20 элементов** в `products.gallery`

**Медиа в отзыве:**
- Максимум **10 элементов** в `reviews.media` (комбинация фото и видео)

---

## Безопасность и приватность

### Текущая реализация (MVP)

**Статус:** Buckets настроены как **публичные** (public).

**Доступ:**
- Все файлы доступны по публичным URL
- Нет ограничений на чтение файлов по URL

**Риски:**
- Любой, кто знает URL, может получить доступ к файлу
- Нет контроля доступа на уровне файлов

---

### Рекомендации для будущего

**Переход на приватные buckets с подписанными URL:**

1. **Сделать buckets приватными:**
   ```sql
   -- В Supabase Dashboard или через API
   -- Установить bucket policy: private
   ```

2. **Генерировать подписанные URL:**
   - Использовать `supabase.storage.from('bucket').createSignedUrl(path, expiresIn)`
   - URL действительны ограниченное время (например, 1 час)
   - Автоматически обновлять URL при необходимости

3. **RLS на уровне Storage:**
   - Настроить Storage Policies в Supabase
   - Ограничить доступ по `organization_id` и ролям пользователей

4. **CDN и кэширование:**
   - Использовать Cloudflare или другой CDN для ускорения доставки
   - Кэшировать публичные медиа-файлы

---

## Интеграция в код

### Frontend: Загрузка файлов

**Пример использования Supabase Storage Client:**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Загрузка изображения профиля
async function uploadProfileImage(orgId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Math.random()}.${fileExt}`
  const filePath = `org-${orgId}/profile/main/${fileName}`

  const { data, error } = await supabase.storage
    .from('org-media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  // Получить публичный URL
  const { data: { publicUrl } } = supabase.storage
    .from('org-media')
    .getPublicUrl(filePath)

  return publicUrl
}
```

### Backend: Валидация и обработка

**Проверка размера файла:**
- Frontend: валидация перед загрузкой
- Backend: проверка URL в базе данных (опционально)

**Очистка старых файлов:**
- При удалении записи (профиль, пост, товар, отзыв) — удалять связанные файлы из Storage
- Реализовать cleanup job для orphaned files

---

## Миграция существующих данных

Если в базе уже есть `video_url` или `main_image_url` с внешними ссылками:

1. **Не трогать существующие URL** (они могут быть внешними)
2. **Новые загрузки** — только через Supabase Storage
3. **Постепенная миграция:** опциональная функция для переноса внешних медиа в Storage

---

## Мониторинг и лимиты

### Квоты Supabase

**Free Tier:**
- 1 GB Storage
- 2 GB Bandwidth

**Pro Tier:**
- 100 GB Storage
- 200 GB Bandwidth

**Рекомендации:**
- Мониторить использование Storage
- Предупреждать производителей при приближении к лимитам
- Рассмотреть интеграцию с внешним Storage (S3, Cloudflare R2) для масштабирования

---

## Примеры использования

### 1. Загрузка главного фото профиля

```typescript
// Frontend
const file = event.target.files[0]
const url = await uploadProfileImage(organizationId, file)

// Обновить профиль
await updateOrganizationProfile({
  main_image_url: url
})
```

### 2. Загрузка галереи поста

```typescript
// Frontend
const files = Array.from(event.target.files)
const urls = await Promise.all(
  files.map(file => uploadPostImage(organizationId, postId, file))
)

// Обновить пост
await updatePost(postId, {
  gallery: urls.map((url, idx) => ({
    url,
    alt: `Image ${idx + 1}`,
    sort_order: idx
  }))
})
```

### 3. Загрузка медиа в отзыв

```typescript
// Frontend
const files = Array.from(event.target.files)
const mediaItems = await Promise.all(
  files.map(async (file) => {
    const url = await uploadReviewMedia(organizationId, productId, reviewId, file)
    return {
      type: file.type.startsWith('video/') ? 'video' : 'image',
      url,
      alt: file.name
    }
  })
)

// Создать отзыв
await createReview({
  organization_id: organizationId,
  product_id: productId,
  rating: 5,
  body: 'Отличный товар!',
  media: mediaItems
})
```

---

## Чеклист для разработчика

- [ ] Создать buckets `org-media` и `review-media` в Supabase Dashboard
- [ ] Настроить bucket policies (public для MVP)
- [ ] Реализовать компонент `MediaUploader` на frontend
- [ ] Добавить валидацию размера и формата файлов
- [ ] Реализовать cleanup при удалении записей
- [ ] Добавить мониторинг использования Storage
- [ ] Документировать процесс миграции на приватные buckets (будущее)

---

## Контакты и поддержка

При возникновении вопросов по медиа-хранилищу обращайтесь к команде разработки или создавайте issue в репозитории.

