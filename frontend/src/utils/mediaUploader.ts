import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface UploadOptions {
  bucket: 'org-media' | 'review-media'
  path: string
  file: File
  cacheControl?: string
}

export interface UploadResult {
  url: string
  path: string
}

/**
 * Загружает файл в Supabase Storage
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  const { bucket, path, file, cacheControl = '3600' } = options

  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl,
    upsert: false,
  })

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`)
  }

  // Получить публичный URL
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)

  return {
    url: publicUrl,
    path: data.path,
  }
}

/**
 * Загружает изображение профиля организации
 */
export async function uploadProfileImage(organizationId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const path = `org-${organizationId}/profile/main/${fileName}`

  const result = await uploadFile({
    bucket: 'org-media',
    path,
    file,
  })

  return result.url
}

/**
 * Загружает изображение в галерею профиля
 */
export async function uploadProfileGalleryImage(organizationId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const path = `org-${organizationId}/profile/gallery/${fileName}`

  const result = await uploadFile({
    bucket: 'org-media',
    path,
    file,
  })

  return result.url
}

/**
 * Загружает видео профиля
 */
export async function uploadProfileVideo(organizationId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const path = `org-${organizationId}/profile/video/${fileName}`

  const result = await uploadFile({
    bucket: 'org-media',
    path,
    file,
    cacheControl: '86400', // 24 часа для видео
  })

  return result.url
}

/**
 * Загружает изображение поста
 */
export async function uploadPostImage(organizationId: string, postId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const path = `org-${organizationId}/posts/${postId}/${fileName}`

  const result = await uploadFile({
    bucket: 'org-media',
    path,
    file,
  })

  return result.url
}

/**
 * Загружает медиа для отзыва
 */
export async function uploadReviewMedia(
  organizationId: string,
  productId: string | null,
  reviewId: string,
  file: File,
): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const productPath = productId ? `product-${productId}` : 'product-org'
  const path = `org-${organizationId}/${productPath}/review-${reviewId}/${fileName}`

  const result = await uploadFile({
    bucket: 'review-media',
    path,
    file,
  })

  return result.url
}

/**
 * Валидация файла изображения
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024 // 10 MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Разрешены только JPEG, PNG и WebP' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'Максимальный размер файла: 10 МБ' }
  }

  return { valid: true }
}

/**
 * Валидация файла видео
 */
export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 3 * 1024 * 1024 * 1024 // 3 GB
  const allowedTypes = ['video/mp4', 'video/webm']

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Разрешены только MP4 и WebM' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'Максимальный размер файла: 3 ГБ' }
  }

  return { valid: true }
}

