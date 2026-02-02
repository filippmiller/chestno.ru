/**
 * OrganizationStoryEdit Page
 *
 * Page for creating or editing a product story.
 * Uses the StoryEditor component.
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StoryEditor } from '@/components/product-stories'
import { useAuthV2 } from '@/auth/AuthProviderV2'
import { getSupabaseClient } from '@/lib/supabaseClient'
import type {
  ProductStory,
  ProductStoryCreate,
  ProductStoryUpdate,
  StoryChapterCreate,
} from '@/types/product-stories'

const supabase = getSupabaseClient()

interface Product {
  id: string
  name: string
  slug: string
  main_image_url?: string
}

export function OrganizationStoryEditPage() {
  const { storyId } = useParams<{ storyId?: string }>()
  const navigate = useNavigate()
  const { organizationId } = useAuthV2()

  const isEditing = !!storyId && storyId !== 'new'

  const [story, setStory] = useState<ProductStory | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch products and story (if editing)
  useEffect(() => {
    async function fetchData() {
      if (!organizationId) return

      try {
        setLoading(true)
        setError(null)

        // Fetch products
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, name, slug, main_image_url')
          .eq('organization_id', organizationId)
          .order('name')

        if (productsError) {
          throw productsError
        }

        setProducts(
          productsData?.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            image: p.main_image_url,
          })) || []
        )

        // Fetch story if editing
        if (isEditing) {
          const response = await fetch(
            `/api/organizations/${organizationId}/stories/${storyId}`,
            { credentials: 'include' }
          )

          if (!response.ok) {
            throw new Error('Failed to fetch story')
          }

          const storyData = await response.json()
          setStory(storyData)
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Ошибка загрузки данных')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId, isEditing, storyId])

  // Save handler
  const handleSave = useCallback(
    async (
      data: ProductStoryCreate | ProductStoryUpdate,
      chapters: StoryChapterCreate[]
    ) => {
      if (!organizationId) return

      try {
        setSaving(true)

        if (isEditing) {
          // Update story
          const response = await fetch(
            `/api/organizations/${organizationId}/stories/${storyId}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(data),
            }
          )

          if (!response.ok) {
            throw new Error('Failed to update story')
          }

          const updatedStory = await response.json()

          // Update chapters
          // First, get existing chapters
          const existingChapters = story?.chapters || []

          // Delete removed chapters
          for (const existing of existingChapters) {
            const stillExists = chapters.some(
              (ch, idx) =>
                idx === existing.order_index &&
                ch.content_type === existing.content_type
            )
            if (!stillExists) {
              await fetch(
                `/api/organizations/${organizationId}/stories/${storyId}/chapters/${existing.id}`,
                {
                  method: 'DELETE',
                  credentials: 'include',
                }
              )
            }
          }

          // Update or create chapters
          for (let i = 0; i < chapters.length; i++) {
            const chapterData = { ...chapters[i], order_index: i }
            const existingChapter = existingChapters.find(
              (ch) => ch.order_index === i
            )

            if (existingChapter) {
              // Update
              await fetch(
                `/api/organizations/${organizationId}/stories/${storyId}/chapters/${existingChapter.id}`,
                {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify(chapterData),
                }
              )
            } else {
              // Create
              await fetch(
                `/api/organizations/${organizationId}/stories/${storyId}/chapters`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify(chapterData),
                }
              )
            }
          }

          // Navigate to story detail
          navigate(`/dashboard/organization/stories/${storyId}`)
        } else {
          // Create new story with chapters
          const createData = {
            ...(data as ProductStoryCreate),
            chapters,
          }

          const response = await fetch(
            `/api/organizations/${organizationId}/stories`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(createData),
            }
          )

          if (!response.ok) {
            throw new Error('Failed to create story')
          }

          const newStory = await response.json()

          // Navigate to new story
          navigate(`/dashboard/organization/stories/${newStory.id}`)
        }
      } catch (err) {
        console.error('Error saving story:', err)
        alert('Ошибка сохранения истории')
      } finally {
        setSaving(false)
      }
    },
    [organizationId, isEditing, storyId, story, navigate]
  )

  // Publish handler
  const handlePublish = useCallback(async () => {
    if (!organizationId || !storyId) return

    try {
      setSaving(true)

      const response = await fetch(
        `/api/organizations/${organizationId}/stories/${storyId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'published' }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to publish story')
      }

      // Refresh story
      const storyResponse = await fetch(
        `/api/organizations/${organizationId}/stories/${storyId}`,
        { credentials: 'include' }
      )
      const updatedStory = await storyResponse.json()
      setStory(updatedStory)

      alert('История успешно опубликована!')
    } catch (err) {
      console.error('Error publishing story:', err)
      alert('Ошибка публикации истории')
    } finally {
      setSaving(false)
    }
  }, [organizationId, storyId])

  // Cancel handler
  const handleCancel = useCallback(() => {
    navigate('/dashboard/organization/stories')
  }, [navigate])

  if (!organizationId) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Для работы с историями необходимо выбрать организацию.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container py-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <h3 className="font-semibold mb-2">Нет продуктов</h3>
            <p className="text-muted-foreground mb-4">
              Для создания истории сначала добавьте продукты в каталог.
            </p>
            <button
              onClick={() => navigate('/dashboard/organization/products')}
              className="text-primary hover:underline"
            >
              Перейти к продуктам
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <StoryEditor
        story={story || undefined}
        organizationId={organizationId}
        products={products}
        onSave={handleSave}
        onPublish={isEditing && story?.status === 'draft' ? handlePublish : undefined}
        onCancel={handleCancel}
        isSaving={saving}
      />
    </div>
  )
}

export default OrganizationStoryEditPage
