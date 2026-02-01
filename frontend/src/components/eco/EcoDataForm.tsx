import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import {
  Truck,
  Package,
  Factory,
  Leaf,
  MapPin,
  Info,
  Save,
  RefreshCw,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type {
  ProductEcoData,
  ProductEcoDataInput,
  TransportModeScoring,
  PackagingMaterialScoring,
  ProductionEnergyScoring,
} from '@/types/eco'
import { RUSSIAN_REGIONS } from '@/types/eco'
import {
  getTransportModes,
  getPackagingMaterials,
  getEnergySources,
  upsertProductEcoData,
  recalculateEcoScore,
} from '@/api/eco'

const ecoDataSchema = z.object({
  // Transport
  production_location_name: z.string().optional(),
  production_region: z.string().optional(),
  transport_distance_km: z.coerce.number().min(0).max(50000).optional(),
  transport_mode: z.string().optional(),
  uses_local_ingredients: z.boolean().default(false),
  local_ingredients_percentage: z.coerce.number().min(0).max(100).optional(),

  // Packaging
  packaging_material: z.string().optional(),
  packaging_is_recyclable: z.boolean().default(false),
  packaging_is_biodegradable: z.boolean().default(false),
  packaging_is_reusable: z.boolean().default(false),
  packaging_notes: z.string().optional(),

  // Production
  primary_energy_source: z.string().optional(),
  secondary_energy_source: z.string().optional(),
  renewable_energy_percentage: z.coerce.number().min(0).max(100).optional(),
  has_waste_recycling: z.boolean().default(false),
  waste_recycling_percentage: z.coerce.number().min(0).max(100).optional(),
  water_recycling_percentage: z.coerce.number().min(0).max(100).optional(),
  uses_organic_materials: z.boolean().default(false),

  // Optional
  carbon_footprint_kg: z.coerce.number().min(0).optional(),
  water_usage_liters: z.coerce.number().min(0).optional(),
  production_notes: z.string().optional(),
})

type EcoDataFormValues = z.infer<typeof ecoDataSchema>

interface EcoDataFormProps {
  productId: string
  existingData?: ProductEcoData | null
  onSuccess?: (data: ProductEcoData) => void
  onCancel?: () => void
  className?: string
}

export function EcoDataForm({
  productId,
  existingData,
  onSuccess,
  onCancel,
  className,
}: EcoDataFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [transportModes, setTransportModes] = useState<TransportModeScoring[]>([])
  const [packagingMaterials, setPackagingMaterials] = useState<PackagingMaterialScoring[]>([])
  const [energySources, setEnergySources] = useState<ProductionEnergyScoring[]>([])
  const [activeSection, setActiveSection] = useState<string>('transport')

  const form = useForm<EcoDataFormValues>({
    resolver: zodResolver(ecoDataSchema),
    defaultValues: {
      production_location_name: existingData?.production_location_name || '',
      production_region: existingData?.production_region || '',
      transport_distance_km: existingData?.transport_distance_km || undefined,
      transport_mode: existingData?.transport_mode || '',
      uses_local_ingredients: existingData?.uses_local_ingredients || false,
      local_ingredients_percentage: existingData?.local_ingredients_percentage || undefined,

      packaging_material: existingData?.packaging_material || '',
      packaging_is_recyclable: existingData?.packaging_is_recyclable || false,
      packaging_is_biodegradable: existingData?.packaging_is_biodegradable || false,
      packaging_is_reusable: existingData?.packaging_is_reusable || false,
      packaging_notes: existingData?.packaging_notes || '',

      primary_energy_source: existingData?.primary_energy_source || '',
      secondary_energy_source: existingData?.secondary_energy_source || '',
      renewable_energy_percentage: existingData?.renewable_energy_percentage || undefined,
      has_waste_recycling: existingData?.has_waste_recycling || false,
      waste_recycling_percentage: existingData?.waste_recycling_percentage || undefined,
      water_recycling_percentage: existingData?.water_recycling_percentage || undefined,
      uses_organic_materials: existingData?.uses_organic_materials || false,

      carbon_footprint_kg: existingData?.carbon_footprint_kg || undefined,
      water_usage_liters: existingData?.water_usage_liters || undefined,
      production_notes: existingData?.production_notes || '',
    },
  })

  // Load reference data
  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [modes, materials, sources] = await Promise.all([
          getTransportModes(),
          getPackagingMaterials(),
          getEnergySources(),
        ])
        setTransportModes(modes)
        setPackagingMaterials(materials)
        setEnergySources(sources)
      } catch (error) {
        console.error('Failed to load reference data:', error)
      }
    }
    loadReferenceData()
  }, [])

  const watchUsesLocalIngredients = form.watch('uses_local_ingredients')
  const watchHasWasteRecycling = form.watch('has_waste_recycling')

  async function onSubmit(values: EcoDataFormValues) {
    setIsLoading(true)
    try {
      // Filter out empty strings
      const cleanedValues = Object.fromEntries(
        Object.entries(values).filter(([_, v]) => v !== '' && v !== undefined)
      ) as ProductEcoDataInput

      const data = await upsertProductEcoData(productId, cleanedValues)

      // Recalculate score
      await recalculateEcoScore(productId)

      onSuccess?.(data)
    } catch (error) {
      console.error('Failed to save eco data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sections = [
    {
      id: 'transport',
      title: 'Транспорт и логистика',
      icon: Truck,
      description: 'Откуда и как доставляется продукт',
      completeness: calculateSectionCompleteness('transport', form.getValues()),
    },
    {
      id: 'packaging',
      title: 'Упаковка',
      icon: Package,
      description: 'Материалы и экологичность упаковки',
      completeness: calculateSectionCompleteness('packaging', form.getValues()),
    },
    {
      id: 'production',
      title: 'Производство',
      icon: Factory,
      description: 'Энергия и ресурсы',
      completeness: calculateSectionCompleteness('production', form.getValues()),
    },
    {
      id: 'advanced',
      title: 'Дополнительно',
      icon: Leaf,
      description: 'Детальные экологические данные',
      completeness: calculateSectionCompleteness('advanced', form.getValues()),
    },
  ]

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className={cn('space-y-6', className)}>
      {/* Progress indicator */}
      <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
        <Leaf className="w-5 h-5 text-green-600" />
        <span className="text-sm font-medium">
          Полнота эко-данных: {calculateOverallCompleteness(form.getValues())}%
        </span>
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${calculateOverallCompleteness(form.getValues())}%` }}
          />
        </div>
      </div>

      {/* Section Navigation */}
      <div className="grid grid-cols-4 gap-2">
        {sections.map(section => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={cn(
              'flex flex-col items-center p-3 rounded-lg border transition-all',
              activeSection === section.id
                ? 'border-green-500 bg-green-50 dark:bg-green-950'
                : 'border-transparent hover:bg-muted'
            )}
          >
            <section.icon
              className={cn(
                'w-5 h-5 mb-1',
                activeSection === section.id ? 'text-green-600' : 'text-muted-foreground'
              )}
            />
            <span className="text-xs font-medium">{section.title}</span>
            <span className="text-[10px] text-muted-foreground">{section.completeness}%</span>
          </button>
        ))}
      </div>

      {/* Transport Section */}
      {activeSection === 'transport' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-500" />
              Транспорт и логистика
            </CardTitle>
            <CardDescription>
              Информация о происхождении и доставке продукта
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Production Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="production_location_name">Место производства</Label>
                <Input
                  id="production_location_name"
                  placeholder="Например: д. Молочное, Вологодская обл."
                  {...form.register('production_location_name')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="production_region">Регион</Label>
                <Select
                  value={form.watch('production_region')}
                  onValueChange={v => form.setValue('production_region', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите регион" />
                  </SelectTrigger>
                  <SelectContent>
                    {RUSSIAN_REGIONS.map(region => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Distance and Mode */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transport_distance_km" className="flex items-center gap-2">
                  Расстояние до потребителя (км)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Среднее расстояние от производства до точек продаж</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="transport_distance_km"
                  type="number"
                  min="0"
                  max="50000"
                  placeholder="Например: 150"
                  {...form.register('transport_distance_km')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transport_mode">Способ доставки</Label>
                <Select
                  value={form.watch('transport_mode')}
                  onValueChange={v => form.setValue('transport_mode', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите способ" />
                  </SelectTrigger>
                  <SelectContent>
                    {transportModes.map(mode => (
                      <SelectItem key={mode.mode_code} value={mode.mode_code}>
                        <div className="flex items-center gap-2">
                          <span>{mode.name_ru}</span>
                          <span className="text-xs text-muted-foreground">
                            ({mode.score} баллов)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Local Ingredients */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="uses_local_ingredients"
                checked={watchUsesLocalIngredients}
                onCheckedChange={checked =>
                  form.setValue('uses_local_ingredients', checked as boolean)
                }
              />
              <Label htmlFor="uses_local_ingredients" className="cursor-pointer">
                Используются местные ингредиенты/сырье
              </Label>
            </div>

            {watchUsesLocalIngredients && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="local_ingredients_percentage">
                  Процент местных ингредиентов
                </Label>
                <Input
                  id="local_ingredients_percentage"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Например: 80"
                  {...form.register('local_ingredients_percentage')}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Packaging Section */}
      {activeSection === 'packaging' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-500" />
              Упаковка
            </CardTitle>
            <CardDescription>
              Экологичность упаковочных материалов
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="packaging_material">Основной материал упаковки</Label>
              <Select
                value={form.watch('packaging_material')}
                onValueChange={v => form.setValue('packaging_material', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите материал" />
                </SelectTrigger>
                <SelectContent>
                  {packagingMaterials.map(material => (
                    <SelectItem key={material.material_code} value={material.material_code}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: material.color || '#888' }}
                        />
                        <span>{material.name_ru}</span>
                        <span className="text-xs text-muted-foreground">
                          ({material.base_score} баллов)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="packaging_is_recyclable"
                  checked={form.watch('packaging_is_recyclable')}
                  onCheckedChange={checked =>
                    form.setValue('packaging_is_recyclable', checked as boolean)
                  }
                />
                <Label htmlFor="packaging_is_recyclable" className="cursor-pointer text-sm">
                  Перерабатываемая
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="packaging_is_biodegradable"
                  checked={form.watch('packaging_is_biodegradable')}
                  onCheckedChange={checked =>
                    form.setValue('packaging_is_biodegradable', checked as boolean)
                  }
                />
                <Label htmlFor="packaging_is_biodegradable" className="cursor-pointer text-sm">
                  Биоразлагаемая
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="packaging_is_reusable"
                  checked={form.watch('packaging_is_reusable')}
                  onCheckedChange={checked =>
                    form.setValue('packaging_is_reusable', checked as boolean)
                  }
                />
                <Label htmlFor="packaging_is_reusable" className="cursor-pointer text-sm">
                  Многоразовая
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="packaging_notes">Примечания к упаковке</Label>
              <Textarea
                id="packaging_notes"
                placeholder="Например: Стеклянная банка подходит для повторного использования"
                {...form.register('packaging_notes')}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Production Section */}
      {activeSection === 'production' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="w-5 h-5 text-amber-500" />
              Производство
            </CardTitle>
            <CardDescription>
              Энергоэффективность и управление ресурсами
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_energy_source">Основной источник энергии</Label>
                <Select
                  value={form.watch('primary_energy_source')}
                  onValueChange={v => form.setValue('primary_energy_source', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите источник" />
                  </SelectTrigger>
                  <SelectContent>
                    {energySources.map(source => (
                      <SelectItem key={source.energy_code} value={source.energy_code}>
                        <div className="flex items-center gap-2">
                          <span>{source.name_ru}</span>
                          <span className="text-xs text-muted-foreground">
                            ({source.score} баллов)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="renewable_energy_percentage">
                  % возобновляемой энергии
                </Label>
                <Input
                  id="renewable_energy_percentage"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Например: 30"
                  {...form.register('renewable_energy_percentage')}
                />
              </div>
            </div>

            {/* Waste Management */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_waste_recycling"
                  checked={watchHasWasteRecycling}
                  onCheckedChange={checked =>
                    form.setValue('has_waste_recycling', checked as boolean)
                  }
                />
                <Label htmlFor="has_waste_recycling" className="cursor-pointer">
                  Переработка производственных отходов
                </Label>
              </div>

              {watchHasWasteRecycling && (
                <div className="pl-6 space-y-2">
                  <Label htmlFor="waste_recycling_percentage">
                    % перерабатываемых отходов
                  </Label>
                  <Input
                    id="waste_recycling_percentage"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Например: 60"
                    {...form.register('waste_recycling_percentage')}
                  />
                </div>
              )}
            </div>

            {/* Water */}
            <div className="space-y-2">
              <Label htmlFor="water_recycling_percentage">
                % повторного использования воды
              </Label>
              <Input
                id="water_recycling_percentage"
                type="number"
                min="0"
                max="100"
                placeholder="Например: 40"
                {...form.register('water_recycling_percentage')}
              />
            </div>

            {/* Organic */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="uses_organic_materials"
                checked={form.watch('uses_organic_materials')}
                onCheckedChange={checked =>
                  form.setValue('uses_organic_materials', checked as boolean)
                }
              />
              <Label htmlFor="uses_organic_materials" className="cursor-pointer">
                Используется органическое сырье
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Section */}
      {activeSection === 'advanced' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-green-500" />
              Дополнительные данные
            </CardTitle>
            <CardDescription>
              Если у вас есть точные расчеты экологического воздействия
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="carbon_footprint_kg" className="flex items-center gap-2">
                  Углеродный след (кг CO2)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Если вы проводили LCA-анализ и знаете точное значение</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="carbon_footprint_kg"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Например: 1.25"
                  {...form.register('carbon_footprint_kg')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="water_usage_liters">
                  Расход воды на единицу (литры)
                </Label>
                <Input
                  id="water_usage_liters"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Например: 50"
                  {...form.register('water_usage_liters')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="production_notes">Заметки о производстве</Label>
              <Textarea
                id="production_notes"
                placeholder="Любая дополнительная информация об экологичности производства"
                {...form.register('production_notes')}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="gap-2">
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Сохранить эко-данные
        </Button>
      </div>
    </form>
  )
}

// Helper functions
function calculateSectionCompleteness(section: string, values: EcoDataFormValues): number {
  const sectionFields: Record<string, (keyof EcoDataFormValues)[]> = {
    transport: [
      'production_location_name',
      'production_region',
      'transport_distance_km',
      'transport_mode',
    ],
    packaging: [
      'packaging_material',
      'packaging_is_recyclable',
      'packaging_is_biodegradable',
    ],
    production: [
      'primary_energy_source',
      'renewable_energy_percentage',
      'has_waste_recycling',
    ],
    advanced: [
      'carbon_footprint_kg',
      'water_usage_liters',
      'production_notes',
    ],
  }

  const fields = sectionFields[section] || []
  if (fields.length === 0) return 0

  const filledFields = fields.filter(field => {
    const value = values[field]
    return value !== undefined && value !== '' && value !== false
  })

  return Math.round((filledFields.length / fields.length) * 100)
}

function calculateOverallCompleteness(values: EcoDataFormValues): number {
  const sections = ['transport', 'packaging', 'production', 'advanced']
  const weights = [30, 25, 30, 15]

  let totalWeightedScore = 0
  sections.forEach((section, index) => {
    totalWeightedScore += (calculateSectionCompleteness(section, values) * weights[index]) / 100
  })

  return Math.round(totalWeightedScore)
}

export default EcoDataForm
