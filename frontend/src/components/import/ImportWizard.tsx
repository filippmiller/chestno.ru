import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Upload, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  uploadImportFile,
  getFieldMappingInfo,
  saveFieldMapping,
  validateImport,
  getImportPreview,
  executeImport,
  cancelImport,
  getImportJob,
} from '@/api/importService'
import { ImportSourceSelector } from './ImportSourceSelector'
import { ImportFieldMapper } from './ImportFieldMapper'
import { ImportPreviewTable } from './ImportPreviewTable'
import { ImportProgressTracker } from './ImportProgressTracker'
import type {
  ImportSourceType,
  ImportJob,
  FieldMappingInfo,
  ImportPreviewResponse,
  ImportWizardStep,
  ImportJobSettings,
} from '@/types/import'
import { IMPORT_SOURCES } from '@/types/import'

interface ImportWizardProps {
  organizationId: string
  onComplete?: () => void
}

const STEPS: ImportWizardStep[] = ['source', 'upload', 'mapping', 'preview', 'processing', 'result']

export function ImportWizard({ organizationId, onComplete }: ImportWizardProps) {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<ImportWizardStep>('source')
  const [selectedSource, setSelectedSource] = useState<ImportSourceType | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [job, setJob] = useState<ImportJob | null>(null)
  const [mappingInfo, setMappingInfo] = useState<FieldMappingInfo | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<ImportJobSettings>({
    skip_duplicates: true,
    update_existing: false,
    download_images: true,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollIntervalRef = useRef<number | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const getStepIndex = (step: ImportWizardStep) => STEPS.indexOf(step)
  const stepProgress = ((getStepIndex(currentStep) + 1) / STEPS.length) * 100

  const handleSourceSelect = (source: ImportSourceType) => {
    setSelectedSource(source)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedSource || !selectedFile) return

    setLoading(true)
    setError(null)

    try {
      const importJob = await uploadImportFile(organizationId, selectedFile, selectedSource)
      setJob(importJob)

      // Load mapping info
      const mapping = await getFieldMappingInfo(organizationId, importJob.id)
      setMappingInfo(mapping)

      setCurrentStep('mapping')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка при загрузке файла')
    } finally {
      setLoading(false)
    }
  }

  const handleMappingSave = async (mapping: Record<string, string>) => {
    if (!job) return

    setLoading(true)
    setError(null)

    try {
      await saveFieldMapping(organizationId, job.id, mapping)
      const validatedJob = await validateImport(organizationId, job.id)
      setJob(validatedJob)

      // Load preview
      const previewData = await getImportPreview(organizationId, job.id)
      setPreview(previewData)

      setCurrentStep('preview')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка при сохранении сопоставления')
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async () => {
    if (!job) return

    setLoading(true)
    setError(null)

    try {
      await executeImport(organizationId, job.id, settings)
      setCurrentStep('processing')

      // Start polling for progress
      pollIntervalRef.current = window.setInterval(async () => {
        const updatedJob = await getImportJob(organizationId, job.id)
        setJob(updatedJob)

        if (['completed', 'failed', 'cancelled'].includes(updatedJob.status)) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
          setCurrentStep('result')
        }
      }, 2000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка при запуске импорта')
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!job) return

    try {
      await cancelImport(organizationId, job.id)
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      navigate('/dashboard/organization/products')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка при отмене импорта')
    }
  }

  const handleBack = () => {
    const currentIndex = getStepIndex(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1])
    }
  }

  const handleFinish = () => {
    onComplete?.()
    navigate('/dashboard/organization/products')
  }

  const canGoNext = () => {
    switch (currentStep) {
      case 'source':
        return selectedSource !== null
      case 'upload':
        return selectedFile !== null
      default:
        return false
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'source':
        return (
          <ImportSourceSelector selectedSource={selectedSource} onSelect={handleSourceSelect} />
        )

      case 'upload':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Загрузите файл</h2>
              <p className="text-sm text-muted-foreground">
                {selectedSource && IMPORT_SOURCES.find((s) => s.type === selectedSource)?.description}
              </p>
            </div>

            <Card
              className="cursor-pointer border-2 border-dashed transition-colors hover:border-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-center font-medium">
                  {selectedFile ? selectedFile.name : 'Нажмите или перетащите файл'}
                </p>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  {selectedSource &&
                    `Форматы: ${IMPORT_SOURCES.find((s) => s.type === selectedSource)?.acceptedFormats.join(', ')}`}
                </p>
                {selectedFile && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Размер: {(selectedFile.size / 1024).toFixed(1)} КБ
                  </p>
                )}
              </CardContent>
            </Card>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={
                selectedSource
                  ? IMPORT_SOURCES.find((s) => s.type === selectedSource)?.acceptedFormats.join(',')
                  : undefined
              }
              onChange={handleFileSelect}
            />
          </div>
        )

      case 'mapping':
        return mappingInfo ? (
          <ImportFieldMapper mappingInfo={mappingInfo} onSave={handleMappingSave} loading={loading} />
        ) : null

      case 'preview':
        return preview ? (
          <div className="space-y-6">
            <ImportPreviewTable preview={preview} />

            {/* Import settings */}
            <Card>
              <CardContent className="space-y-4 py-4">
                <h3 className="font-semibold">Настройки импорта</h3>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="skip_duplicates"
                    checked={settings.skip_duplicates}
                    onCheckedChange={(checked) =>
                      setSettings((s) => ({ ...s, skip_duplicates: !!checked }))
                    }
                  />
                  <Label htmlFor="skip_duplicates">Пропускать дубликаты (по slug)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="update_existing"
                    checked={settings.update_existing}
                    onCheckedChange={(checked) =>
                      setSettings((s) => ({ ...s, update_existing: !!checked }))
                    }
                  />
                  <Label htmlFor="update_existing">Обновлять существующие товары</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="download_images"
                    checked={settings.download_images}
                    onCheckedChange={(checked) =>
                      setSettings((s) => ({ ...s, download_images: !!checked }))
                    }
                  />
                  <Label htmlFor="download_images">Загружать изображения по ссылкам</Label>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null

      case 'processing':
      case 'result':
        return job ? <ImportProgressTracker job={job} /> : null

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Шаг {getStepIndex(currentStep) + 1} из {STEPS.length}</span>
          <span>{Math.round(stepProgress)}%</span>
        </div>
        <Progress value={stepProgress} />
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step content */}
      {renderStep()}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <div>
          {currentStep !== 'source' && currentStep !== 'processing' && currentStep !== 'result' && (
            <Button variant="outline" onClick={handleBack} disabled={loading}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {currentStep === 'processing' && (
            <Button variant="destructive" onClick={handleCancel}>
              <X className="mr-2 h-4 w-4" />
              Отменить
            </Button>
          )}

          {currentStep === 'source' && (
            <Button onClick={() => setCurrentStep('upload')} disabled={!canGoNext()}>
              Далее
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {currentStep === 'upload' && (
            <Button onClick={handleUpload} disabled={!canGoNext() || loading}>
              {loading ? 'Загрузка...' : 'Загрузить и продолжить'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {currentStep === 'preview' && (
            <Button onClick={handleExecute} disabled={loading}>
              {loading ? 'Запуск...' : 'Начать импорт'}
            </Button>
          )}

          {currentStep === 'result' && (
            <Button onClick={handleFinish}>Готово</Button>
          )}
        </div>
      </div>
    </div>
  )
}
