import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import type { AuthorizedRegion, AuthorizedRegionCreate } from '@/types/geoAnomaly'

// Predefined Russian regions
const RUSSIAN_REGIONS = [
  { code: 'RU-MOW', name: 'Москва', lat: 55.7558, lng: 37.6173 },
  { code: 'RU-SPE', name: 'Санкт-Петербург', lat: 59.9343, lng: 30.3351 },
  { code: 'RU-MOS', name: 'Московская область', lat: 55.8154, lng: 37.3645 },
  { code: 'RU-LEN', name: 'Ленинградская область', lat: 60.1892, lng: 32.3566 },
  { code: 'RU-KDA', name: 'Краснодарский край', lat: 45.0448, lng: 38.9760 },
  { code: 'RU-NIZ', name: 'Нижегородская область', lat: 56.3269, lng: 44.0059 },
  { code: 'RU-SVE', name: 'Свердловская область', lat: 56.8389, lng: 60.6057 },
  { code: 'RU-TAT', name: 'Республика Татарстан', lat: 55.7898, lng: 49.1221 },
  { code: 'RU-SAM', name: 'Самарская область', lat: 53.1959, lng: 50.1002 },
  { code: 'RU-ROS', name: 'Ростовская область', lat: 47.2357, lng: 39.7015 },
  { code: 'RU-CHE', name: 'Челябинская область', lat: 55.1644, lng: 61.4368 },
  { code: 'RU-BA', name: 'Республика Башкортостан', lat: 54.7388, lng: 55.9721 },
  { code: 'RU-PER', name: 'Пермский край', lat: 58.0105, lng: 56.2502 },
  { code: 'RU-VOR', name: 'Воронежская область', lat: 51.6720, lng: 39.1843 },
  { code: 'RU-VGG', name: 'Волгоградская область', lat: 48.7080, lng: 44.5133 },
  { code: 'RU-KR', name: 'Крым', lat: 44.9521, lng: 34.1024 },
  { code: 'RU-NSK', name: 'Новосибирская область', lat: 55.0084, lng: 82.9357 },
  { code: 'RU-OMS', name: 'Омская область', lat: 54.9893, lng: 73.3682 },
  { code: 'RU-TYU', name: 'Тюменская область', lat: 57.1522, lng: 65.5272 },
  { code: 'RU-IRK', name: 'Иркутская область', lat: 52.2870, lng: 104.2890 },
  { code: 'RU-KEM', name: 'Кемеровская область', lat: 55.3548, lng: 86.0884 },
  { code: 'RU-KYA', name: 'Красноярский край', lat: 56.0097, lng: 92.8523 },
  { code: 'RU-PRI', name: 'Приморский край', lat: 43.1056, lng: 131.8735 },
  { code: 'RU-KHA', name: 'Хабаровский край', lat: 48.4827, lng: 135.0839 },
]

const regionSchema = z.object({
  region_code: z.string().min(1, 'Выберите регион'),
  is_exclusive: z.boolean().default(false),
  radius_km: z.number().min(1).max(5000).default(100),
  notes: z.string().optional(),
})

type RegionFormValues = z.infer<typeof regionSchema>

interface RegionEditorProps {
  open: boolean
  onClose: () => void
  onSave: (data: AuthorizedRegionCreate) => Promise<void>
  existingRegion?: AuthorizedRegion
  existingRegionCodes?: string[]
}

export function RegionEditor({
  open,
  onClose,
  onSave,
  existingRegion,
  existingRegionCodes = []
}: RegionEditorProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<RegionFormValues>({
    resolver: zodResolver(regionSchema),
    defaultValues: {
      region_code: existingRegion?.region_code || '',
      is_exclusive: existingRegion?.is_exclusive || false,
      radius_km: existingRegion?.radius_km || 100,
      notes: existingRegion?.notes || '',
    }
  })

  // Filter out already added regions (unless editing)
  const availableRegions = RUSSIAN_REGIONS.filter(
    r => !existingRegionCodes.includes(r.code) || r.code === existingRegion?.region_code
  )

  const handleSubmit = async (values: RegionFormValues) => {
    const selectedRegion = RUSSIAN_REGIONS.find(r => r.code === values.region_code)
    if (!selectedRegion) return

    setLoading(true)
    setError(null)

    try {
      await onSave({
        region_code: values.region_code,
        region_name: selectedRegion.name,
        is_exclusive: values.is_exclusive,
        center_lat: selectedRegion.lat,
        center_lng: selectedRegion.lng,
        radius_km: values.radius_km,
        notes: values.notes || undefined,
      })
      form.reset()
      onClose()
    } catch (err) {
      console.error('Failed to save region:', err)
      setError('Не удалось сохранить регион')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existingRegion ? 'Редактировать регион' : 'Добавить авторизованный регион'}
          </DialogTitle>
          <DialogDescription>
            Укажите регион, в котором разрешена продажа вашей продукции.
            Сканирования за пределами этих регионов будут помечены как аномалии.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="region_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Регион</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!!existingRegion}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите регион" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableRegions.map((region) => (
                        <SelectItem key={region.code} value={region.code}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="radius_km"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Радиус покрытия (км)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={5000}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 100)}
                    />
                  </FormControl>
                  <FormDescription>
                    Сканирования в пределах этого радиуса от центра региона считаются авторизованными
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_exclusive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Эксклюзивный регион</FormLabel>
                    <FormDescription>
                      Если включено, продукция должна продаваться ТОЛЬКО в этом регионе
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Заметки (необязательно)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Внутренние заметки о регионе..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Сохранение...' : existingRegion ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

interface RegionListProps {
  regions: AuthorizedRegion[]
  onEdit: (region: AuthorizedRegion) => void
  onDelete: (regionId: string) => void
  loading?: boolean
}

export function RegionList({ regions, onEdit, onDelete, loading }: RegionListProps) {
  if (loading) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Загрузка регионов...
      </div>
    )
  }

  if (regions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Авторизованные регионы не настроены.
            Добавьте регионы, чтобы отслеживать аномальные сканирования.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {regions.map((region) => (
        <Card key={region.id}>
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  region.is_exclusive ? 'bg-red-500' : 'bg-green-500'
                }`}
              />
              <div>
                <div className="font-medium">{region.region_name}</div>
                <div className="text-xs text-muted-foreground">
                  {region.region_code} | Радиус: {region.radius_km || 100} км
                  {region.is_exclusive && (
                    <span className="ml-2 text-red-600">Эксклюзивный</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(region)}
              >
                Изменить
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(region.id)}
              >
                Удалить
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
