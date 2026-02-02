import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Shield,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  TrendingUp,
  Settings,
  ChevronDown,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { WarrantyClaimsList, ClaimStatusBadge, PriorityBadge } from '@/components/warranty'
import {
  getOrganizationClaims,
  getWarrantyStats,
  updateClaim,
} from '@/api/warrantyService'
import type {
  WarrantyClaimWithDetails,
  WarrantyStatsResponse,
  ClaimStatus,
  ClaimPriority,
  WarrantyClaimUpdate,
} from '@/types/warranty'
import { CLAIM_STATUS_LABELS, PRIORITY_LABELS, RESOLUTION_TYPE_LABELS } from '@/types/warranty'

type TabValue = 'pending' | 'in_progress' | 'resolved' | 'all'

export function OrganizationWarrantiesPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<TabValue>('pending')
  const [claims, setClaims] = useState<WarrantyClaimWithDetails[]>([])
  const [stats, setStats] = useState<WarrantyStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>('all')

  // Claim details dialog
  const [selectedClaim, setSelectedClaim] = useState<WarrantyClaimWithDetails | null>(null)
  const [updating, setUpdating] = useState(false)

  const loadData = useCallback(async () => {
    if (!orgId) return

    setLoading(true)
    setError(null)

    try {
      const [claimsRes, statsRes] = await Promise.all([
        getOrganizationClaims(orgId, { per_page: 100 }),
        getWarrantyStats(orgId),
      ])

      setClaims(claimsRes.items)
      setStats(statsRes)
    } catch (err: any) {
      console.error('Failed to load warranty data:', err)
      setError('Не удалось загрузить данные. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter claims based on tab and search
  const filteredClaims = claims.filter((c) => {
    // Tab filter
    if (activeTab === 'pending' && !['submitted', 'under_review', 'approved'].includes(c.status))
      return false
    if (activeTab === 'in_progress' && c.status !== 'in_progress') return false
    if (activeTab === 'resolved' && !['resolved', 'closed', 'rejected'].includes(c.status))
      return false

    // Status filter
    if (statusFilter !== 'all' && c.status !== statusFilter) return false

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        c.product_name?.toLowerCase().includes(query) ||
        c.customer_name?.toLowerCase().includes(query) ||
        c.customer_email?.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query)
      )
    }

    return true
  })

  // Counts for tabs
  const pendingCount = claims.filter((c) =>
    ['submitted', 'under_review', 'approved'].includes(c.status)
  ).length
  const inProgressCount = claims.filter((c) => c.status === 'in_progress').length
  const resolvedCount = claims.filter((c) =>
    ['resolved', 'closed', 'rejected'].includes(c.status)
  ).length

  const handleClaimClick = (claim: WarrantyClaimWithDetails) => {
    setSelectedClaim(claim)
  }

  const handleUpdateClaim = async (update: WarrantyClaimUpdate) => {
    if (!orgId || !selectedClaim) return

    setUpdating(true)
    try {
      await updateClaim(orgId, selectedClaim.id, update)
      await loadData() // Refresh
      setSelectedClaim(null)
    } catch (err: any) {
      console.error('Failed to update claim:', err)
      alert('Не удалось обновить заявку')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-96 bg-muted rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Гарантийные заявки
          </h1>
          <p className="text-muted-foreground mt-1">
            Управление гарантийным обслуживанием
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/org/${orgId}/warranty/settings`)}>
          <Settings className="w-4 h-4 mr-2" />
          Настройки
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active_registrations}</p>
                  <p className="text-xs text-muted-foreground">Активных гарантий</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending_claims}</p>
                  <p className="text-xs text-muted-foreground">Ожидают решения</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.resolved_claims}</p>
                  <p className="text-xs text-muted-foreground">Решено</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.avg_resolution_days !== null
                      ? `${stats.avg_resolution_days} дн.`
                      : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">Среднее время</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по товару, клиенту или описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ClaimStatus | 'all')}
        >
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {Object.entries(CLAIM_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Ожидают
            {pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="in_progress">
            В работе
            {inProgressCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs">
                {inProgressCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">Решенные</TabsTrigger>
          <TabsTrigger value="all">Все</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <WarrantyClaimsList
            claims={filteredClaims}
            showCustomerInfo
            onClaimClick={handleClaimClick}
            emptyMessage={
              searchQuery
                ? 'По вашему запросу ничего не найдено'
                : 'Нет заявок в этой категории'
            }
          />
        </TabsContent>
      </Tabs>

      {/* Claim Details Dialog */}
      <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
        <DialogContent className="max-w-lg">
          {selectedClaim && (
            <>
              <DialogHeader>
                <DialogTitle>Заявка #{selectedClaim.id.slice(0, 8)}</DialogTitle>
                <DialogDescription>
                  {selectedClaim.product_name} от {selectedClaim.customer_name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status and Priority */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Статус</p>
                    <ClaimStatusBadge status={selectedClaim.status} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Приоритет</p>
                    <PriorityBadge priority={selectedClaim.priority} />
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="font-medium mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Клиент
                  </p>
                  <div className="space-y-1 text-sm">
                    <p>{selectedClaim.customer_name}</p>
                    {selectedClaim.customer_email && (
                      <p className="text-muted-foreground">{selectedClaim.customer_email}</p>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Описание проблемы</p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">
                    {selectedClaim.description}
                  </p>
                </div>

                {/* Photos */}
                {selectedClaim.photos && selectedClaim.photos.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Фото ({selectedClaim.photos.length})
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {selectedClaim.photos.map((url, index) => (
                        <div
                          key={index}
                          className="aspect-square rounded-lg overflow-hidden bg-muted"
                        >
                          <img
                            src={url}
                            alt={`Фото ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  {selectedClaim.status === 'submitted' && (
                    <>
                      <Button
                        onClick={() => handleUpdateClaim({ status: 'under_review' })}
                        disabled={updating}
                      >
                        Взять в работу
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleUpdateClaim({ status: 'rejected' })}
                        disabled={updating}
                      >
                        Отклонить
                      </Button>
                    </>
                  )}

                  {selectedClaim.status === 'under_review' && (
                    <>
                      <Button
                        onClick={() => handleUpdateClaim({ status: 'approved' })}
                        disabled={updating}
                      >
                        Одобрить
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleUpdateClaim({ status: 'in_progress' })}
                        disabled={updating}
                      >
                        Начать работу
                      </Button>
                    </>
                  )}

                  {selectedClaim.status === 'approved' && (
                    <Button
                      onClick={() => handleUpdateClaim({ status: 'in_progress' })}
                      disabled={updating}
                    >
                      Начать работу
                    </Button>
                  )}

                  {selectedClaim.status === 'in_progress' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button disabled={updating}>
                          Завершить
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Результат</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.entries(RESOLUTION_TYPE_LABELS).map(([value, label]) => (
                          <DropdownMenuItem
                            key={value}
                            onClick={() =>
                              handleUpdateClaim({
                                status: 'resolved',
                                resolution_type: value as any,
                              })
                            }
                          >
                            {label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Priority Change */}
                  {!['resolved', 'closed', 'rejected'].includes(selectedClaim.status) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          Приоритет
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                          <DropdownMenuItem
                            key={value}
                            onClick={() =>
                              handleUpdateClaim({ priority: value as ClaimPriority })
                            }
                          >
                            {label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default OrganizationWarrantiesPage
