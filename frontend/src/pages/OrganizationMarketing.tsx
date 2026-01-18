/**
 * OrganizationMarketing - Marketing Materials List Page
 *
 * Displays all marketing materials for the current organization.
 * Allows creating new materials from templates, editing, and deleting.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Plus, Trash2, Edit, Download } from 'lucide-react'

import {
  createMarketingMaterial,
  deleteMarketingMaterial,
  listMarketingMaterials,
  listMarketingTemplates,
} from '@/api/marketingService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUserStore } from '@/store/userStore'
import type { MarketingMaterial, MarketingTemplate } from '@/types/marketing'

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager', 'editor'])

export const OrganizationMarketingPage = () => {
  const navigate = useNavigate()
  const { organizations, memberships, selectedOrganizationId, user } = useUserStore()

  const [materials, setMaterials] = useState<MarketingMaterial[]>([])
  const [templates, setTemplates] = useState<MarketingTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const currentOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  )

  const membership = memberships.find((m) => m.organization_id === currentOrganization?.id)
  const canEdit = membership ? MANAGER_ROLES.has(membership.role) : false

  const organizationId = currentOrganization?.id

  // Load materials and templates
  useEffect(() => {
    if (!organizationId) return

    setLoading(true)
    setError(null)

    Promise.all([listMarketingMaterials(organizationId), listMarketingTemplates()])
      .then(([materialsRes, templatesRes]) => {
        setMaterials(materialsRes.items)
        setTemplates(templatesRes.items)
      })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false))
  }, [organizationId])

  // Handle create material
  const handleCreate = async () => {
    if (!organizationId || !selectedTemplateId) return

    setLoading(true)
    setError(null)

    try {
      const newMaterial = await createMarketingMaterial(organizationId, {
        template_id: selectedTemplateId,
      })

      // Navigate to editor
      navigate(`/dashboard/organization/marketing/${newMaterial.id}`)
    } catch {
      setError('Не удалось создать материал')
    } finally {
      setLoading(false)
      setIsCreateDialogOpen(false)
      setSelectedTemplateId(null)
    }
  }

  // Handle delete material
  const handleDelete = async (materialId: string) => {
    if (!organizationId) return

    setLoading(true)
    setError(null)

    try {
      await deleteMarketingMaterial(organizationId, materialId)
      setMaterials((prev) => prev.filter((m) => m.id !== materialId))
    } catch {
      setError('Не удалось удалить материал')
    } finally {
      setLoading(false)
      setDeleteConfirmId(null)
    }
  }

  // Format paper size for display
  const formatPaperSize = (material: MarketingMaterial) => {
    const orientation = material.orientation === 'landscape' ? 'гориз.' : 'вертик.'
    return `${material.paper_size} ${orientation}`
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Маркетинговые материалы</p>
        <h1 className="text-3xl font-semibold">{currentOrganization.name}</h1>
        <p className="text-muted-foreground">
          Создавайте постеры, флаеры и другие материалы с QR-кодами для печати.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Quick link to existing QR poster page */}
      <Card>
        <CardHeader>
          <CardTitle>Быстрый постер</CardTitle>
          <CardDescription>
            Создайте простой постер с QR-кодом без сохранения. Для быстрой печати.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/dashboard/organization/marketing/qr-poster">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Открыть генератор постеров
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Materials list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Мои материалы</CardTitle>
            <CardDescription>Сохранённые маркетинговые материалы</CardDescription>
          </div>
          {canEdit && (
            <Button onClick={() => setIsCreateDialogOpen(true)} disabled={loading}>
              <Plus className="mr-2 h-4 w-4" />
              Создать
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Загружаем...</p>}

          {!loading && materials.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Нет сохранённых материалов</p>
              {canEdit && (
                <Button variant="link" onClick={() => setIsCreateDialogOpen(true)}>
                  Создать первый материал
                </Button>
              )}
            </div>
          )}

          {!loading && materials.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="flex flex-col rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{material.name}</h3>
                      <p className="text-sm text-muted-foreground">{formatPaperSize(material)}</p>
                    </div>
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Создан: {new Date(material.created_at).toLocaleDateString('ru-RU')}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/dashboard/organization/marketing/${material.id}`}>
                      <Button size="sm" variant="outline">
                        <Edit className="mr-1 h-3 w-3" />
                        Редактировать
                      </Button>
                    </Link>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteConfirmId(material.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать материал</DialogTitle>
            <DialogDescription>Выберите шаблон для нового маркетингового материала</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplateId(template.id)}
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  selectedTemplateId === template.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{template.name}</h4>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {template.paper_size} {template.orientation === 'landscape' ? 'гориз.' : 'вертик.'}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
            ))}

            {templates.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Нет доступных шаблонов</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={!selectedTemplateId || loading}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить материал?</DialogTitle>
            <DialogDescription>Это действие нельзя отменить. Материал будет удалён навсегда.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} disabled={loading}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
