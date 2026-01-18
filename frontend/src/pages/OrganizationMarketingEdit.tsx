/**
 * OrganizationMarketingEdit - Marketing Material Editor
 *
 * Features:
 * - Live preview of marketing material using LayoutRenderer
 * - Edit text blocks marked as editable_by_business
 * - Save changes to backend
 * - Export to PDF/PNG using html2canvas + jsPDF
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { ArrowLeft, Download, Image, Save } from 'lucide-react'

import { getMarketingMaterial, updateMarketingMaterial } from '@/api/marketingService'
import { LayoutRenderer, calculateFitScale, getEditableTextBlocks } from '@/components/marketing/LayoutRenderer'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUserStore } from '@/store/userStore'
import type { LayoutJson, MarketingMaterial } from '@/types/marketing'

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager', 'editor'])

// Paper sizes for PDF generation
const PAPER_SIZES_MM = {
  A3: { portrait: [297, 420], landscape: [420, 297] },
  A4: { portrait: [210, 297], landscape: [297, 210] },
  A5: { portrait: [148, 210], landscape: [210, 148] },
}

export const OrganizationMarketingEditPage = () => {
  const navigate = useNavigate()
  const { materialId } = useParams<{ materialId: string }>()
  const { organizations, memberships, selectedOrganizationId, user } = useUserStore()

  const [material, setMaterial] = useState<MarketingMaterial | null>(null)
  const [layout, setLayout] = useState<LayoutJson | null>(null)
  const [materialName, setMaterialName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [previewScale, setPreviewScale] = useState(0.5)

  const previewRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )

  const membership = memberships.find((m) => m.organization_id === currentOrganization?.id)
  const canEdit = membership ? MANAGER_ROLES.has(membership.role) : false

  const organizationId = currentOrganization?.id

  // Load material
  useEffect(() => {
    if (!organizationId || !materialId) return

    setLoading(true)
    setError(null)

    getMarketingMaterial(organizationId, materialId)
      .then((data) => {
        setMaterial(data)
        setMaterialName(data.name)
        setLayout(data.layout_json)
      })
      .catch(() => setError('Не удалось загрузить материал'))
      .finally(() => setLoading(false))
  }, [organizationId, materialId])

  // Calculate scale based on container width
  useEffect(() => {
    if (!containerRef.current || !layout) return

    const updateScale = () => {
      if (!containerRef.current || !layout) return
      const containerWidth = containerRef.current.offsetWidth - 48 // padding
      const scale = calculateFitScale(layout, containerWidth)
      setPreviewScale(Math.min(scale, 1.0)) // Cap at 1.0
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [layout])

  // Get editable blocks
  const editableBlocks = useMemo(() => {
    if (!layout) return []
    return getEditableTextBlocks(layout, false)
  }, [layout])

  const editableBlockIds = useMemo(() => new Set(editableBlocks.map((b) => b.id)), [editableBlocks])

  // Handle block text change
  const handleBlockChange = useCallback((blockId: string, field: string, value: string) => {
    setLayout((prev) => {
      if (!prev) return prev
      const newLayout = { ...prev }
      newLayout.blocks = prev.blocks.map((block) => {
        if (block.id === blockId && field === 'text') {
          return { ...block, text: value }
        }
        return block
      })
      return newLayout
    })
    setHasChanges(true)
  }, [])

  // Handle form field change
  const handleFormFieldChange = useCallback((blockId: string, value: string) => {
    handleBlockChange(blockId, 'text', value)
  }, [handleBlockChange])

  // Save changes
  const handleSave = async () => {
    if (!organizationId || !materialId || !layout) return

    setSaving(true)
    setError(null)

    try {
      const updated = await updateMarketingMaterial(organizationId, materialId, {
        name: materialName,
        layout_json: layout,
      })
      setMaterial(updated)
      setHasChanges(false)
    } catch {
      setError('Не удалось сохранить изменения')
    } finally {
      setSaving(false)
    }
  }

  // Export to PDF
  const handleExportPdf = async () => {
    if (!previewRef.current || !material || !layout) return

    setExporting(true)
    setError(null)

    try {
      // Render at higher scale for print quality
      const canvas = await html2canvas(previewRef.current, {
        scale: 3, // 300 DPI equivalent
        useCORS: true,
        backgroundColor: layout.theme?.background || '#ffffff',
      })

      // Get paper dimensions
      const paperSize = layout.paper?.size || 'A4'
      const orientation = layout.paper?.orientation || 'portrait'
      const [width, height] = PAPER_SIZES_MM[paperSize]?.[orientation] || [210, 297]

      // Create PDF
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: [width, height],
      })

      const imgData = canvas.toDataURL('image/png')
      pdf.addImage(imgData, 'PNG', 0, 0, width, height)

      // Save
      const fileName = `${material.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.pdf`
      pdf.save(fileName)
    } catch (err) {
      console.error('PDF export error:', err)
      setError('Не удалось экспортировать PDF')
    } finally {
      setExporting(false)
    }
  }

  // Export to PNG
  const handleExportPng = async () => {
    if (!previewRef.current || !material || !layout) return

    setExporting(true)
    setError(null)

    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: layout.theme?.background || '#ffffff',
      })

      canvas.toBlob((blob) => {
        if (!blob) {
          setError('Не удалось создать изображение')
          return
        }
        const fileName = `${material.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.png`
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        link.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    } catch (err) {
      console.error('PNG export error:', err)
      setError('Не удалось экспортировать PNG')
    } finally {
      setExporting(false)
    }
  }

  if (!user || !currentOrganization || !organizationId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertTitle>Недостаточно данных</AlertTitle>
          <AlertDescription>Сначала войдите и выберите организацию.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-muted-foreground">Загружаем материал...</p>
      </div>
    )
  }

  if (!material || !layout) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert variant="destructive">
          <AlertTitle>Материал не найден</AlertTitle>
          <AlertDescription>Запрошенный материал не существует или был удалён.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/organization/marketing')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Редактирование материала</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{material.name}</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: Editor */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Настройки</CardTitle>
              <CardDescription>Отредактируйте тексты для вашего материала</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Material name */}
              <div className="space-y-2">
                <Label htmlFor="material-name">Название материала</Label>
                <Input
                  id="material-name"
                  value={materialName}
                  onChange={(e) => {
                    setMaterialName(e.target.value)
                    setHasChanges(true)
                  }}
                  disabled={!canEdit}
                />
              </div>

              {/* Editable text blocks */}
              {editableBlocks.map((block) => (
                <div key={block.id} className="space-y-2">
                  <Label htmlFor={`block-${block.id}`}>
                    {block.id.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
                  </Label>
                  {(block.text?.length || 0) > 50 ? (
                    <Textarea
                      id={`block-${block.id}`}
                      value={block.text || ''}
                      onChange={(e) => handleFormFieldChange(block.id, e.target.value)}
                      rows={3}
                      disabled={!canEdit}
                    />
                  ) : (
                    <Input
                      id={`block-${block.id}`}
                      value={block.text || ''}
                      onChange={(e) => handleFormFieldChange(block.id, e.target.value)}
                      disabled={!canEdit}
                    />
                  )}
                </div>
              ))}

              {editableBlocks.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет редактируемых полей в этом шаблоне.</p>
              )}
            </CardContent>
          </Card>

          {/* Export options */}
          <Card>
            <CardHeader>
              <CardTitle>Экспорт</CardTitle>
              <CardDescription>Скачайте материал для печати</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleExportPdf} disabled={exporting} className="min-h-[44px]">
                  <Download className="mr-2 h-4 w-4" />
                  {exporting ? 'Экспорт...' : 'Скачать PDF'}
                </Button>
                <Button onClick={handleExportPng} disabled={exporting} variant="outline" className="min-h-[44px]">
                  <Image className="mr-2 h-4 w-4" />
                  Скачать PNG
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Формат: {material.paper_size} {material.orientation === 'landscape' ? '(горизонтальный)' : '(вертикальный)'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Preview */}
        <div className="space-y-6" ref={containerRef}>
          <Card>
            <CardHeader>
              <CardTitle>Превью</CardTitle>
              <CardDescription>
                Так будет выглядеть ваш материал. Кликните на текст для редактирования.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center overflow-auto">
                <LayoutRenderer
                  ref={previewRef}
                  layout={layout}
                  scale={previewScale}
                  onBlockChange={canEdit ? handleBlockChange : undefined}
                  editableBlocks={canEdit ? editableBlockIds : undefined}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
