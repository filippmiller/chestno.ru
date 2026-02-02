/**
 * OrganizationStories Page
 *
 * Business dashboard for managing product stories.
 * Lists all stories, allows creating new ones, and shows analytics.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Loader2,
  BarChart3,
  Eye,
  Clock,
  TrendingUp,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StoryCard } from '@/components/product-stories'
import { useAuthV2 } from '@/auth/AuthProviderV2'
import type {
  ProductStory,
  StoryStatus,
  OrganizationStoriesAnalytics,
} from '@/types/product-stories'

export function OrganizationStoriesPage() {
  const navigate = useNavigate()
  const { organizationId } = useAuthV2()

  const [stories, setStories] = useState<ProductStory[]>([])
  const [analytics, setAnalytics] = useState<OrganizationStoriesAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StoryStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Fetch stories
  useEffect(() => {
    async function fetchData() {
      if (!organizationId) return

      try {
        setLoading(true)
        setError(null)

        // Build URL with filters
        const params = new URLSearchParams({
          page: page.toString(),
          per_page: '12',
        })
        if (statusFilter !== 'all') {
          params.append('status', statusFilter)
        }

        // Fetch stories
        const storiesResponse = await fetch(
          `/api/organizations/${organizationId}/stories?${params}`,
          { credentials: 'include' }
        )

        if (!storiesResponse.ok) {
          throw new Error('Failed to fetch stories')
        }

        const storiesData = await storiesResponse.json()
        setStories(storiesData.stories || [])
        setTotalPages(Math.ceil((storiesData.total || 0) / 12))

        // Fetch analytics
        const analyticsResponse = await fetch(
          `/api/organizations/${organizationId}/stories/analytics`,
          { credentials: 'include' }
        )

        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json()
          setAnalytics(analyticsData)
        }
      } catch (err) {
        console.error('Error fetching stories:', err)
        setError('Ошибка загрузки историй')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, statusFilter, page])

  // Delete story handler
  const handleDelete = async (storyId: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту историю?')) return

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/stories/${storyId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      if (response.ok) {
        setStories((prev) => prev.filter((s) => s.id !== storyId))
      } else {
        alert('Ошибка удаления истории')
      }
    } catch (err) {
      console.error('Error deleting story:', err)
      alert('Ошибка удаления истории')
    }
  }

  // Format duration
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  if (!organizationId) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Для управления историями необходимо выбрать организацию.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Истории продуктов</h1>
          <p className="text-muted-foreground">
            Создавайте увлекательные истории о ваших продуктах и производстве
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard/organization/stories/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Создать историю
        </Button>
      </div>

      {/* Analytics cards */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Всего историй</p>
                  <p className="text-2xl font-bold">
                    {analytics.total_stories}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({analytics.published_stories} опубл.)
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                  <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Просмотры</p>
                  <p className="text-2xl font-bold">{analytics.total_views.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Завершения</p>
                  <p className="text-2xl font-bold">
                    {analytics.avg_completion_rate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Среднее время</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(analytics.avg_time_spent_seconds)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Фильтр:</span>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value: StoryStatus | 'all') => {
            setStatusFilter(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="draft">Черновики</SelectItem>
            <SelectItem value="published">Опубликованные</SelectItem>
            <SelectItem value="archived">В архиве</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stories grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="mt-4"
            >
              Попробовать снова
            </Button>
          </CardContent>
        </Card>
      ) : stories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Историй пока нет</h3>
            <p className="text-muted-foreground mb-4">
              {statusFilter !== 'all'
                ? 'Нет историй с выбранным статусом'
                : 'Создайте первую историю о вашем продукте'}
            </p>
            {statusFilter === 'all' && (
              <Button onClick={() => navigate('/dashboard/organization/stories/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Создать историю
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onClick={() =>
                  navigate(`/dashboard/organization/stories/${story.id}`)
                }
                showEditControls
                onEdit={() =>
                  navigate(`/dashboard/organization/stories/${story.id}/edit`)
                }
                onDelete={() => handleDelete(story.id)}
                size="lg"
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                Страница {page} из {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Вперед
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default OrganizationStoriesPage
