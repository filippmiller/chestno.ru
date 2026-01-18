import { useEffect, useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FieldMappingInfo, SourceColumnInfo, TargetField } from '@/types/import'

interface ImportFieldMapperProps {
  mappingInfo: FieldMappingInfo
  onSave: (mapping: Record<string, string>) => void
  loading?: boolean
}

export function ImportFieldMapper({ mappingInfo, onSave, loading }: ImportFieldMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({})

  useEffect(() => {
    // Initialize with suggested/current mapping
    const initial = { ...mappingInfo.suggested_mapping, ...mappingInfo.current_mapping }
    setMapping(initial)
  }, [mappingInfo])

  const handleMappingChange = (sourceColumn: string, targetField: string) => {
    setMapping((prev) => {
      const updated = { ...prev }
      if (targetField === '_none') {
        delete updated[sourceColumn]
      } else {
        updated[sourceColumn] = targetField
      }
      return updated
    })
  }

  const getMappedTarget = (sourceColumn: string): string => {
    return mapping[sourceColumn] || '_none'
  }

  const getTargetFieldLabel = (fieldName: string): string => {
    const field = mappingInfo.target_fields.find((f) => f.name === fieldName)
    return field?.label || fieldName
  }

  const isFieldMapped = (fieldName: string): boolean => {
    return Object.values(mapping).includes(fieldName)
  }

  const requiredFields = mappingInfo.target_fields.filter((f) => f.required)
  const allRequiredMapped = requiredFields.every((f) => isFieldMapped(f.name))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Сопоставление полей</h2>
        <p className="text-sm text-muted-foreground">
          Укажите, какие колонки файла соответствуют полям товара
        </p>
      </div>

      {/* Required fields status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Обязательные поля</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {requiredFields.map((field) => (
              <div
                key={field.name}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm ${
                  isFieldMapped(field.name)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {isFieldMapped(field.name) ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                {field.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mapping table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Колонки файла</CardTitle>
          <CardDescription>Выберите соответствующее поле для каждой колонки</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mappingInfo.source_columns.map((column) => (
              <MappingRow
                key={column.name}
                column={column}
                targetFields={mappingInfo.target_fields}
                selectedTarget={getMappedTarget(column.name)}
                getTargetLabel={getTargetFieldLabel}
                isTargetMapped={isFieldMapped}
                onChange={(target) => handleMappingChange(column.name, target)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => onSave(mapping)} disabled={loading || !allRequiredMapped}>
          {loading ? 'Сохранение...' : 'Сохранить и продолжить'}
        </Button>
      </div>
    </div>
  )
}

interface MappingRowProps {
  column: SourceColumnInfo
  targetFields: TargetField[]
  selectedTarget: string
  getTargetLabel: (name: string) => string
  isTargetMapped: (name: string) => boolean
  onChange: (target: string) => void
}

function MappingRow({
  column,
  targetFields,
  selectedTarget,
  getTargetLabel,
  isTargetMapped,
  onChange,
}: MappingRowProps) {
  return (
    <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4 rounded-lg border p-3">
      <div>
        <p className="font-medium">{column.name}</p>
        {column.sample_values.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Примеры: {column.sample_values.slice(0, 2).join(', ')}
          </p>
        )}
      </div>

      <ArrowRight className="h-4 w-4 text-muted-foreground" />

      <Select value={selectedTarget} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Не сопоставлено" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">— Не импортировать —</SelectItem>
          {targetFields.map((field) => (
            <SelectItem
              key={field.name}
              value={field.name}
              disabled={isTargetMapped(field.name) && selectedTarget !== field.name}
            >
              {field.label}
              {field.required && ' *'}
              {isTargetMapped(field.name) && selectedTarget !== field.name && ' (уже выбрано)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
