# Настройка Supabase Storage Buckets

## Автоматическое создание (через скрипт)

Если у вас настроены переменные окружения `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`:

```powershell
.\scripts\create-storage-buckets.ps1
```

## Ручное создание через Supabase Dashboard

1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект
3. Перейдите в раздел **Storage** (в боковом меню)
4. Нажмите **"New bucket"** или **"Create bucket"**

### Bucket 1: `org-media`

**Настройки:**
- **Name:** `org-media`
- **Public bucket:** ✅ Включено (для MVP)
- **File size limit:** 3 GB (3145728000 байт)
- **Allowed MIME types:** 
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `video/mp4`
  - `video/webm`

**Назначение:** Медиа контент, загружаемый производителями (фото профиля, галереи, видео, фото товаров и постов).

### Bucket 2: `review-media`

**Настройки:**
- **Name:** `review-media`
- **Public bucket:** ✅ Включено (для MVP)
- **File size limit:** 3 GB (3145728000 байт)
- **Allowed MIME types:**
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `video/mp4`
  - `video/webm`

**Назначение:** UGC-контент (фото и видео в отзывах пользователей).

## Проверка

После создания bucket'ов проверьте:

1. В Supabase Dashboard → Storage должны быть видны оба bucket'а
2. Оба bucket'а должны быть публичными (Public bucket = ON)
3. Попробуйте загрузить тестовый файл через MediaUploader компонент

## Безопасность (для будущего)

**Текущая реализация (MVP):** Bucket'ы публичные.

**Рекомендации для production:**
- Перевести bucket'ы в приватные
- Использовать подписанные URL (signed URLs) для доступа
- Настроить Storage Policies для контроля доступа

Подробнее см. `docs/media-storage.md`.

