import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  Heart,
  Settings,
  Search,
  LayoutGrid,
  List,
  Package,
  Building2,
  Calendar,
  Trash2,
  ExternalLink,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NotificationPreferencesModal } from '@/components/follow/NotificationPreferencesModal'
import type { FollowedItem, NotificationPreferences } from '@/types/product'

// Mock data for demonstration
const mockFollowedItems: FollowedItem[] = [
  {
    id: '1',
    type: 'product',
    name: 'Мед цветочный органический',
    slug: 'organic-honey-flower',
    image_url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400',
    followed_at: '2024-01-15T10:30:00Z',
    organization_name: 'Алтайская пасека',
    last_update: '2024-01-20T14:00:00Z',
  },
  {
    id: '2',
    type: 'organization',
    name: 'Алтайская пасека',
    slug: 'altai-paseka',
    image_url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400',
    followed_at: '2024-01-10T08:00:00Z',
    last_update: '2024-01-22T09:30:00Z',
  },
  {
    id: '3',
    type: 'product',
    name: 'Сыр Российский выдержанный',
    slug: 'russian-cheese-aged',
    image_url: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400',
    followed_at: '2024-01-18T16:45:00Z',
    organization_name: 'Молочная ферма "Рассвет"',
    last_update: null,
  },
  {
    id: '4',
    type: 'organization',
    name: 'Молочная ферма "Рассвет"',
    slug: 'dairy-farm-rassvet',
    image_url: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=400',
    followed_at: '2024-01-05T12:00:00Z',
    last_update: '2024-01-21T11:15:00Z',
  },
]

const defaultNotificationPrefs: NotificationPreferences = {
  email_enabled: true,
  push_enabled: false,
  digest_frequency: 'daily',
  notify_price_drops: true,
  notify_new_products: true,
  notify_stories: true,
  notify_certifications: false,
}

type ViewMode = 'grid' | 'list'
type FilterType = 'all' | 'products' | 'organizations'

