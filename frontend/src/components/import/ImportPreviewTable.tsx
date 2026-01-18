import { AlertCircle, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ImportPreviewResponse, ImportPreviewRow } from '@/types/import'

interface ImportPreviewTableProps {
  preview: ImportPreviewResponse
}

export function ImportPreviewTable({ preview }: ImportPreviewTableProps) {
  // Get all mapped field names
  const mappedFields = Object.keys(preview.rows[0]?.mapped_data || {})

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Предпросмотр импорта</h2>
        <p className="text-sm text-muted-foreground">
          Проверьте данные перед импортом. Показаны первые {preview.rows.length} из{' '}
          {preview.total_rows} строк.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-green-600">
              {preview.validation_summary.valid}
            </CardTitle>
            <CardDescription>Корректных записей</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-red-600">
              {preview.validation_summary.invalid}
            </CardTitle>
            <CardDescription>С ошибками</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl">{preview.total_rows}</CardTitle>
            <CardDescription>Всего строк</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Warning if many errors */}
      {preview.validation_summary.invalid > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {preview.validation_summary.invalid} строк содержат ошибки и будут пропущены при
            импорте. Проверьте исходный файл.
          </AlertDescription>
        </Alert>
      )}

      {/* Preview table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Данные для импорта</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-12">Статус</TableHead>
                  {mappedFields.map((field) => (
                    <TableHead key={field}>{getFieldLabel(field)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <PreviewRow key={row.row_number} row={row} fields={mappedFields} />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface PreviewRowProps {
  row: ImportPreviewRow
  fields: string[]
}

function PreviewRow({ row, fields }: PreviewRowProps) {
  return (
    <TableRow className={cn(!row.is_valid && 'bg-red-50')}>
      <TableCell className="font-mono text-xs">{row.row_number}</TableCell>
      <TableCell>
        {row.is_valid ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <div className="group relative">
            <AlertCircle className="h-4 w-4 text-red-600" />
            {row.errors.length > 0 && (
              <div className="absolute left-0 top-full z-10 hidden w-48 rounded bg-red-100 p-2 text-xs text-red-700 shadow-lg group-hover:block">
                {row.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </TableCell>
      {fields.map((field) => (
        <TableCell key={field} className="max-w-[200px] truncate text-sm">
          {formatValue(row.mapped_data[field])}
        </TableCell>
      ))}
    </TableRow>
  )
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    name: 'Название',
    slug: 'Slug',
    sku: 'Артикул',
    barcode: 'Штрихкод',
    short_description: 'Описание',
    price: 'Цена',
    stock_quantity: 'Остаток',
    category: 'Категория',
    main_image_url: 'Изображение',
  }
  return labels[field] || field
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  if (typeof value === 'number') return value.toString()
  return String(value).slice(0, 50)
}
