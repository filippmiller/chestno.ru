import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit, Pin } from 'lucide-react'

import { listOrganizationPosts } from '@/api/postsService'
import type { OrganizationPost } from '@/types/posts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUserStore } from '@/store/userStore'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  published: 'Опубликовано',
  archived: 'Архив',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive'> = {
  draft: 'secondary',
  published: 'default',
  archived: 'destructive',
}

export const OrganizationPostsPage = () => {
  const { selectedOrganizationId } = useUserStore()
  const [posts, setPosts] = useState<OrganizationPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPosts = async () => {
    if (!selectedOrganizationId) return

    setLoading(true)
    setError(null)
    try {
      const response = await listOrganizationPosts(selectedOrganizationId, {
        limit: 50,
        offset: 0,
      })
      setPosts(response.items)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить посты')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrganizationId])

  if (!selectedOrganizationId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <Alert>
          <AlertDescription>Выберите организацию</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Новости и посты</h1>
          <p className="text-muted-foreground">Управляйте новостями и публикациями вашей организации</p>
        </div>
        <Button asChild>
          <Link to={`/dashboard/organization/posts/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Создать пост
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">Пока нет постов. Создайте первый!</p>
            <Button asChild className="mt-4">
              <Link to={`/dashboard/organization/posts/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Создать пост
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {post.is_pinned && <Pin className="h-4 w-4 text-yellow-500" />}
                      <CardTitle className="text-xl">{post.title}</CardTitle>
                    </div>
                    <CardDescription className="mt-1">
                      {post.excerpt || post.body.substring(0, 100) + '...'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANTS[post.status]}>{STATUS_LABELS[post.status]}</Badge>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/dashboard/organization/posts/${post.id}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Редактировать
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {post.published_at && (
                    <span>Опубликовано: {new Date(post.published_at).toLocaleDateString('ru-RU')}</span>
                  )}
                  <span>Создано: {new Date(post.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

