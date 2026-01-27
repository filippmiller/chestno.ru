/**
 * StatusBadge Component - Visual Examples
 *
 * This file contains example usage patterns for the StatusBadge component.
 * Copy and paste these examples into your components as needed.
 */

import { StatusBadge } from '@/components/StatusBadge'
import { getOrganizationStatus } from '@/api/authService'
import { useState, useEffect } from 'react'
import type { StatusLevel } from '@/types/auth'

// ============================================================================
// Example 1: Basic Usage
// ============================================================================

export function BasicStatusBadgeExample() {
  return (
    <div className="flex gap-4">
      <StatusBadge level="A" />
      <StatusBadge level="B" />
      <StatusBadge level="C" />
    </div>
  )
}

// ============================================================================
// Example 2: Different Sizes
// ============================================================================

export function StatusBadgeSizesExample() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm">Small:</span>
        <StatusBadge level="A" size="sm" />
        <StatusBadge level="B" size="sm" />
        <StatusBadge level="C" size="sm" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm">Medium:</span>
        <StatusBadge level="A" size="md" />
        <StatusBadge level="B" size="md" />
        <StatusBadge level="C" size="md" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm">Large:</span>
        <StatusBadge level="A" size="lg" />
        <StatusBadge level="B" size="lg" />
        <StatusBadge level="C" size="lg" />
      </div>
    </div>
  )
}

// ============================================================================
// Example 3: With and Without Tooltips
// ============================================================================

export function StatusBadgeTooltipExample() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm text-muted-foreground">With Tooltip (hover me)</p>
        <StatusBadge level="B" showTooltip={true} />
      </div>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">Without Tooltip</p>
        <StatusBadge level="B" showTooltip={false} />
      </div>
    </div>
  )
}

// ============================================================================
// Example 4: In a Card Header (Organization Profile Pattern)
// ============================================================================

