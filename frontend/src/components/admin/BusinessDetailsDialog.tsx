import { useEffect, useState } from 'react'
import { getAdminOrganizationDetails, updateAdminOrganizationDetails } from '@/api/authService'
import { listAllReviews, adminModerateReview } from '@/api/reviewsService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { Review, ReviewModeration } from '@/types/reviews'

interface BusinessDetailsDialogProps {
    organizationId: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpdate?: () => void
}

export const BusinessDetailsDialog = ({ organizationId, open, onOpenChange, onUpdate }: BusinessDetailsDialogProps) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<any>(null)
    const [reviews, setReviews] = useState<Review[]>([])
    const [reviewsLoading, setReviewsLoading] = useState(false)
    const [formData, setFormData] = useState<any>({})

    useEffect(() => {
        if (organizationId && open) {
            loadDetails()
            loadReviews()
        }
    }, [organizationId, open])

    const loadDetails = async () => {
        if (!organizationId) return
        setLoading(true)
        setError(null)
        try {
            const details = await getAdminOrganizationDetails(organizationId)
            setData(details)
            setFormData({
                ...details.organization,
                ...details.profile,
            })
        } catch (err) {
            console.error(err)
            setError('Не удалось загрузить детали организации')
        } finally {
            setLoading(false)
        }
    }

    const loadReviews = async () => {
        if (!organizationId) return
        setReviewsLoading(true)
        try {
            const response = await listAllReviews({
                organization_id: organizationId,
                limit: 50,
                offset: 0,
            })
            setReviews(response.items)
        } catch (err) {
            console.error(err)
        } finally {
            setReviewsLoading(false)
        }
    }

    const handleSave = async () => {
        if (!organizationId) return
        setLoading(true)
        setError(null)
        try {
            await updateAdminOrganizationDetails(organizationId, formData)
            await loadDetails()
            onUpdate?.()
        } catch (err) {
            console.error(err)
            setError('Не удалось обновить организацию')
        } finally {
            setLoading(false)
        }
    }

    const handleModerate = async (reviewId: string, status: 'approved' | 'rejected') => {
        const comment = window.prompt('Комментарий к решению', '')
        if (comment === null) return

        setReviewsLoading(true)
        try {
            const payload: ReviewModeration = {
                status,
                moderation_comment: comment || undefined,
            }
            await adminModerateReview(reviewId, payload)
            await loadReviews()
        } catch (err) {
            console.error(err)
        } finally {
            setReviewsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Business Details</DialogTitle>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Ошибка</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {loading && !data && <p className="text-sm text-muted-foreground">Загружаем...</p>}

                {data && (
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList>
                            <TabsTrigger value="general">General</TabsTrigger>
                            <TabsTrigger value="owners">Owners</TabsTrigger>
                            <TabsTrigger value="reviews">Reviews</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <Label htmlFor="name">Название</Label>
                                    <Input
                                        id="name"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="slug">Slug</Label>
                                    <Input
                                        id="slug"
                                        value={formData.slug || ''}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="country">Страна</Label>
                                    <Input
                                        id="country"
                                        value={formData.country || ''}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="city">Город</Label>
                                    <Input
                                        id="city"
                                        value={formData.city || ''}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="website_url">Вебсайт</Label>
                                    <Input
                                        id="website_url"
                                        value={formData.website_url || ''}
                                        onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="phone">Телефон</Label>
                                    <Input
                                        id="phone"
                                        value={formData.phone || ''}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="short_description">Короткое описание</Label>
                                <Textarea
                                    id="short_description"
                                    value={formData.short_description || ''}
                                    onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                                    rows={3}
                                />
                            </div>

                            <div>
                                <Label htmlFor="long_description">Полное описание</Label>
                                <Textarea
                                    id="long_description"
                                    value={formData.long_description || ''}
                                    onChange={(e) => setFormData({ ...formData, long_description: e.target.value })}
                                    rows={5}
                                />
                            </div>

                            <div>
                                <Label htmlFor="production_description">Описание производства</Label>
                                <Textarea
                                    id="production_description"
                                    value={formData.production_description || ''}
                                    onChange={(e) => setFormData({ ...formData, production_description: e.target.value })}
                                    rows={3}
                                />
                            </div>

                            <div>
                                <Label htmlFor="safety_and_quality">Безопасность и качество</Label>
                                <Textarea
                                    id="safety_and_quality"
                                    value={formData.safety_and_quality || ''}
                                    onChange={(e) => setFormData({ ...formData, safety_and_quality: e.target.value })}
                                    rows={3}
                                />
                            </div>

                            <div>
                                <Label htmlFor="video_url">Видео URL</Label>
                                <Input
                                    id="video_url"
                                    value={formData.video_url || ''}
                                    onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="tags">Теги</Label>
                                <Input
                                    id="tags"
                                    value={formData.tags || ''}
                                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                    placeholder="Разделяйте запятыми"
                                />
                            </div>

                            <Button onClick={handleSave} disabled={loading}>
                                Сохранить изменения
                            </Button>
                        </TabsContent>

                        <TabsContent value="owners" className="space-y-4">
                            {data.members.length === 0 && (
                                <p className="text-sm text-muted-foreground">Нет владельцев</p>
                            )}
                            <div className="space-y-3">
                                {data.members.map((member: any) => (
                                    <div key={member.id} className="rounded-md border border-border p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold">{member.full_name || 'Не указано'}</p>
                                                <p className="text-sm text-muted-foreground">{member.email}</p>
                                                <p className="text-xs text-muted-foreground">Роль: {member.role}</p>
                                            </div>
                                            <Button variant="outline" size="sm" asChild>
                                                <a href={`mailto:${member.email}`}>Написать письмо</a>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="reviews" className="space-y-4">
                            {reviewsLoading && <p className="text-sm text-muted-foreground">Загружаем отзывы...</p>}
                            {!reviewsLoading && reviews.length === 0 && (
                                <p className="text-sm text-muted-foreground">Нет отзывов</p>
                            )}
                            <div className="space-y-3">
                                {reviews.map((review) => (
                                    <div key={review.id} className="rounded-md border border-border p-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold">Рейтинг: {review.rating}/5</span>
                                                        <span className="text-xs uppercase text-muted-foreground">{review.status}</span>
                                                    </div>
                                                    {review.title && <p className="font-medium">{review.title}</p>}
                                                    <p className="text-sm">{review.body}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Created: {new Date(review.created_at).toLocaleString('ru-RU')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex gap-2">
                                                {review.status !== 'approved' && (
                                                    <Button size="sm" onClick={() => handleModerate(review.id, 'approved')} disabled={reviewsLoading}>
                                                        Approve
                                                    </Button>
                                                )}
                                                {review.status !== 'rejected' && (
                                                    <Button size="sm" variant="destructive" onClick={() => handleModerate(review.id, 'rejected')} disabled={reviewsLoading}>
                                                        Reject
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    )
}
