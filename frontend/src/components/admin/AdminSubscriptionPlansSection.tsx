import { useCallback, useEffect, useState } from 'react'

import { adminCreatePlan, adminUpdatePlan, listSubscriptionPlans } from '@/api/authService'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { SubscriptionPlan } from '@/types/auth'

export const AdminSubscriptionPlansSection = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)

  const loadPlans = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listSubscriptionPlans(true)
      setPlans(data)
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить планы подписки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPlans()
  }, [loadPlans])

  const handleCreatePlan = async (values: {
    code: string
    name: string
    description?: string
    price_monthly_cents?: number
    max_products?: number
    max_qr_codes?: number
    max_members?: number
    analytics_level?: string
    is_default?: boolean
    is_active?: boolean
  }) => {
    setLoading(true)
    setError(null)
    try {
      await adminCreatePlan(values)
      setShowCreateForm(false)
      await loadPlans()
    } catch (err) {
      console.error(err)
      setError('Не удалось создать план')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePlan = async (planId: string, updates: Partial<SubscriptionPlan>) => {
    setLoading(true)
    setError(null)
    try {
      await adminUpdatePlan(planId, updates)
      setEditingPlan(null)
      await loadPlans()
    } catch (err) {
      console.error(err)
      setError('Не удалось обновить план')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Plans Management</CardTitle>
        <CardDescription>Управление тарифными планами подписки.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">Всего планов: {plans.length}</div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>{showCreateForm ? 'Cancel' : 'Create New Plan'}</Button>
        </div>

        {showCreateForm && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Create New Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.target as HTMLFormElement)
                  handleCreatePlan({
                    code: formData.get('code') as string,
                    name: formData.get('name') as string,
                    description: (formData.get('description') as string) || undefined,
                    price_monthly_cents: formData.get('price_monthly_cents')
                      ? parseInt(formData.get('price_monthly_cents') as string)
                      : undefined,
                    max_products: formData.get('max_products') ? parseInt(formData.get('max_products') as string) : undefined,
                    max_qr_codes: formData.get('max_qr_codes') ? parseInt(formData.get('max_qr_codes') as string) : undefined,
                    max_members: formData.get('max_members') ? parseInt(formData.get('max_members') as string) : undefined,
                    analytics_level: (formData.get('analytics_level') as string) || 'basic',
                    is_default: formData.get('is_default') === 'on',
                    is_active: formData.get('is_active') !== 'off',
                  })
                }}
                className="grid gap-4 md:grid-cols-2"
              >
                <Input name="code" placeholder="Code (e.g., free, starter, pro)" required />
                <Input name="name" placeholder="Plan Name" required />
                <Input name="description" placeholder="Description" className="md:col-span-2" />
                <Input name="price_monthly_cents" type="number" placeholder="Monthly Price (cents)" />
                <Input name="max_products" type="number" placeholder="Max Products" />
                <Input name="max_qr_codes" type="number" placeholder="Max QR Codes" />
                <Input name="max_members" type="number" placeholder="Max Members" />
                <select name="analytics_level" className="h-10 rounded-md border border-input px-3">
                  <option value="basic">Basic</option>
                  <option value="advanced">Advanced</option>
                </select>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="is_default" />
                    Default Plan
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="is_active" defaultChecked />
                    Active
                  </label>
                </div>
                <Button type="submit" className="md:col-span-2" disabled={loading}>
                  Create Plan
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {loading && plans.length === 0 && <p className="text-sm text-muted-foreground">Загружаем...</p>}

        <div className="space-y-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-md border border-border p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{plan.name}</p>
                      <span className="text-xs text-muted-foreground">({plan.code})</span>
                      {plan.is_default && <span className="text-xs text-primary">Default</span>}
                      {!plan.is_active && <span className="text-xs text-red-600">Inactive</span>}
                    </div>
                    {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
                    <div className="text-xs text-muted-foreground mt-2">
                      <p>Price: {plan.price_monthly_cents ? `${plan.price_monthly_cents / 100} ${plan.currency}/month` : 'Free'}</p>
                      <p>
                        Limits: Products: {plan.max_products ?? '∞'}, QR: {plan.max_qr_codes ?? '∞'}, Members:{' '}
                        {plan.max_members ?? '∞'}
                      </p>
                      <p>Analytics: {plan.analytics_level}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingPlan(plan)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdatePlan(plan.id, { is_active: !plan.is_active })}
                    disabled={loading}
                  >
                    {plan.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
                {editingPlan?.id === plan.id && (
                  <Card className="mt-2 border-dashed">
                    <CardContent className="pt-4">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          const formData = new FormData(e.target as HTMLFormElement)
                          handleUpdatePlan(plan.id, {
                            name: (formData.get('name') as string) || undefined,
                            description: (formData.get('description') as string) || undefined,
                            price_monthly_cents: formData.get('price_monthly_cents')
                              ? parseInt(formData.get('price_monthly_cents') as string)
                              : undefined,
                            max_products: formData.get('max_products')
                              ? parseInt(formData.get('max_products') as string)
                              : undefined,
                            max_qr_codes: formData.get('max_qr_codes')
                              ? parseInt(formData.get('max_qr_codes') as string)
                              : undefined,
                            max_members: formData.get('max_members')
                              ? parseInt(formData.get('max_members') as string)
                              : undefined,
                            analytics_level: (formData.get('analytics_level') as string) || undefined,
                            is_default: formData.get('is_default') === 'on',
                            is_active: formData.get('is_active') !== 'off',
                          })
                        }}
                        className="grid gap-4 md:grid-cols-2"
                      >
                        <Input name="name" defaultValue={plan.name} placeholder="Plan Name" />
                        <Input name="description" defaultValue={plan.description || ''} placeholder="Description" className="md:col-span-2" />
                        <Input name="price_monthly_cents" type="number" defaultValue={plan.price_monthly_cents || ''} placeholder="Monthly Price (cents)" />
                        <Input name="max_products" type="number" defaultValue={plan.max_products || ''} placeholder="Max Products" />
                        <Input name="max_qr_codes" type="number" defaultValue={plan.max_qr_codes || ''} placeholder="Max QR Codes" />
                        <Input name="max_members" type="number" defaultValue={plan.max_members || ''} placeholder="Max Members" />
                        <select name="analytics_level" className="h-10 rounded-md border border-input px-3" defaultValue={plan.analytics_level}>
                          <option value="basic">Basic</option>
                          <option value="advanced">Advanced</option>
                        </select>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="is_default" defaultChecked={plan.is_default} />
                            Default Plan
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="is_active" defaultChecked={plan.is_active} />
                            Active
                          </label>
                        </div>
                        <div className="flex gap-2 md:col-span-2">
                          <Button type="submit" disabled={loading}>
                            Save
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setEditingPlan(null)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