export function MySubscriptionsPage() {
  const [items, setItems] = useState<FollowedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<FollowedItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<FollowedItem | null>(null)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(defaultNotificationPrefs)

  useEffect(() => {
    const loadSubscriptions = async () => {
      setLoading(true)
      setError(null)

      try {
        // TODO: Replace with actual API call
        // const data = await fetchUserSubscriptions()
        await new Promise((resolve) => setTimeout(resolve, 500))
        setItems(mockFollowedItems)
      } catch (err) {
        console.error(err)
        setError('Не удалось загрузить подписки')
      } finally {
        setLoading(false)
      }
    }

    void loadSubscriptions()
  }, [])

  const handleUnfollow = useCallback(async (item: FollowedItem) => {
    // TODO: Replace with actual API call
    // await unfollowItem(item.id, item.type)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setDeleteDialogOpen(false)
    setItemToDelete(null)
  }, [])

  const handleSaveNotificationPrefs = useCallback(async (prefs: NotificationPreferences) => {
    // TODO: Replace with actual API call
    // await updateNotificationPreferences(selectedItem?.id, prefs)
    setNotificationPrefs(prefs)
    console.log('Saved notification preferences:', prefs)
  }, [])

  const filteredItems = items.filter((item) => {
    // Filter by type
    if (filterType === 'products' && item.type !== 'product') return false
    if (filterType === 'organizations' && item.type !== 'organization') return false

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        item.name.toLowerCase().includes(query) ||
        item.organization_name?.toLowerCase().includes(query)
      )
    }

    return true
  })

  const productCount = items.filter((i) => i.type === 'product').length
  const orgCount = items.filter((i) => i.type === 'organization').length

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-64 bg-muted rounded" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Мои подписки</h1>
            <p className="text-muted-foreground mt-1">
              Отслеживайте обновления от любимых производителей и товаров
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedItem(null)
              setNotifModalOpen(true)
            }}
          >
            <Bell className="mr-2 h-4 w-4" />
            Настройки уведомлений
          </Button>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            <Heart className="mr-1.5 h-3.5 w-3.5" />
            Всего: {items.length}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Package className="mr-1.5 h-3.5 w-3.5" />
            Товаров: {productCount}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Производителей: {orgCount}
          </Badge>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filterType}
          onValueChange={(v) => setFilterType(v as FilterType)}
          className="w-full sm:w-auto"
        >
          <TabsList>
            <TabsTrigger value="all">Все ({items.length})</TabsTrigger>
            <TabsTrigger value="products">Товары ({productCount})</TabsTrigger>
            <TabsTrigger value="organizations">Производители ({orgCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Heart className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">
              {searchQuery ? 'Ничего не найдено' : 'У вас пока нет подписок'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery
                ? 'Попробуйте изменить поисковый запрос'
                : 'Подписывайтесь на товары и производителей, чтобы получать уведомления об обновлениях'}
            </p>
            {!searchQuery && (
              <Button asChild className="mt-4">
                <Link to="/products">Найти товары</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grid View */}
      {filteredItems.length > 0 && viewMode === 'grid' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <SubscriptionGridCard
              key={item.id}
              item={item}
              onSettings={() => {
                setSelectedItem(item)
                setNotifModalOpen(true)
              }}
              onUnfollow={() => {
                setItemToDelete(item)
                setDeleteDialogOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {filteredItems.length > 0 && viewMode === 'list' && (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <SubscriptionListItem
              key={item.id}
              item={item}
              onSettings={() => {
                setSelectedItem(item)
                setNotifModalOpen(true)
              }}
              onUnfollow={() => {
                setItemToDelete(item)
                setDeleteDialogOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {/* Notification Preferences Modal */}
      <NotificationPreferencesModal
        open={notifModalOpen}
        onOpenChange={setNotifModalOpen}
        preferences={notificationPrefs}
        onSave={handleSaveNotificationPrefs}
        targetName={selectedItem?.name}
        targetType={selectedItem?.type ?? 'product'}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отписаться?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите отписаться от "{itemToDelete?.name}"?
              Вы перестанете получать уведомления об обновлениях.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => itemToDelete && handleUnfollow(itemToDelete)}
            >
              Отписаться
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface SubscriptionCardProps {
  item: FollowedItem
  onSettings: () => void
  onUnfollow: () => void
}

function SubscriptionGridCard({ item, onSettings, onUnfollow }: SubscriptionCardProps) {
  const linkUrl = item.type === 'product' ? `/product/${item.slug}` : `/org/${item.slug}`
  const TypeIcon = item.type === 'product' ? Package : Building2

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-md">
      <CardContent className="p-0">
        {/* Image */}
        <Link to={linkUrl}>
          <div className="relative aspect-[16/10] overflow-hidden bg-muted">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <TypeIcon className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
            <Badge
              variant="secondary"
              className="absolute bottom-2 left-2 bg-white/90 dark:bg-black/70 text-xs"
            >
              <TypeIcon className="mr-1 h-3 w-3" />
              {item.type === 'product' ? 'Товар' : 'Производитель'}
            </Badge>
          </div>
        </Link>

        {/* Content */}
        <div className="p-4 space-y-2">
          <Link to={linkUrl} className="block">
            <h3 className="font-semibold line-clamp-1 hover:text-primary transition-colors">
              {item.name}
            </h3>
          </Link>
          {item.organization_name && item.type === 'product' && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {item.organization_name}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatRelativeDate(item.followed_at)}
            </span>
            {item.last_update && (
              <span className="text-primary">Обновлено</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Действия</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={linkUrl}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Открыть
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSettings}>
                <Bell className="mr-2 h-4 w-4" />
                Уведомления
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onUnfollow} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Отписаться
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}

function SubscriptionListItem({ item, onSettings, onUnfollow }: SubscriptionCardProps) {
  const linkUrl = item.type === 'product' ? `/product/${item.slug}` : `/org/${item.slug}`
  const TypeIcon = item.type === 'product' ? Package : Building2

  return (
    <Card className="group">
      <CardContent className="flex items-center gap-4 p-4">
        {/* Image */}
        <Link to={linkUrl} className="shrink-0">
          <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-muted">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <TypeIcon className="h-6 w-6 text-muted-foreground/30" />
              </div>
            )}
          </div>
        </Link>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] shrink-0">
              {item.type === 'product' ? 'Товар' : 'Производитель'}
            </Badge>
            {item.last_update && (
              <Badge className="bg-primary/10 text-primary text-[10px]">
                Обновлено
              </Badge>
            )}
          </div>
          <Link to={linkUrl}>
            <h3 className="font-semibold mt-1 truncate hover:text-primary transition-colors">
              {item.name}
            </h3>
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {item.organization_name && (
              <span className="truncate">{item.organization_name}</span>
            )}
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              {formatRelativeDate(item.followed_at)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onSettings}>
            <Bell className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onUnfollow}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
