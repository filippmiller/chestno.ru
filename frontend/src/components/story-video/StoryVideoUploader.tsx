/**
 * StoryVideoUploader Component
 * 
 * Complete upload flow for producer story videos with:
 * - Drag & drop support
 * - Thumbnail selection from video frames
 * - Progress tracking
 * - Validation feedback
 */

import { useState, useRef, useCallback } from 'react'
import { Upload, Video, X, Check, AlertCircle, Image, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  validateStoryVideo,
  generateThumbnailOptions,
  formatDuration,
  formatFileSize,
  MAX_STORY_DURATION,
  type VideoMetadata,
  type ThumbnailResult,
} from '@/utils/videoUtils'
import {
  uploadStoryVideo,
  type UploadProgress,
  type StoryVideoUploadResult,
} from '@/utils/storyVideoUploader'

export interface StoryVideoUploaderProps {
  organizationId: string
  journeyStepId?: string
  productId?: string
  onUploadComplete: (result: StoryVideoUploadResult) => void
  onCancel?: () => void
  className?: string
}

type UploadStep = 'select' | 'preview' | 'details' | 'uploading' | 'complete' | 'error'

export function StoryVideoUploader({
  organizationId,
  journeyStepId,
  productId,
  onUploadComplete,
  onCancel,
  className,
}: StoryVideoUploaderProps) {
  // Step state
  const [step, setStep] = useState<UploadStep>('select')
  
  // File state
  const [file, setFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('')
  
  // Thumbnail state
  const [thumbnailOptions, setThumbnailOptions] = useState<ThumbnailResult[]>([])
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState(0)
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false)
  
  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  
  // Upload state
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<StoryVideoUploadResult | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // File selection handler
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null)
    setFile(selectedFile)
    
    // Validate
    const validation = await validateStoryVideo(selectedFile)
    if (!validation.valid) {
      setError(validation.error || 'Invalid video file')
      setFile(null)
      return
    }
    
    setMetadata(validation.metadata!)
    setVideoPreviewUrl(URL.createObjectURL(selectedFile))
    
    // Generate thumbnails
    setIsGeneratingThumbnails(true)
    try {
      const thumbnails = await generateThumbnailOptions(selectedFile, 4)
      setThumbnailOptions(thumbnails)
      setSelectedThumbnailIndex(0)
    } catch (err) {
      console.warn('Thumbnail generation failed:', err)
    }
    setIsGeneratingThumbnails(false)
    
    // Auto-generate title from filename
    const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
    setTitle(nameWithoutExt.replace(/[-_]/g, ' '))
    
    setStep('preview')
  }, [])

  // Drag & drop handlers
  const [isDragging, setIsDragging] = useState(false)
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      handleFileSelect(droppedFile)
    } else {
      setError('Please drop a video file')
    }
  }, [handleFileSelect])

  // Upload handler
  const handleUpload = useCallback(async () => {
    if (!file || !metadata) return
    
    setStep('uploading')
    setError(null)
    
    try {
      const uploadResult = await uploadStoryVideo(file, {
        organizationId,
        title: title.trim() || 'Untitled Video',
        description: description.trim() || undefined,
        journeyStepId,
        productId,
        thumbnailTime: thumbnailOptions[selectedThumbnailIndex] 
          ? (selectedThumbnailIndex + 1) * (metadata.duration / 5)
          : 1,
        onProgress: setUploadProgress,
      })
      
      setResult(uploadResult)
      setStep('complete')
      onUploadComplete(uploadResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setStep('error')
    }
  }, [
    file, metadata, organizationId, title, description,
    journeyStepId, productId, thumbnailOptions, selectedThumbnailIndex,
    onUploadComplete
  ])

  // Reset handler
  const handleReset = useCallback(() => {
    setStep('select')
    setFile(null)
    setMetadata(null)
    setVideoPreviewUrl('')
    setThumbnailOptions([])
    setSelectedThumbnailIndex(0)
    setTitle('')
    setDescription('')
    setUploadProgress(null)
    setError(null)
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Regenerate thumbnails
  const regenerateThumbnails = useCallback(async () => {
    if (!file) return
    
    setIsGeneratingThumbnails(true)
    try {
      const thumbnails = await generateThumbnailOptions(file, 4)
      setThumbnailOptions(thumbnails)
      setSelectedThumbnailIndex(0)
    } catch (err) {
      console.warn('Thumbnail regeneration failed:', err)
    }
    setIsGeneratingThumbnails(false)
  }, [file])

  return (
    <div className={cn('w-full max-w-2xl mx-auto', className)}>
      {/* Step: Select File */}
      {step === 'select' && (
        <div
          ref={dropZoneRef}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
              : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileSelect(f)
            }}
          />
          
          <Video className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
          
          <h3 className="text-lg font-medium mb-2">
            Загрузите видео истории
          </h3>
          
          <p className="text-sm text-neutral-500 mb-4">
            Перетащите файл сюда или нажмите для выбора
          </p>
          
          <div className="text-xs text-neutral-400 space-y-1">
            <p>Форматы: MP4, WebM, MOV</p>
            <p>Макс. размер: 100 МБ</p>
            <p>Рекомендуемая длительность: до {MAX_STORY_DURATION} секунд</p>
          </div>
          
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Step: Preview & Thumbnail Selection */}
      {step === 'preview' && metadata && (
        <div className="space-y-6">
          {/* Video Preview */}
          <div className="aspect-video rounded-lg overflow-hidden bg-black">
            <video
              src={videoPreviewUrl}
              controls
              className="w-full h-full object-contain"
            />
          </div>
          
          {/* Video Info */}
          <div className="flex items-center justify-between text-sm text-neutral-500">
            <span>{formatDuration(metadata.duration)}</span>
            <span>{metadata.width}x{metadata.height}</span>
            <span>{formatFileSize(metadata.fileSize)}</span>
          </div>
          
          {/* Duration Warning */}
          {metadata.duration > MAX_STORY_DURATION && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Видео длиннее рекомендуемых {MAX_STORY_DURATION} секунд. 
                Короткие видео (30-60 сек) получают больше просмотров.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Thumbnail Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Выберите превью</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={regenerateThumbnails}
                disabled={isGeneratingThumbnails}
              >
                <RefreshCw className={cn('w-4 h-4 mr-1', isGeneratingThumbnails && 'animate-spin')} />
                Обновить
              </Button>
            </div>
            
            {isGeneratingThumbnails ? (
              <div className="flex items-center justify-center h-24 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                <RefreshCw className="w-6 h-6 animate-spin text-neutral-400" />
              </div>
            ) : thumbnailOptions.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {thumbnailOptions.map((thumb, index) => (
                  <button
                    key={index}
                    className={cn(
                      'aspect-video rounded-lg overflow-hidden border-2 transition-all',
                      selectedThumbnailIndex === index
                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                        : 'border-transparent hover:border-neutral-300'
                    )}
                    onClick={() => setSelectedThumbnailIndex(index)}
                  >
                    <img
                      src={thumb.dataUrl}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                <Image className="w-6 h-6 text-neutral-400" />
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset}>
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button className="flex-1" onClick={() => setStep('details')}>
              Далее
            </Button>
          </div>
        </div>
      )}

      {/* Step: Details */}
      {step === 'details' && (
        <div className="space-y-6">
          {/* Selected Thumbnail Preview */}
          {thumbnailOptions[selectedThumbnailIndex] && (
            <div className="aspect-video rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
              <img
                src={thumbnailOptions[selectedThumbnailIndex].dataUrl}
                alt="Selected thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Название <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Как мы делаем наш продукт"
              maxLength={200}
            />
            <p className="text-xs text-neutral-400 mt-1">
              {title.length}/200 символов
            </p>
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Описание
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Расскажите подробнее о том, что показано в видео..."
              rows={3}
              maxLength={2000}
            />
            <p className="text-xs text-neutral-400 mt-1">
              {description.length}/2000 символов
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('preview')}>
              Назад
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleUpload}
              disabled={!title.trim()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Загрузить видео
            </Button>
          </div>
        </div>
      )}

      {/* Step: Uploading */}
      {step === 'uploading' && uploadProgress && (
        <div className="space-y-6 text-center py-8">
          <Video className="w-16 h-16 mx-auto text-blue-500 animate-pulse" />
          
          <div>
            <h3 className="text-lg font-medium mb-2">
              {uploadProgress.message}
            </h3>
            <Progress value={uploadProgress.progress} className="h-2" />
            <p className="text-sm text-neutral-500 mt-2">
              {uploadProgress.progress}%
            </p>
          </div>
        </div>
      )}

      {/* Step: Complete */}
      {step === 'complete' && result && (
        <div className="space-y-6 text-center py-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">
              Видео успешно загружено!
            </h3>
            <p className="text-sm text-neutral-500">
              Теперь вы можете добавить его в историю продукта
            </p>
          </div>
          
          {/* Preview of uploaded video */}
          {result.thumbnailUrl && (
            <div className="aspect-video max-w-sm mx-auto rounded-lg overflow-hidden">
              <img
                src={result.thumbnailUrl}
                alt="Uploaded video"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleReset}>
              Загрузить ещё
            </Button>
            <Button onClick={onCancel}>
              Готово
            </Button>
          </div>
        </div>
      )}

      {/* Step: Error */}
      {step === 'error' && (
        <div className="space-y-6 text-center py-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">
              Ошибка загрузки
            </h3>
            <p className="text-sm text-red-500">
              {error}
            </p>
          </div>
          
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleReset}>
              Попробовать снова
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Отмена
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default StoryVideoUploader
