import { useCallback, useEffect, useState } from 'react'

import { listAllOrganizations, updateOrganizationStatus, blockOrganization } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { BusinessDetailsDialog } from '@/components/admin/BusinessDetailsDialog'
import type { AdminOrganization } from '@/types/auth'

export const AdminOrganizationsSection = () => {
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<{
    search?: string
    status?: 'pending' | 'verified' | 'rejected'
    city?: string
    category?: string
  }>({})
  const [total, setTotal] = useState(0)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  const loadOrganizations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await listAllOrganizations({
        search: filters.search,
        status: filters.status,
        city: filters.city,
        category: filters.category,
        limit: 50,
        offset: 0,
      })
      setOrganizations(response.items)
      setTotal(response.total)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить организации')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void loadOrganizations()
  }, [loadOrganizations])

  const handleStatusChange = async (orgId: string, status: 'pending' | 'verified' | 'rejected') => {
    const comment = window.prompt('Комментарий к изменению статуса', '')
    if (comment === null) return

    setLoading(true)
    setError(null)
    try {
      await updateOrganizationStatus(orgId, status, comment || undefined)
      await loadOrganizations()
    } catch (err) {
      console.error(err)
      setError('Не удалось изменить статус организации')
    } finally {
      setLoading(false)
    }
  }

  const handleBlock = async (orgId: string, blocked: boolean) => {
    const action = blocked ? 'заблокировать' : 'разблокировать'
    if (!confirm(`Вы уверены, что хотите ${action} эту организацию?`)) return

    setLoading(true)
    setError(null)
    try {
      await blockOrganization(orgId, blocked)
      await loadOrganizations()
    } catch (err) {
      console.error(err)
      setError('Не удалось изменить статус блокировки')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Businesses Management</CardTitle>
        <CardDescription>Управление всеми бизнесами на платформе.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search by name..."
            value={filters.search || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))}
            className="w-64"
          />

          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={filters.status || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as any || undefined }))}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>

          <Input
            placeholder="City (optional)"
            value={filters.city || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value || undefined }))}
            className="w-48"
          />

          <Input
            placeholder="Category (optional)"
            value={filters.category || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value || undefined }))}
            className="w-48"
          />
        </div>

        {loading && organizations.length === 0 && <p className="text-sm text-muted-foreground">Загружаем...</p>}

        {!loading && organizations.length === 0 && (
          <p className="text-sm text-muted-foreground">Нет организаций</p>
        )}

        <div className="text-sm text-muted-foreground">
          Всего бизнесов: {total}
        </div>

        <div className="space-y-3">
          {organizations.map((org) => (
            <div key={org.id} className="rounded-md border border-border p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{org.name}</p>
                      <span className="text-xs uppercase text-muted-foreground">{org.verification_status}</span>
                      {org.blocked === true && (
                        <span className="text-xs text-destructive">BLOCKED</span>
                      )}
                      {org.public_visible && (
                        <span className="text-xs text-primary">PUBLIC</span>
                      )}
                    </div>
                    {org.city && org.country && (
                      <p className="text-sm text-muted-foreground">
                        {org.city}, {org.country}
                      </p>
                    )}
                    {org.website_url && (
                      <a
                        href={org.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline"
                      >
                        {org.website_url}
                      </a>
                    )}
                    {org.slug && (
                      <p className="text-xs text-muted-foreground">Slug: {org.slug}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      ID: {org.id}
                    </p>
                    {org.created_at && (
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(org.created_at).toLocaleString('ru-RU')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    className="h-9 rounded-md border border-input px-2 text-sm"
                    value={org.verification_status || ''}
                    onChange={(e) => handleStatusChange(org.id, e.target.value as any)}
                    disabled={loading}
                  >
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  {org.blocked === true ? (
                    <Button size="sm" variant="outline" onClick={() => handleBlock(org.id, false)} disabled={loading}>
                      Unblock
                    </Button>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => handleBlock(org.id, true)} disabled={loading}>
                      Block
                    </Button>
                  )}
                  <Button variant="outline" asChild size="sm">
                    <a href={`/org/${org.id}`} target="_blank" rel="noreferrer">
                      View Profile
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrgId(org.id)
                      setDetailsDialogOpen(true)
                    }}
                  >
                    Details
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <BusinessDetailsDialog
          organizationId={selectedOrgId}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          onUpdate={loadOrganizations}
        />
      </CardContent>
    </Card>
  )
}

