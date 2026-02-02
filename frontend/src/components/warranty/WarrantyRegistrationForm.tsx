import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarIcon, Loader2, Upload, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { registerWarranty } from '@/api/warrantyService'
import type { WarrantyRegistrationCreate, WarrantyRegistrationWithProduct } from '@/types/warranty'

const warrantyFormSchema = z.object({
  product_id: z.string().uuid('Некорректный ID продукта'),
  qr_code_id: z.string().uuid().optional().nullable(),
  serial_number: z.string().max(100).optional().nullable(),
  purchase_date: z.date({
    required_error: 'Укажите дату покупки',
  }),
  purchase_location: z.string().max(200).optional().nullable(),
  purchase_proof_url: z.string().url().optional().nullable(),
  contact_email: z.string().email('Некорректный email').optional().nullable(),
  contact_phone: z.string().max(20).optional().nullable(),
})

type WarrantyFormData = z.infer<typeof warrantyFormSchema>

interface WarrantyRegistrationFormProps {
  productId: string
  productName?: string
  qrCodeId?: string
  onSuccess?: (registration: WarrantyRegistrationWithProduct) => void
  onCancel?: () => void
}

export function WarrantyRegistrationForm({
  productId,
  productName,
  qrCodeId,
  onSuccess,
  onCancel,
}: WarrantyRegistrationFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<WarrantyRegistrationWithProduct | null>(null)

  const form = useForm<WarrantyFormData>({
    resolver: zodResolver(warrantyFormSchema),
    defaultValues: {
      product_id: productId,
      qr_code_id: qrCodeId || null,
      serial_number: null,
      purchase_date: new Date(),
      purchase_location: null,
      purchase_proof_url: null,
      contact_email: null,
      contact_phone: null,
    },
  })

  const onSubmit = async (data: WarrantyFormData) => {
    setLoading(true)
    setError(null)

    try {
      const payload: WarrantyRegistrationCreate = {
        product_id: data.product_id,
        qr_code_id: data.qr_code_id,
        serial_number: data.serial_number,
        purchase_date: format(data.purchase_date, 'yyyy-MM-dd'),
        purchase_location: data.purchase_location,
        purchase_proof_url: data.purchase_proof_url,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone,
      }

      const result = await registerWarranty(payload)
      setSuccess(result)
      onSuccess?.(result)
    } catch (err: any) {
      const message =
        err.response?.data?.detail ||
        err.message ||
        'Не удалось зарегистрировать гарантию'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  // Success state
  if (success) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle>Гарантия зарегистрирована!</CardTitle>
          <CardDescription>
            Ваша гарантия на {success.product_name} успешно зарегистрирована
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Начало гарантии:</span>
              <span className="font-medium">
                {format(new Date(success.warranty_start), 'dd MMMM yyyy', { locale: ru })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Окончание гарантии:</span>
              <span className="font-medium">
                {format(new Date(success.warranty_end), 'dd MMMM yyyy', { locale: ru })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Осталось дней:</span>
              <span className="font-medium text-green-600">{success.days_remaining}</span>
            </div>
          </div>
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
        <CardTitle>Регистрация гарантии</CardTitle>
        <CardDescription>
          {productName
            ? `Регистрация гарантии на: ${productName}`
            : 'Заполните данные для активации гарантии'}
        </CardDescription>
      </CardHeader>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Purchase Date */}
          <div className="space-y-2">
            <Label htmlFor="purchase_date">
              Дата покупки <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal ${
                    !form.watch('purchase_date') && 'text-muted-foreground'
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.watch('purchase_date') ? (
                    format(form.watch('purchase_date'), 'dd MMMM yyyy', { locale: ru })
                  ) : (
                    <span>Выберите дату</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.watch('purchase_date')}
                  onSelect={(date) => form.setValue('purchase_date', date!)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {form.formState.errors.purchase_date && (
              <p className="text-sm text-destructive">
                {form.formState.errors.purchase_date.message}
              </p>
            )}
          </div>

          {/* Serial Number */}
          <div className="space-y-2">
            <Label htmlFor="serial_number">Серийный номер</Label>
            <Input
              id="serial_number"
              placeholder="Введите серийный номер (если есть)"
              {...form.register('serial_number')}
            />
            <p className="text-xs text-muted-foreground">
              Обычно указан на упаковке или самом товаре
            </p>
          </div>

          {/* Purchase Location */}
          <div className="space-y-2">
            <Label htmlFor="purchase_location">Место покупки</Label>
            <Input
              id="purchase_location"
              placeholder="Название магазина или адрес"
              {...form.register('purchase_location')}
            />
          </div>

          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="contact_email">Email для связи</Label>
            <Input
              id="contact_email"
              type="email"
              placeholder="email@example.com"
              {...form.register('contact_email')}
            />
            {form.formState.errors.contact_email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.contact_email.message}
              </p>
            )}
          </div>

          {/* Contact Phone */}
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Телефон для связи</Label>
            <Input
              id="contact_phone"
              type="tel"
              placeholder="+7 (999) 123-45-67"
              {...form.register('contact_phone')}
            />
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
            {loading ? 'Регистрация...' : 'Зарегистрировать гарантию'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
