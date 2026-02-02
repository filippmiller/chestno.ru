import { Badge } from '@/components/ui/badge'
import {
  type WarrantyStatus,
  type ClaimStatus,
  type ClaimPriority,
  WARRANTY_STATUS_LABELS,
  CLAIM_STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/types/warranty'

interface WarrantyStatusBadgeProps {
  status: WarrantyStatus
  daysRemaining?: number
  showDays?: boolean
}

const WARRANTY_STATUS_VARIANTS: Record<WarrantyStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  active: 'bg-green-100 text-green-800 border-green-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  voided: 'bg-red-100 text-red-800 border-red-200',
  transferred: 'bg-blue-100 text-blue-800 border-blue-200',
}

export function WarrantyStatusBadge({
  status,
  daysRemaining,
  showDays = true,
}: WarrantyStatusBadgeProps) {
  const variant = WARRANTY_STATUS_VARIANTS[status]
  const label = WARRANTY_STATUS_LABELS[status]

  // Show warning if expiring soon (within 30 days)
  const isExpiringSoon = status === 'active' && daysRemaining !== undefined && daysRemaining <= 30

  return (
    <div className="flex items-center gap-2">
      <Badge className={`${variant} border`}>{label}</Badge>
      {showDays && status === 'active' && daysRemaining !== undefined && (
        <span
          className={`text-sm ${
            isExpiringSoon ? 'text-orange-600 font-medium' : 'text-muted-foreground'
          }`}
        >
          {daysRemaining > 0 ? `${daysRemaining} дн.` : 'Истекает сегодня'}
        </span>
      )}
    </div>
  )
}

// Claim Status Badge
interface ClaimStatusBadgeProps {
  status: ClaimStatus
}

const CLAIM_STATUS_VARIANTS: Record<ClaimStatus, string> = {
  submitted: 'bg-blue-100 text-blue-800 border-blue-200',
  under_review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
  resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
}

export function ClaimStatusBadge({ status }: ClaimStatusBadgeProps) {
  const variant = CLAIM_STATUS_VARIANTS[status]
  const label = CLAIM_STATUS_LABELS[status]

  return <Badge className={`${variant} border`}>{label}</Badge>
}

// Priority Badge
interface PriorityBadgeProps {
  priority: ClaimPriority
}

const PRIORITY_VARIANTS: Record<ClaimPriority, string> = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  normal: 'bg-blue-100 text-blue-800 border-blue-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  urgent: 'bg-red-100 text-red-800 border-red-200',
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const variant = PRIORITY_VARIANTS[priority]
  const label = PRIORITY_LABELS[priority]

  return <Badge className={`${variant} border`}>{label}</Badge>
}
