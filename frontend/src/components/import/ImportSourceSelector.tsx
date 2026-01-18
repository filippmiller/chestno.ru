import { FileSpreadsheet, FileText, Package } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ImportSourceType } from '@/types/import'
import { IMPORT_SOURCES } from '@/types/import'

interface ImportSourceSelectorProps {
  selectedSource: ImportSourceType | null
  onSelect: (source: ImportSourceType) => void
}

const getSourceIcon = (type: ImportSourceType) => {
  switch (type) {
    case 'wildberries':
    case 'ozon':
      return <Package className="h-8 w-8" />
    case '1c':
      return <FileText className="h-8 w-8" />
    case 'generic_csv':
    case 'generic_xlsx':
      return <FileSpreadsheet className="h-8 w-8" />
    default:
      return <FileSpreadsheet className="h-8 w-8" />
  }
}

export function ImportSourceSelector({ selectedSource, onSelect }: ImportSourceSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Выберите источник данных</h2>
        <p className="text-sm text-muted-foreground">
          Укажите, откуда вы хотите импортировать товары
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {IMPORT_SOURCES.map((source) => (
          <Card
            key={source.type}
            className={cn(
              'cursor-pointer transition-all hover:border-primary hover:shadow-md',
              selectedSource === source.type && 'border-primary bg-primary/5 shadow-md'
            )}
            onClick={() => onSelect(source.type)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'rounded-lg p-2',
                    selectedSource === source.type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {getSourceIcon(source.type)}
                </div>
                <CardTitle className="text-base">{source.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{source.description}</CardDescription>
              <p className="mt-2 text-xs text-muted-foreground">
                Форматы: {source.acceptedFormats.join(', ')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
