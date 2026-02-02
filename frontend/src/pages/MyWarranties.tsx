import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import {
  WarrantyCard,
  WarrantyClaimsList,
  WarrantyClaimForm,
} from '@/components/warranty'
import { getMyWarranties, getMyClaims } from '@/api/warrantyService'
import type {
  WarrantyRegistrationWithProduct,
  WarrantyClaimWithDetails,
  WarrantyStatus,
} from '@/types/warranty'

type TabValue = 'active' | 'expired' | 'claims'

export function MyWarrantiesPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabValue>('active')
  const [warranties, setWarranties] = useState<WarrantyRegistrationWithProduct[]>([])
  const [claims, setClaims] = useState<WarrantyClaimWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Claim form dialog
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)
  const [selectedWarrantyForClaim, setSelectedWarrantyForClaim] =
    useState<WarrantyRegistrationWithProduct | null>(null)

  const loadWarranties = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [warrantiesRes, claimsRes] = await Promise.all([
        getMyWarranties({ per_page: 100 }),
        getMyClaims({ per_page: 50 }),
      ])

      setWarranties(warrantiesRes.items)
      setClaims(claimsRes.items)
    } catch (err: any) {
      console.error('Failed to load warranties:', err)
      setError('Не удалось загрузить гарантии. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWarranties()
  }, [loadWarranties])

  // Filter warranties based on tab and search
  const filteredWarranties = warranties.filter((w) => {
    // Tab filter
    if (activeTab === 'active' && w.status !== 'active') return false
    if (activeTab === 'expired' && w.status === 'active') return false

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        w.product_name?.toLowerCase().includes(query) ||
        w.organization_name?.toLowerCase().includes(query) ||
        w.serial_number?.toLowerCase().includes(query)
      )
    }

    return true
  })

  // Stats
  const activeCount = warranties.filter((w) => w.status === 'active').length
  const expiringSoonCount = warranties.filter(
    (w) => w.status === 'active' && w.days_remaining !== undefined && w.days_remaining <= 30
  ).length
  const expiredCount = warranties.filter((w) => w.status !== 'active').length
  const pendingClaimsCount = claims.filter(
    (c) => !['resolved', 'closed', 'rejected'].includes(c.status)
  ).length

  const handleViewDetails = (warrantyId: string) => {
    navigate(`/warranty/${warrantyId}`)
  }

  const handleSubmitClaim = (warrantyId: string) => {
    const warranty = warranties.find((w) => w.id === warrantyId)
    if (warranty) {
      setSelectedWarrantyForClaim(warranty)
      setClaimDialogOpen(true)
    }
  }

  const handleClaimSuccess = () => {
    setClaimDialogOpen(false)
    setSelectedWarrantyForClaim(null)
    loadWarranties() // Refresh data
  }

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Мои гарантии
          </h1>
          <p className="text-muted-foreground mt-1">
            Управление гарантиями на ваши товары
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Активных</p>
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
                <p className="text-2xl font-bold">{expiringSoonCount}</p>
                <p className="text-xs text-muted-foreground">Истекают</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiredCount}</p>
                <p className="text-xs text-muted-foreground">Истекших</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingClaimsCount}</p>
                <p className="text-xs text-muted-foreground">Заявок</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию товара или производителю..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="mb-4">
          <TabsTrigger value="active">
            Активные
            {activeCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
                {activeCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="expired">
            Истекшие
            {expiredCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                {expiredCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="claims">
            Заявки
            {pendingClaimsCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                {pendingClaimsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {filteredWarranties.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Нет активных гарантий</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? 'По вашему запросу ничего не найдено'
                  : 'Зарегистрируйте гарантию, отсканировав QR-код на товаре'}
              </p>
            </div>
          ) : (
            filteredWarranties.map((warranty) => (
              <WarrantyCard
                key={warranty.id}
                warranty={warranty}
                onViewDetails={handleViewDetails}
                onSubmitClaim={handleSubmitClaim}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="expired" className="space-y-4">
          {filteredWarranties.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Нет истекших гарантий</h3>
              <p className="text-sm text-muted-foreground">
                Здесь будут отображаться гарантии с истекшим сроком
              </p>
            </div>
          ) : (
            filteredWarranties.map((warranty) => (
              <WarrantyCard
                key={warranty.id}
                warranty={warranty}
                onViewDetails={handleViewDetails}
                showActions={false}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="claims">
          <WarrantyClaimsList
            claims={claims}
            emptyMessage="У вас пока нет гарантийных заявок"
          />
        </TabsContent>
      </Tabs>

      {/* Claim Form Dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="max-w-md">
          {selectedWarrantyForClaim && (
            <WarrantyClaimForm
              registrationId={selectedWarrantyForClaim.id}
              productName={selectedWarrantyForClaim.product_name || undefined}
              onSuccess={handleClaimSuccess}
              onCancel={() => setClaimDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MyWarrantiesPage
