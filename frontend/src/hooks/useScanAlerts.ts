/**
 * useScanAlerts Hook
 *
 * Real-time subscription to scan alerts with optimistic updates,
 * filtering, and CRUD operations.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type {
  ScanAlert,
  ScanAlertListFilters,
  ScanAlertStats,
  AlertStatus,
  ScanAlertRealtimePayload,
} from '@/types/scan-alerts'

interface UseScanAlertsOptions {
  organizationId: string
  filters?: ScanAlertListFilters
  enableRealtime?: boolean
  pageSize?: number
}

interface UseScanAlertsReturn {
  // Data
  alerts: ScanAlert[]
  stats: ScanAlertStats
  isLoading: boolean
  error: Error | null

  // Pagination
  page: number
  totalPages: number
  hasMore: boolean
  loadMore: () => void
  setPage: (page: number) => void

  // Actions
  acknowledgeAlert: (id: string) => Promise<void>
  resolveAlert: (id: string, notes?: string) => Promise<void>
  dismissAlert: (id: string) => Promise<void>
  updateAlertStatus: (id: string, status: AlertStatus) => Promise<void>

  // Filters
  setFilters: (filters: ScanAlertListFilters) => void

  // Realtime
  newAlertsCount: number
  clearNewAlerts: () => void
}

const supabase = createClient()

export function useScanAlerts({
  organizationId,
  filters: initialFilters = {},
  enableRealtime = true,
  pageSize = 20,
}: UseScanAlertsOptions): UseScanAlertsReturn {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ScanAlertListFilters>(initialFilters)
  const [page, setPage] = useState(1)
  const [newAlertsCount, setNewAlertsCount] = useState(0)

  // Query key for cache management
  const queryKey = useMemo(
    () => ['scan-alerts', organizationId, filters, page],
    [organizationId, filters, page]
  )

  // Fetch alerts
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('scan_alerts')
        .select(`
          *,
          batch:product_batches(id, batch_code, batch_name, product:products(id, name, slug)),
          product:products(id, name, slug),
          rule:scan_alert_rules(id, rule_name, rule_type)
        `, { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)

      // Apply filters
      if (filters.status?.length) {
        query = query.in('status', filters.status)
      }
      if (filters.severity?.length) {
        query = query.in('severity', filters.severity)
      }
      if (filters.alert_type?.length) {
        query = query.in('alert_type', filters.alert_type)
      }
      if (filters.batch_id) {
        query = query.eq('batch_id', filters.batch_id)
      }
      if (filters.product_id) {
        query = query.eq('product_id', filters.product_id)
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from)
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to)
      }
      if (filters.is_escalated !== undefined) {
        query = query.eq('is_escalated', filters.is_escalated)
      }

      const { data: alerts, count, error } = await query

      if (error) throw error

      return {
        alerts: alerts as ScanAlert[],
        total: count || 0,
      }
    },
    staleTime: 30000,
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['scan-alerts-stats', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_scan_alert_stats', {
        p_org_id: organizationId,
      })

      if (error) {
        // Fallback to manual calculation if RPC not available
        const { data: allAlerts } = await supabase
          .from('scan_alerts')
          .select('status, severity, is_escalated')
          .eq('organization_id', organizationId)

        if (!allAlerts) return getEmptyStats()

        return {
          total: allAlerts.length,
          by_status: allAlerts.reduce(
            (acc, a) => ({ ...acc, [a.status]: (acc[a.status as AlertStatus] || 0) + 1 }),
            {} as Record<AlertStatus, number>
          ),
          by_severity: allAlerts.reduce(
            (acc, a) => ({ ...acc, [a.severity]: (acc[a.severity] || 0) + 1 }),
            {} as Record<string, number>
          ),
          unacknowledged_count: allAlerts.filter((a) => a.status === 'new').length,
          escalated_count: allAlerts.filter((a) => a.is_escalated).length,
        } as ScanAlertStats
      }

      return data as ScanAlertStats
    },
    staleTime: 60000,
  })

  // Real-time subscription
  useEffect(() => {
    if (!enableRealtime) return

    const channel = supabase
      .channel(`scan-alerts-${organizationId}`)
      .on<ScanAlert>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_alerts',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload as unknown as ScanAlertRealtimePayload

          if (eventType === 'INSERT' && newRecord) {
            // New alert arrived
            setNewAlertsCount((prev) => prev + 1)

            // Update cache optimistically
            queryClient.setQueryData(queryKey, (old: typeof data) => {
              if (!old) return old
              return {
                ...old,
                alerts: [newRecord, ...old.alerts].slice(0, pageSize),
                total: old.total + 1,
              }
            })

            // Invalidate stats
            queryClient.invalidateQueries({ queryKey: ['scan-alerts-stats', organizationId] })
          } else if (eventType === 'UPDATE' && newRecord) {
            // Alert updated
            queryClient.setQueryData(queryKey, (old: typeof data) => {
              if (!old) return old
              return {
                ...old,
                alerts: old.alerts.map((a) =>
                  a.id === newRecord.id ? { ...a, ...newRecord } : a
                ),
              }
            })
          } else if (eventType === 'DELETE' && oldRecord) {
            // Alert deleted
            queryClient.setQueryData(queryKey, (old: typeof data) => {
              if (!old) return old
              return {
                ...old,
                alerts: old.alerts.filter((a) => a.id !== oldRecord.id),
                total: old.total - 1,
              }
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [organizationId, enableRealtime, queryClient, queryKey, pageSize])

  // Mutations
  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scan_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['scan-alerts-stats', organizationId] })
    },
  })

  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { error } = await supabase
        .from('scan_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
          resolution_notes: notes,
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['scan-alerts-stats', organizationId] })
    },
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scan_alerts')
        .update({ status: 'dismissed' })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['scan-alerts-stats', organizationId] })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AlertStatus }) => {
      const updates: Partial<ScanAlert> = { status }

      if (status === 'acknowledged') {
        updates.acknowledged_at = new Date().toISOString()
        updates.acknowledged_by = (await supabase.auth.getUser()).data.user?.id
      } else if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString()
        updates.resolved_by = (await supabase.auth.getUser()).data.user?.id
      }

      const { error } = await supabase
        .from('scan_alerts')
        .update(updates)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['scan-alerts-stats', organizationId] })
    },
  })

  // Pagination
  const totalPages = Math.ceil((data?.total || 0) / pageSize)
  const hasMore = page < totalPages

  const loadMore = useCallback(() => {
    if (hasMore) setPage((p) => p + 1)
  }, [hasMore])

  // Clear new alerts counter
  const clearNewAlerts = useCallback(() => {
    setNewAlertsCount(0)
  }, [])

  return {
    alerts: data?.alerts || [],
    stats: stats || getEmptyStats(),
    isLoading,
    error: error as Error | null,
    page,
    totalPages,
    hasMore,
    loadMore,
    setPage,
    acknowledgeAlert: (id) => acknowledgeMutation.mutateAsync(id),
    resolveAlert: (id, notes) => resolveMutation.mutateAsync({ id, notes }),
    dismissAlert: (id) => dismissMutation.mutateAsync(id),
    updateAlertStatus: (id, status) => updateStatusMutation.mutateAsync({ id, status }),
    setFilters,
    newAlertsCount,
    clearNewAlerts,
  }
}

function getEmptyStats(): ScanAlertStats {
  return {
    total: 0,
    by_status: {
      new: 0,
      acknowledged: 0,
      investigating: 0,
      resolved: 0,
      dismissed: 0,
    },
    by_severity: {
      info: 0,
      warning: 0,
      critical: 0,
    },
    unacknowledged_count: 0,
    escalated_count: 0,
  }
}

/**
 * Hook for subscribing to live scan events (for dashboard map/charts)
 */
export function useLiveScanEvents(organizationId: string) {
  const [events, setEvents] = useState<Array<{
    id: string
    country?: string
    city?: string
    created_at: string
    is_suspicious: boolean
  }>>([])

  useEffect(() => {
    const channel = supabase
      .channel(`live-scans-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'qr_scan_events',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newEvent = payload.new as typeof events[0]
          setEvents((prev) => [newEvent, ...prev].slice(0, 100))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [organizationId])

  return events
}
