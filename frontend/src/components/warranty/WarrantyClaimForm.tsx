import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Upload, X, CheckCircle2, Camera } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { submitClaim } from '@/api/warrantyService'
import type { WarrantyClaimCreate, WarrantyClaimWithDetails, ClaimType } from '@/types/warranty'
import { CLAIM_TYPE_LABELS } from '@/types/warranty'

const claimFormSchema = z.object({
  claim_type: z.enum(['repair', 'replacement', 'refund', 'inspection', 'other'], {
    required_error: 'Выберите тип заявки',
  }),
  description: z
    .string()
    .min(10, 'Описание должно содержать минимум 10 символов')
    .max(2000, 'Описание не должно превышать 2000 символов'),
  photos: z.array(z.string().url()).optional().nullable(),
})

type ClaimFormData = z.infer<typeof claimFormSchema>

interface WarrantyClaimFormProps {
  registrationId: string
  productName?: string
  onSuccess?: (claim: WarrantyClaimWithDetails) => void
  onCancel?: () => void
}

export function WarrantyClaimForm({
  registrationId,
  productName,
  onSuccess,
  onCancel,
}: WarrantyClaimFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<WarrantyClaimWithDetails | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])

  const form = useForm<ClaimFormData>({
    resolver: zodResolver(claimFormSchema),
    defaultValues: {
      claim_type: undefined,
      description: '',
      photos: [],
    },
  })

  const onSubmit = async (data: ClaimFormData) => {
    setLoading(true)
    setError(null)

    try {
      const payload: WarrantyClaimCreate = {
        claim_type: data.claim_type,
        description: data.description,
        photos: photoUrls.length > 0 ? photoUrls : null,
      }

      const result = await submitClaim(registrationId, payload)
      setSuccess(result)
      onSuccess?.(result)
    } catch (err: any) {
      const message =
        err.response?.data?.detail ||
        err.message ||
        'Не удалось отправить заявку'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoAdd = (url: string) => {
    if (photoUrls.length < 5) {
      setPhotoUrls([...photoUrls, url])
    }
  }

  const handlePhotoRemove = (index: number) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== index))
  }

  // Success state
  if (success) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle>Заявка отправлена!</CardTitle>
          <CardDescription>
            Ваша гарантийная заявка #{success.id.slice(0, 8)} успешно подана
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Тип заявки:</span>
              <span className="font-medium">
                {CLAIM_TYPE_LABELS[success.claim_type]}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Статус:</span>
              <span className="font-medium text-blue-600">Подана</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Производитель рассмотрит вашу заявку и свяжется с вами в ближайшее время.
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => onSuccess?.(success)}>
            Готово
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Гарантийная заявка</CardTitle>
        <CardDescription>
          {productName
            ? `Заявка на гарантийное обслуживание: ${productName}`
            : 'Опишите проблему с товаром'}
        </CardDescription>
      </CardHeader>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Claim Type */}
          <div className="space-y-2">
            <Label htmlFor="claim_type">
              Тип заявки <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.watch('claim_type')}
              onValueChange={(value) => form.setValue('claim_type', value as ClaimType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите тип заявки" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLAIM_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.claim_type && (
              <p className="text-sm text-destructive">
                {form.formState.errors.claim_type.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Описание проблемы <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Опишите проблему подробно: что случилось, когда это произошло, при каких обстоятельствах..."
              rows={5}
              {...form.register('description')}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {form.formState.errors.description
                  ? form.formState.errors.description.message
                  : 'Минимум 10 символов'}
              </span>
              <span>{form.watch('description')?.length || 0} / 2000</span>
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label>Фото проблемы (до 5 шт.)</Label>
            <div className="grid grid-cols-5 gap-2">
              {photoUrls.map((url, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-lg border overflow-hidden bg-muted"
                >
                  <img
                    src={url}
                    alt={`Фото ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handlePhotoRemove(index)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photoUrls.length < 5 && (
                <button
                  type="button"
                  className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-1 hover:border-muted-foreground/50 transition-colors"
                  onClick={() => {
                    // In a real app, this would open a file picker or camera
                    const url = prompt('Введите URL фото:')
                    if (url) handlePhotoAdd(url)
                  }}
                >
                  <Camera className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Добавить</span>
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Добавьте фото дефекта или проблемы для ускорения рассмотрения заявки
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Отмена
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Отправка...' : 'Отправить заявку'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
