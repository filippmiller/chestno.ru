import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Pin, Calendar } from 'lucide-react'

import { listPublicOrganizationPosts, getPublicOrganizationPost } from '@/api/postsService'
import { fetchPublicOrganization } from '@/api/authService'
import type { PublicOrganizationPost } from '@/types/posts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export const PublicOrganizationPostsPage = () => {
  const { slug, postSlug } = useParams<{ slug: string; postSlug?: string }>()
  const [posts, setPosts] = useState<PublicOrganizationPost[]>([])
  const [selectedPost, setSelectedPost] = useState<PublicOrganizationPost | null>(null)
  const [organizationName, setOrganizationName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 10

  useEffect(() => {
    if (!slug) return

    setLoading(true)
    setError(null)

    const fetchData = async () => {
      try {
        // Fetch organization name
        const org = await fetchPublicOrganization(slug)
        setOrganizationName(org.name)

        if (postSlug) {
          // Fetch specific post
          const post = await getPublicOrganizationPost(slug, postSlug)
          setSelectedPost(post)
        } else {
          // Fetch posts list
          const response = await listPublicOrganizationPosts(slug, { limit, offset })
          setPosts(response.items)
          setTotal(response.total)
        }
      } catch (err) {
        console.error(err)
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [slug, postSlug, offset])

  if (!slug) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert>
          <AlertDescription>Организация не найдена</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // Single post view
  if (selectedPost) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          to={`/org/${slug}/posts`}
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Все публикации
        </Link>

        <article className="space-y-6">
          {selectedPost.main_image_url && (
            <img
              src={selectedPost.main_image_url}
              alt={selectedPost.title}
              className="w-full rounded-lg object-cover"
              style={{ maxHeight: '400px' }}
            />
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(selectedPost.published_at)}
              </span>
              {selectedPost.is_pinned && (
                <span className="flex items-center gap-1 text-primary">
                  <Pin className="h-4 w-4" />
                  Закреплено
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold">{selectedPost.title}</h1>
          </div>

          {selectedPost.excerpt && (
            <p className="text-lg text-muted-foreground">{selectedPost.excerpt}</p>
          )}

          <div
            className="prose max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: selectedPost.body }}
          />

          {selectedPost.gallery && selectedPost.gallery.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Галерея</h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {selectedPost.gallery.map((item, index) => (
                  <img
                    key={index}
                    src={item.url}
                    alt={item.alt || `Изображение ${index + 1}`}
                    className="aspect-square rounded-lg object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {selectedPost.video_url && (
            <div className="aspect-video">
              <iframe
                src={selectedPost.video_url}
                className="h-full w-full rounded-lg"
                allowFullScreen
              />
            </div>
          )}
        </article>
      </div>
    )
  }

  // Posts list view
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <Link
          to={`/org/${slug}`}
          className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Назад к профилю
        </Link>
        <h1 className="text-3xl font-bold">{organizationName}</h1>
        <p className="text-muted-foreground">Публикации и новости</p>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">Пока нет публикаций</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Link key={post.id} to={`/org/${slug}/posts/${post.slug}`}>
              <Card className="overflow-hidden transition-shadow hover:shadow-md">
                <div className="flex flex-col md:flex-row">
                  {post.main_image_url && (
                    <div className="w-full md:w-48 md:flex-shrink-0">
                      <img
                        src={post.main_image_url}
                        alt={post.title}
                        className="h-48 w-full object-cover md:h-full"
                      />
                    </div>
                  )}
                  <div className="flex-1 p-4">
                    <CardHeader className="p-0 pb-2">
                      <div className="flex items-center gap-2">
                        {post.is_pinned && (
                          <Pin className="h-4 w-4 text-primary" />
                        )}
                        <CardTitle className="text-lg">{post.title}</CardTitle>
                      </div>
                      <CardDescription className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(post.published_at)}
                      </CardDescription>
                    </CardHeader>
                    {post.excerpt && (
                      <CardContent className="p-0">
                        <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                      </CardContent>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {total > limit && (
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Назад
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                {Math.floor(offset / limit) + 1} / {Math.ceil(total / limit)}
              </span>
              <Button
                variant="outline"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
              >
                Далее
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