export function StatusBadgeInCardExample({ orgName }: { orgName: string }) {
  const [statusLevel, setStatusLevel] = useState<StatusLevel | null>(null)

  return (
    <div className="rounded-lg border">
      <div className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <h2 className="text-2xl font-semibold">{orgName}</h2>
            {statusLevel && statusLevel !== 0 && (
              <StatusBadge level={statusLevel as 'A' | 'B' | 'C'} size="md" showTooltip />
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Organization details and information...
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// Example 5: In a Hero Section (Public Page Pattern)
// ============================================================================

export function StatusBadgeInHeroExample({ orgName }: { orgName: string }) {
  const [statusLevel, setStatusLevel] = useState<StatusLevel | null>('A')

  return (
    <div className="space-y-4">
      <p className="text-sm uppercase text-muted-foreground">Producer</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <h1 className="text-4xl font-semibold">{orgName}</h1>
        {statusLevel && statusLevel !== 0 && (
          <StatusBadge level={statusLevel as 'A' | 'B' | 'C'} size="lg" showTooltip />
        )}
      </div>
      <p className="text-muted-foreground">
        Short description of the organization...
      </p>
    </div>
  )
}

// ============================================================================
// Example 6: Fetching Status from API
// ============================================================================

export function StatusBadgeWithAPIExample({ organizationId }: { organizationId: string }) {
  const [statusLevel, setStatusLevel] = useState<StatusLevel | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return

    setLoading(true)
    getOrganizationStatus(organizationId)
      .then((data) => {
        if (data?.status && data.status.level !== 0) {
          setStatusLevel(data.status.level)
        } else {
          setStatusLevel(null)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch status:', err)
        setError('Could not load status')
        setStatusLevel(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [organizationId])

  if (loading) {
    return <span className="text-sm text-muted-foreground">Loading status...</span>
  }

  if (error) {
    return null // Silently fail - status is optional
  }

  if (!statusLevel || statusLevel === 0) {
    return null // No badge to show
  }

  return <StatusBadge level={statusLevel as 'A' | 'B' | 'C'} size="md" showTooltip />
}

// ============================================================================
// Example 7: In a List Item
// ============================================================================

export function StatusBadgeInListExample() {
  const organizations = [
    { id: '1', name: 'Honest Coffee Co.', status: 'A' as const },
    { id: '2', name: 'Green Foods Ltd.', status: 'B' as const },
    { id: '3', name: 'Local Farm Products', status: 'C' as const },
    { id: '4', name: 'New Startup Inc.', status: 0 as const },
  ]

  return (
    <div className="space-y-2">
      {organizations.map((org) => (
        <div
          key={org.id}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <div className="flex items-center gap-3">
            <span className="font-medium">{org.name}</span>
            {org.status !== 0 && (
              <StatusBadge level={org.status as 'A' | 'B' | 'C'} size="sm" />
            )}
          </div>
          <button className="text-sm text-primary hover:underline">
            View Details
          </button>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Example 8: With Custom Styling
// ============================================================================

export function StatusBadgeCustomStyleExample() {
  return (
    <div className="flex gap-4">
      <StatusBadge
        level="A"
        size="md"
        className="shadow-lg ring-2 ring-green-300"
      />
      <StatusBadge
        level="B"
        size="md"
        className="shadow-lg ring-2 ring-blue-300"
      />
      <StatusBadge
        level="C"
        size="md"
        className="shadow-lg ring-2 ring-purple-300"
      />
    </div>
  )
}

// ============================================================================
// Example 9: Conditional Rendering Based on User Role
// ============================================================================

export function StatusBadgeConditionalExample({
  orgName,
  statusLevel,
  canViewStatus,
}: {
  orgName: string
  statusLevel: StatusLevel | null
  canViewStatus: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-2xl font-semibold">{orgName}</h2>
      {canViewStatus && statusLevel && statusLevel !== 0 && (
        <StatusBadge level={statusLevel as 'A' | 'B' | 'C'} size="md" />
      )}
    </div>
  )
}

// ============================================================================
// Example 10: Mobile-Responsive Layout
// ============================================================================

export function StatusBadgeResponsiveExample({ orgName }: { orgName: string }) {
  const statusLevel: StatusLevel = 'B'

  return (
    <div className="space-y-3">
      {/* Mobile: Stacked */}
      <div className="flex flex-col gap-2 sm:hidden">
        <h1 className="text-3xl font-semibold">{orgName}</h1>
        {statusLevel !== 0 && (
          <div>
            <StatusBadge level={statusLevel as 'A' | 'B' | 'C'} size="sm" />
          </div>
        )}
      </div>

      {/* Desktop: Inline */}
      <div className="hidden items-center gap-3 sm:flex">
        <h1 className="text-4xl font-semibold">{orgName}</h1>
        {statusLevel !== 0 && (
          <StatusBadge level={statusLevel as 'A' | 'B' | 'C'} size="lg" />
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Example 11: All Status Levels Showcase
// ============================================================================

export function StatusBadgeShowcaseExample() {
  return (
    <div className="rounded-lg border p-6">
      <h3 className="mb-4 text-lg font-semibold">Status Level Guide</h3>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <StatusBadge level="A" size="lg" showTooltip={false} />
          <div>
            <p className="font-medium">Status A</p>
            <p className="text-sm text-muted-foreground">
              Highest transparency level - Full production openness
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <StatusBadge level="B" size="lg" showTooltip={false} />
          <div>
            <p className="font-medium">Status B</p>
            <p className="text-sm text-muted-foreground">
              Advanced transparency - Extended production information
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <StatusBadge level="C" size="lg" showTooltip={false} />
          <div>
            <p className="font-medium">Status C</p>
            <p className="text-sm text-muted-foreground">
              Basic transparency - Verified organization
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Example 12: Error Boundary Pattern
// ============================================================================

export function StatusBadgeSafeExample({ organizationId }: { organizationId: string }) {
  const [statusLevel, setStatusLevel] = useState<StatusLevel | null>(null)

  useEffect(() => {
    // Fetch with error handling that won't break the page
    getOrganizationStatus(organizationId)
      .then((data) => {
        if (data?.status && data.status.level !== 0) {
          setStatusLevel(data.status.level)
        }
      })
      .catch(() => {
        // Fail silently - status is optional feature
        setStatusLevel(null)
      })
  }, [organizationId])

  // Only render if we have a valid status
  if (!statusLevel || statusLevel === 0) {
    return null
  }

  try {
    return <StatusBadge level={statusLevel as 'A' | 'B' | 'C'} size="md" />
  } catch (error) {
    // Fail gracefully
    console.error('StatusBadge render error:', error)
    return null
  }
}
