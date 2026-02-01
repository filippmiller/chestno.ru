/**
 * KioskProductDisplay Component
 *
 * Product trust information display for kiosk mode.
 * Shows verification status, certifications, reviews, and price comparison.
 */
import { useState } from 'react'
import {
  Award,
  CheckCircle,
  Clock,
  MapPin,
  Printer,
  Star,
  ThumbsUp,
  MessageSquare,
  Loader2,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { generatePrintSummary, submitKioskReview, kioskLoyaltySignup } from '@/api/kioskService'
import type { KioskConfig, KioskScanResult, StatusLevel } from '@/types/retail'

interface KioskProductDisplayProps {
  result: KioskScanResult
  config: KioskConfig
  sessionToken: string
  onClose?: () => void
}

const STATUS_CONFIG: Record<StatusLevel, { label: string; color: string; bgColor: string; description: string }> = {
  A: {
    label: 'Уровень A',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    description: 'Полная верификация производства',
  },
  B: {
    label: 'Уровень B',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    description: 'Базовая верификация',
  },
  C: {
    label: 'Уровень C',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    description: 'На стадии верификации',
  },
}

export function KioskProductDisplay({
  result,
  config,
  sessionToken,
  onClose,
}: KioskProductDisplayProps) {
  const [printing, setPrinting] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [showLoyaltyForm, setShowLoyaltyForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [loyaltyEmail, setLoyaltyEmail] = useState('')
  const [submittingLoyalty, setSubmittingLoyalty] = useState(false)
  const [loyaltySubmitted, setLoyaltySubmitted] = useState(false)

  const { product, priceComparison, reviews } = result
  const statusConfig = STATUS_CONFIG[product.statusLevel]

  // Handle print
  const handlePrint = async () => {
    setPrinting(true)
    try {
      const { print_url } = await generatePrintSummary(sessionToken, product.id)
      window.open(print_url, '_blank')
    } catch (err) {
      console.error('Print failed:', err)
    } finally {
      setPrinting(false)
    }
  }

  // Handle review submission
  const handleReviewSubmit = async () => {
    if (reviewRating === 0) return

    setSubmittingReview(true)
    try {
      await submitKioskReview(sessionToken, {
        product_id: product.id,
        rating: reviewRating,
        comment: reviewComment || undefined,
      })
      setReviewSubmitted(true)
    } catch (err) {
      console.error('Review submission failed:', err)
    } finally {
      setSubmittingReview(false)
    }
  }

  // Handle loyalty signup
  const handleLoyaltySignup = async () => {
    if (!loyaltyEmail) return

    setSubmittingLoyalty(true)
    try {
      await kioskLoyaltySignup(sessionToken, { email: loyaltyEmail })
      setLoyaltySubmitted(true)
    } catch (err) {
      console.error('Loyalty signup failed:', err)
    } finally {
      setSubmittingLoyalty(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Main Product Card */}
      <Card className="overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Product Image */}
          <div className="flex-shrink-0 lg:w-80">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-64 w-full object-cover lg:h-full"
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center bg-gray-100 lg:h-full">
                <Award className="h-24 w-24 text-gray-300" />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 p-6">
            {/* Status Badge */}
            <div className="mb-4 flex items-center gap-3">
              <Badge className={`${statusConfig.bgColor} ${statusConfig.color} px-3 py-1 text-sm`}>
                {statusConfig.label}
              </Badge>
              <div className="flex items-center gap-1">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm text-gray-600">Проверено</span>
              </div>
            </div>

            {/* Product Name */}
            <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
            {product.brand && (
              <p className="mt-1 text-lg text-gray-600">{product.brand}</p>
            )}

            {/* Trust Score */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Уровень доверия</span>
                <span className="text-lg font-bold">{product.trustScore}%</span>
              </div>
              <Progress value={product.trustScore} className="mt-2 h-3" />
            </div>

            {/* Details Grid */}
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-600">Дата проверки</p>
                  <p className="font-medium">
                    {new Date(product.verificationDate).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>

              {product.origin && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-gray-600">Происхождение</p>
                    <p className="font-medium">{product.origin}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Certifications */}
            {product.certifications.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Сертификаты</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.certifications.map((cert) => (
                    <Badge key={cert} variant="outline">
                      {cert}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Status Description */}
            <div className={`mt-4 rounded-lg ${statusConfig.bgColor} p-3`}>
              <p className={`text-sm ${statusConfig.color}`}>
                {statusConfig.description}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Price Comparison */}
        {config.features.priceComparison && priceComparison && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Сравнение цен</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {priceComparison.lowestPrice.toLocaleString('ru-RU')} ₽
                  </p>
                  <p className="text-sm text-gray-600">Минимум</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {priceComparison.currentPrice.toLocaleString('ru-RU')} ₽
                  </p>
                  <p className="text-sm text-gray-600">Здесь</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-400">
                    {priceComparison.averagePrice.toLocaleString('ru-RU')} ₽
                  </p>
                  <p className="text-sm text-gray-600">Средняя</p>
                </div>
              </div>

              {/* Price history mini chart */}
              {priceComparison.priceHistory.length > 0 && (
                <div className="h-16 flex items-end gap-1">
                  {priceComparison.priceHistory.slice(-14).map((point, i) => {
                    const max = Math.max(...priceComparison.priceHistory.map((p) => p.price))
                    const height = (point.price / max) * 100
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-primary/60 rounded-t"
                        style={{ height: `${height}%` }}
                        title={`${point.date}: ${point.price} ₽`}
                      />
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reviews */}
        {config.features.reviews && reviews && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Отзывы покупателей</span>
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold">{reviews.averageRating.toFixed(1)}</span>
                  <span className="text-sm text-gray-600">({reviews.totalReviews})</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {reviews.recentReviews.slice(0, 3).map((review, index) => (
                  <div key={index} className="border-b pb-3 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      {review.author && (
                        <span className="text-sm text-gray-600">{review.author}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-700 line-clamp-2">{review.text}</p>
                  </div>
                ))}
              </div>

              {/* Leave review button */}
              {!showReviewForm && !reviewSubmitted && (
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => setShowReviewForm(true)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Оставить отзыв
                </Button>
              )}

              {/* Review form */}
              {showReviewForm && !reviewSubmitted && (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="p-1"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            star <= reviewRating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Ваш комментарий (необязательно)"
                    className="w-full rounded-lg border p-3 text-sm"
                    rows={2}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowReviewForm(false)}
                      className="flex-1"
                    >
                      Отмена
                    </Button>
                    <Button
                      onClick={handleReviewSubmit}
                      disabled={reviewRating === 0 || submittingReview}
                      className="flex-1"
                    >
                      {submittingReview ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Отправить'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Review submitted */}
              {reviewSubmitted && (
                <div className="mt-4 rounded-lg bg-green-100 p-3 text-center">
                  <ThumbsUp className="mx-auto h-6 w-6 text-green-600" />
                  <p className="mt-1 text-sm text-green-700">Спасибо за отзыв!</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Ingredients */}
      {product.ingredients && product.ingredients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Состав</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              {product.ingredients.join(', ')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loyalty Signup */}
      {config.features.loyaltySignup && !loyaltySubmitted && (
        <Card className="bg-primary/5">
          <CardContent className="py-6">
            {!showLoyaltyForm ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">Программа лояльности Честно</p>
                    <p className="text-sm text-gray-600">
                      Получайте баллы за сканирование и отзывы
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowLoyaltyForm(true)}>
                  Присоединиться
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-medium">Введите email для регистрации</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="email@example.com"
                    className="flex-1 rounded-lg border p-3"
                    value={loyaltyEmail}
                    onChange={(e) => setLoyaltyEmail(e.target.value)}
                  />
                  <Button
                    onClick={handleLoyaltySignup}
                    disabled={!loyaltyEmail || submittingLoyalty}
                  >
                    {submittingLoyalty ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Готово'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loyaltySubmitted && (
        <Card className="bg-green-50">
          <CardContent className="py-4 text-center">
            <CheckCircle className="mx-auto h-8 w-8 text-green-600" />
            <p className="mt-2 font-medium text-green-700">
              Вы зарегистрированы в программе лояльности!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4">
        {config.features.printReceipt && (
          <Button variant="outline" size="lg" onClick={handlePrint} disabled={printing}>
            {printing ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Printer className="mr-2 h-5 w-5" />
            )}
            Распечатать
          </Button>
        )}
        <Button size="lg" onClick={onClose}>
          Сканировать другой товар
        </Button>
      </div>
    </div>
  )
}

export default KioskProductDisplay
