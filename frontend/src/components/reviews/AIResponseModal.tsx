import { useState } from 'react'
import { Sparkles, Copy, Check, ThumbsUp, ThumbsDown, Minus, Loader2 } from 'lucide-react'

import { generateAIResponse } from '@/api/reviewsService'
import type { AIResponseResult, AIResponseSuggestion, ReviewSentiment, ResponseTone } from '@/types/reviews'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface AIResponseModalProps {
  organizationId: string
  reviewId: string
  reviewTitle?: string | null
  onSelectResponse: (text: string) => void
}

const SENTIMENT_LABELS: Record<ReviewSentiment, string> = {
  positive: 'Положительный',
  neutral: 'Нейтральный',
  negative: 'Негативный',
}

const SENTIMENT_ICONS: Record<ReviewSentiment, typeof ThumbsUp> = {
  positive: ThumbsUp,
  neutral: Minus,
  negative: ThumbsDown,
}

const SENTIMENT_COLORS: Record<ReviewSentiment, string> = {
  positive: 'bg-green-100 text-green-800 border-green-200',
  neutral: 'bg-gray-100 text-gray-800 border-gray-200',
  negative: 'bg-red-100 text-red-800 border-red-200',
}

const TONE_LABELS: Record<ResponseTone, string> = {
  professional: 'Профессиональный',
  friendly: 'Дружелюбный',
  apologetic: 'Извинительный',
}

const TONE_COLORS: Record<ResponseTone, string> = {
  professional: 'bg-blue-100 text-blue-800',
  friendly: 'bg-purple-100 text-purple-800',
  apologetic: 'bg-amber-100 text-amber-800',
}

export function AIResponseModal({
  organizationId,
  reviewId,
  reviewTitle,
  onSelectResponse,
}: AIResponseModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AIResponseResult | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen)

    if (isOpen && !result) {
      setLoading(true)
      setError(null)

      try {
        const response = await generateAIResponse(organizationId, reviewId)
        setResult(response)
      } catch (err) {
        console.error('Failed to generate AI response:', err)
        setError('Не удалось сгенерировать ответ. Попробуйте позже.')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleSelectResponse = (suggestion: AIResponseSuggestion) => {
    onSelectResponse(suggestion.text)
    setOpen(false)
  }

  const handleCopyResponse = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleRegenerate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await generateAIResponse(organizationId, reviewId)
      setResult(response)
    } catch (err) {
      console.error('Failed to regenerate AI response:', err)
      setError('Не удалось сгенерировать ответ. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">AI ответ</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-помощник для ответа на отзыв
          </DialogTitle>
          <DialogDescription>
            {reviewTitle ? `Отзыв: "${reviewTitle}"` : 'Выберите подходящий вариант ответа или используйте его как основу'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Анализируем отзыв и генерируем варианты ответа...</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRegenerate} className="mt-3">
                Попробовать снова
              </Button>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Sentiment and Topics */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Тональность:</span>
                    {(() => {
                      const SentimentIcon = SENTIMENT_ICONS[result.sentiment]
                      return (
                        <Badge
                          variant="outline"
                          className={`gap-1 ${SENTIMENT_COLORS[result.sentiment]}`}
                        >
                          <SentimentIcon className="h-3 w-3" />
                          {SENTIMENT_LABELS[result.sentiment]}
                        </Badge>
                      )
                    })()}
                  </div>

                  {result.topics.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Темы:</span>
                      <div className="flex flex-wrap gap-1">
                        {result.topics.map((topic, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Response Suggestions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Варианты ответа</h4>
                  <Button variant="ghost" size="sm" onClick={handleRegenerate} className="h-8 gap-1.5 text-xs">
                    <Sparkles className="h-3 w-3" />
                    Сгенерировать заново
                  </Button>
                </div>

                {result.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="group relative rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge className={TONE_COLORS[suggestion.tone]}>
                        {TONE_LABELS[suggestion.tone]}
                      </Badge>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopyResponse(suggestion.text, index)}
                          title="Скопировать"
                        >
                          {copiedIndex === index ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-foreground">{suggestion.text}</p>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Уверенность: {Math.round(suggestion.confidence * 100)}%
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleSelectResponse(suggestion)}
                        className="h-8"
                      >
                        Использовать
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Совет: вы можете отредактировать выбранный ответ перед отправкой
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
