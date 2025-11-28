import { useState } from 'react'
import { X, Image as ImageIcon, Video } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  uploadProfileImage,
  uploadProfileGalleryImage,
  uploadProfileVideo,
  uploadPostImage,
  uploadReviewMedia,
  validateImageFile,
  validateVideoFile,
} from '@/utils/mediaUploader'

interface MediaUploaderProps {
  type: 'profile-image' | 'profile-gallery' | 'profile-video' | 'post-image' | 'review-media'
  organizationId: string
  postId?: string
  productId?: string | null
  reviewId?: string
  onUploadComplete: (url: string) => void
  onError?: (error: string) => void
  maxFiles?: number
  accept?: string
  label?: string
}

export function MediaUploader({
  type,
  organizationId,
  postId,
  productId,
  reviewId,
  onUploadComplete,
  onError,
  maxFiles = 1,
  accept,
  label,
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (uploadedFiles.length + files.length > maxFiles) {
      const err = `Можно загрузить максимум ${maxFiles} файл(ов)`
      setError(err)
      onError?.(err)
      return
    }

    setError(null)
    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        // Валидация
        let validation
        if (type === 'profile-video' || type === 'review-media') {
          validation = validateVideoFile(file)
        } else {
          validation = validateImageFile(file)
        }

        if (!validation.valid) {
          throw new Error(validation.error)
        }

        // Загрузка
        let url: string
        switch (type) {
          case 'profile-image':
            url = await uploadProfileImage(organizationId, file)
            break
          case 'profile-gallery':
            url = await uploadProfileGalleryImage(organizationId, file)
            break
          case 'profile-video':
            url = await uploadProfileVideo(organizationId, file)
            break
          case 'post-image':
            if (!postId) throw new Error('postId required for post-image')
            url = await uploadPostImage(organizationId, postId, file)
            break
          case 'review-media':
            if (!reviewId) throw new Error('reviewId required for review-media')
            url = await uploadReviewMedia(organizationId, productId || null, reviewId, file)
            break
          default:
            throw new Error('Unknown upload type')
        }

        setUploadedFiles((prev) => [...prev, url])
        onUploadComplete(url)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки файла'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setUploading(false)
      // Сброс input
      event.target.value = ''
    }
  }

  const removeFile = (url: string) => {
    setUploadedFiles((prev) => prev.filter((u) => u !== url))
  }

  const getDefaultAccept = () => {
    if (type === 'profile-video' || type === 'review-media') {
      return 'video/mp4,video/webm'
    }
    return 'image/jpeg,image/png,image/webp'
  }

  const getDefaultLabel = () => {
    if (type === 'profile-image') return 'Загрузить главное фото'
    if (type === 'profile-gallery') return 'Загрузить фото в галерею'
    if (type === 'profile-video') return 'Загрузить видео'
    if (type === 'post-image') return 'Загрузить изображение поста'
    if (type === 'review-media') return 'Загрузить фото/видео'
    return 'Загрузить файл'
  }

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" disabled={uploading} asChild>
          <label className="cursor-pointer">
            {uploading ? (
              'Загрузка...'
            ) : (
              <>
                {type === 'profile-video' || type === 'review-media' ? (
                  <Video className="mr-2 h-4 w-4" />
                ) : (
                  <ImageIcon className="mr-2 h-4 w-4" />
                )}
                {getDefaultLabel()}
              </>
            )}
            <input
              type="file"
              className="hidden"
              accept={accept || getDefaultAccept()}
              multiple={maxFiles > 1}
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
        </Button>
        {uploadedFiles.length > 0 && (
          <span className="text-sm text-muted-foreground">
            Загружено: {uploadedFiles.length}/{maxFiles}
          </span>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {uploadedFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {uploadedFiles.map((url) => (
            <div key={url} className="relative group">
              {type === 'profile-video' || type === 'review-media' ? (
                <video src={url} className="w-full h-24 object-cover rounded" controls={false} />
              ) : (
                <img src={url} alt="Uploaded" className="w-full h-24 object-cover rounded" />
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeFile(url)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

