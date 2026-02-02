import {
  CheckCircle2,
  Circle,
  Factory,
  Leaf,
  MapPin,
  Store,
  Truck,
  User,
  Warehouse,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { SupplyChainNode as SupplyChainNodeType, SupplyChainNodeType as NodeType } from '@/types/supply-chain'

export interface SupplyChainNodeProps {
  node: SupplyChainNodeType
  isSelected?: boolean
  isCompact?: boolean
  onClick?: (node: SupplyChainNodeType) => void
  className?: string
}

// Icon mapping for node types
const NodeIcons: Record<NodeType, typeof Leaf> = {
  PRODUCER: Leaf,
  PROCESSOR: Factory,
  WAREHOUSE: Warehouse,
  DISTRIBUTOR: Truck,
  RETAILER: Store,
  CONSUMER: User,
}

// Color configuration for node types
const NodeColors: Record<NodeType, { text: string; bg: string; border: string }> = {
  PRODUCER: {
    text: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    border: 'border-green-300 dark:border-green-700',
  },
  PROCESSOR: {
    text: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    border: 'border-blue-300 dark:border-blue-700',
  },
  WAREHOUSE: {
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-300 dark:border-amber-700',
  },
  DISTRIBUTOR: {
    text: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    border: 'border-cyan-300 dark:border-cyan-700',
  },
  RETAILER: {
    text: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    border: 'border-purple-300 dark:border-purple-700',
  },
  CONSUMER: {
    text: 'text-pink-600 dark:text-pink-400',
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    border: 'border-pink-300 dark:border-pink-700',
  },
}

// Labels for node types (Russian)
const NodeLabels: Record<NodeType, string> = {
  PRODUCER: 'Производитель',
  PROCESSOR: 'Переработка',
  WAREHOUSE: 'Склад',
  DISTRIBUTOR: 'Дистрибьютор',
  RETAILER: 'Розница',
  CONSUMER: 'Потребитель',
}

/**
 * Individual node card in the supply chain visualization.
 * Shows node type, name, location, and verification status.
 */
export function SupplyChainNodeCard({
  node,
  isSelected = false,
  isCompact = false,
  onClick,
  className,
}: SupplyChainNodeProps) {
  const Icon = NodeIcons[node.node_type]
  const colors = NodeColors[node.node_type]
  const label = NodeLabels[node.node_type]

  const handleClick = () => {
    if (onClick) {
      onClick(node)
    }
  }

  if (isCompact) {
    // Compact view for timeline
    return (
      <button
        onClick={handleClick}
        className={cn(
          'flex flex-col items-center gap-1 rounded-lg p-2 transition-all',
          'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
          isSelected && 'ring-2 ring-primary',
          className
        )}
      >
        <div
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-full transition-all',
            colors.bg
          )}
        >
          <Icon className={cn('h-5 w-5', colors.text)} />
          {node.is_verified && (
            <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-white text-green-500 dark:bg-gray-900" />
          )}
        </div>
        <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">
          {label}
        </span>
      </button>
    )
  }

  // Full card view
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
        className
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
              colors.bg
            )}
          >
            <Icon className={cn('h-6 w-6', colors.text)} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('text-xs', colors.border)}>
                {label}
              </Badge>
              {node.is_verified ? (
                <Badge className="bg-green-100 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Верифицировано
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  <Circle className="mr-1 h-3 w-3" />
                  Не верифицировано
                </Badge>
              )}
            </div>

            {/* Name */}
            <h4 className="mt-1 truncate font-semibold">{node.name}</h4>

            {/* Description */}
            {node.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {node.description}
              </p>
            )}

            {/* Location */}
            {node.location && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{node.location}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Small badge-style node indicator for use in lists or compact views.
 */
export function SupplyChainNodeBadge({
  node,
  showVerification = true,
}: {
  node: SupplyChainNodeType
  showVerification?: boolean
}) {
  const Icon = NodeIcons[node.node_type]
  const colors = NodeColors[node.node_type]
  const label = NodeLabels[node.node_type]

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1', colors.bg)}>
      <Icon className={cn('h-3.5 w-3.5', colors.text)} />
      <span className={cn('text-xs font-medium', colors.text)}>{label}</span>
      {showVerification && node.is_verified && (
        <CheckCircle2 className="h-3 w-3 text-green-500" />
      )}
    </div>
  )
}

export { NodeIcons, NodeColors, NodeLabels }
