import { useCallback, useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  createMigrationDraft,
  getDbTableColumns,
  getDbTableRows,
  listDbTables,
} from '@/api/authService'
import { useAuthV2 } from '@/auth/AuthProviderV2'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import type { DbColumnInfo, DbTableInfo, DbRowsResponse } from '@/types/auth'

const ADD_COLUMN_SCHEMA = z.object({
  tableName: z.string().min(1),
  columnName: z.string().min(1),
  columnType: z.enum(['text', 'integer', 'bigint', 'numeric', 'uuid', 'boolean', 'timestamptz', 'jsonb']),
  defaultValue: z.string().optional(),
  isNullable: z.boolean().default(true),
})

export const DatabaseExplorerPage = () => {
  const { platformRoles } = useAuthV2()
  const isAdmin = useMemo(() => platformRoles.some((role) => role === 'platform_owner' || role === 'platform_admin'), [platformRoles])
  const [tables, setTables] = useState<DbTableInfo[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [columns, setColumns] = useState<DbColumnInfo[]>([])
  const [rows, setRows] = useState<DbRowsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [orderBy, setOrderBy] = useState('')

  const addColumnForm = useForm<z.infer<typeof ADD_COLUMN_SCHEMA>>({
    resolver: zodResolver(ADD_COLUMN_SCHEMA),
    defaultValues: {
      tableName: '',
      columnName: '',
      columnType: 'text',
      defaultValue: '',
      isNullable: true,
    },
  })

  const loadTables = useCallback(async () => {
    try {
      setError(null)
      const data = await listDbTables()
      setTables(data)
      if (!selectedTable && data.length) {
        setSelectedTable(data[0].table_name)
      }
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить список таблиц')
    }
  }, [selectedTable])

  useEffect(() => {
    if (isAdmin) {
      void loadTables()
    }
  }, [isAdmin, loadTables])

  const loadDetails = useCallback(
    async (tableName: string) => {
      setIsLoading(true)
      try {
        const [cols, rowsData] = await Promise.all([
          getDbTableColumns(tableName),
          getDbTableRows(tableName, {
            limit: 50,
            offset: 0,
            search: search || undefined,
            order_by: orderBy || undefined,
          }),
        ])
        setColumns(cols)
        setRows(rowsData)
        addColumnForm.reset({ tableName, columnName: '', columnType: 'text', defaultValue: '', isNullable: true })
      } catch (err) {
        console.error(err)
        setError('Не удалось загрузить данные таблицы')
      } finally {
        setIsLoading(false)
      }
    },
    [addColumnForm, orderBy, search],
  )

  useEffect(() => {
    if (selectedTable) {
      void loadDetails(selectedTable)
    }
  }, [selectedTable, loadDetails])

  const handleAddColumn = async (values: z.infer<typeof ADD_COLUMN_SCHEMA>): Promise<void> => {
    try {
      await createMigrationDraft({
        table_name: values.tableName,
        column_name: values.columnName,
        column_type: values.columnType,
        default_value: values.defaultValue || undefined,
        is_nullable: values.isNullable,
      })
      addColumnForm.reset({
        tableName: values.tableName,
        columnName: '',
        columnType: 'text',
        defaultValue: '',
        isNullable: true,
      })
      setInfo('Черновик миграции сохранён (см. таблицу migration_drafts).')
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Не удалось сохранить черновик миграции')
      setInfo(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Нет доступа</AlertTitle>
          <AlertDescription>Database Explorer доступен только администраторам платформы.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Database Explorer</h1>
        <p className="text-muted-foreground">Просматривайте таблицы, структуру и создавайте черновики миграций.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Уведомление</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {info && (
        <Alert>
          <AlertTitle>Готово</AlertTitle>
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Таблицы</CardTitle>
            <CardDescription>Схема public</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tables.map((table) => (
              <button
                key={table.table_name}
                className={`w-full rounded-md border px-3 py-2 text-left ${
                  selectedTable === table.table_name ? 'border-primary bg-primary/10' : 'border-border'
                }`}
                onClick={() => setSelectedTable(table.table_name)}
              >
                <p className="font-medium">{table.table_name}</p>
                <p className="text-xs text-muted-foreground">
                  ~{table.approx_rows ?? 0} rows {table.comment ? `• ${table.comment}` : ''}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Структура таблицы</CardTitle>
              <CardDescription>{selectedTable ?? 'Не выбрана'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground">Загружаем…</p>}
              {!isLoading && columns.length === 0 && <p className="text-sm text-muted-foreground">Нет данных</p>}
              {!isLoading &&
                columns.map((column) => (
                  <div key={column.column_name} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-semibold">{column.column_name}</p>
                    <p className="text-muted-foreground">
                      {column.data_type}
                      {column.is_primary_key && ' • PK'}
                      {column.is_foreign_key && ' • FK'}
                      {!column.is_nullable && ' • NOT NULL'}
                      {column.column_default ? ` • default: ${column.column_default}` : ''}
                    </p>
                    {column.comment && <p className="text-xs text-muted-foreground">{column.comment}</p>}
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Данные</CardTitle>
              <CardDescription>Первые строки таблицы</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Поиск…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full md:w-auto"
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value)}
                >
                  <option value="">Без сортировки</option>
                  {columns.map((col) => (
                    <option key={col.column_name} value={col.column_name}>
                      {col.column_name}
                    </option>
                  ))}
                </select>
                <Button onClick={() => selectedTable && loadDetails(selectedTable)}>Обновить</Button>
              </div>
              {rows && rows.rows.length > 0 ? (
                <div className="overflow-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        {rows.columns.map((col) => (
                          <th key={col} className="px-2 py-1 text-left font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.rows.map((row, idx) => (
                        <tr key={idx} className="border-t border-border">
                          {rows.columns.map((col) => (
                            <td key={col} className="px-2 py-1 align-top">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Нет строк</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Column (Migration Draft)</CardTitle>
              <CardDescription>Создаёт SQL-черновик в таблице migration_drafts.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...addColumnForm}>
                <form onSubmit={addColumnForm.handleSubmit(handleAddColumn)} className="grid gap-3 md:grid-cols-2">
                  <FormField
                    control={addColumnForm.control}
                    name="tableName"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Таблица</FormLabel>
                        <FormControl>
                          <select className="h-10 w-full rounded-md border border-input px-3 text-sm" {...field}>
                            <option value="">Выберите таблицу</option>
                            {tables.map((table) => (
                              <option key={table.table_name} value={table.table_name}>
                                {table.table_name}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addColumnForm.control}
                    name="columnName"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Название колонки</FormLabel>
                        <FormControl>
                          <Input placeholder="new_column" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addColumnForm.control}
                    name="columnType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип</FormLabel>
                        <FormControl>
                          <select className="h-10 w-full rounded-md border border-input px-3 text-sm" {...field}>
                            {['text', 'integer', 'bigint', 'numeric', 'uuid', 'boolean', 'timestamptz', 'jsonb'].map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addColumnForm.control}
                    name="defaultValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default (опционально)</FormLabel>
                        <FormControl>
                          <Input placeholder="NULL" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addColumnForm.control}
                    name="isNullable"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>NULLable</FormLabel>
                        <FormControl>
                          <select className="h-10 w-full rounded-md border border-input px-3 text-sm" value={field.value ? 'true' : 'false'} onChange={(e) => field.onChange(e.target.value === 'true')}>
                            <option value="true">NULL разрешён</option>
                            <option value="false">NOT NULL</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2">
                    <Button type="submit">Сохранить черновик</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

