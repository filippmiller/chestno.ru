/**
 * ProductStoryViewer Page
 *
 * Full-screen story viewer page for consumers.
 * Accessed via /product/:slug/story
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { StoryViewer } from '@/components/product-stories'
import { getSupabaseClient } from '@/lib/supabaseClient'
import type { ProductStory, StoryChapter, StoryInteraction, QuizAnswer } from '@/types/product-stories'

const supabase = getSupabaseClient()

// Generate or get session ID for anonymous tracking
function getOrCreateSessionId(): string {
  const key = 'story_session_id'
  let sessionId = localStorage.getItem(key)
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem(key, sessionId)
  }
  return sessionId
}

// Get device type
function getDeviceType(): string {
  const ua = navigator.userAgent
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return 'mobile'
  return 'desktop'
}

export function ProductStoryViewerPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [story, setStory] = useState<ProductStory | null>(null)
  const [chapters, setChapters] = useState<StoryChapter[]>([])
  const [interaction, setInteraction] = useState<StoryInteraction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch story data
  useEffect(() => {
    async function fetchStory() {
      if (!slug) return

      try {
        setLoading(true)
        setError(null)

        // First, get product ID from slug
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id')
          .eq('slug', slug)
          .single()

        if (productError || !product) {
          setError('Продукт не найден')
          return
        }

        // Fetch story from API
        const response = await fetch(`/api/stories/product/${product.id}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('История не найдена')
          } else {
            setError('Ошибка загрузки истории')
          }
          return
        }

        const data = await response.json()

        if (!data || !data.story) {
          setError('История не найдена')
          return
        }

        setStory(data.story)
        setChapters(data.chapters || data.story.chapters || [])
        setInteraction(data.interaction)
      } catch (err) {
        console.error('Error fetching story:', err)
        setError('Ошибка загрузки истории')
      } finally {
        setLoading(false)
      }
    }

    fetchStory()
  }, [slug])

  // Track interaction
  const trackInteraction = useCallback(
    async (data: {
      chapter_index: number
      time_spent?: number
      quiz_answer?: QuizAnswer
      completed?: boolean
    }) => {
      if (!story) return

      try {
        await fetch(`/api/stories/${story.id}/interaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            story_id: story.id,
            session_id: getOrCreateSessionId(),
            chapter_index: data.chapter_index,
            time_spent: data.time_spent,
            quiz_answer: data.quiz_answer,
            completed: data.completed,
            device_type: getDeviceType(),
            referrer: document.referrer || null,
          }),
        })
      } catch (err) {
        console.warn('Failed to track interaction:', err)
      }
    },
    [story]
  )

  // Handle close
  const handleClose = useCallback(() => {
    // Navigate back to product page
    navigate(`/product/${slug}`)
  }, [navigate, slug])

  // Handle share
  const handleShare = useCallback(async () => {
    const url = window.location.href
    const title = story?.title || 'История продукта'

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url,
        })
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url)
        // TODO: Show toast notification
      } catch (err) {
        console.warn('Failed to copy URL:', err)
      }
    }
  }, [story])

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  // Error state
  if (error || !story || chapters.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white">
        <p className="text-lg mb-4">{error || 'История не найдена'}</p>
        <button
          onClick={handleClose}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        >
          Вернуться к продукту
        </button>
      </div>
    )
  }

  return (
    <StoryViewer
      story={story}
      chapters={chapters}
      interaction={interaction}
      onClose={handleClose}
      onTrackInteraction={trackInteraction}
      onShare={handleShare}
    />
  )
}

export default ProductStoryViewerPage
