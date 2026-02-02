import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  MapPin,
  Truck,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type {
  SupplyChainJourney,
  SupplyChainJourneyNode,
  SupplyChainNode as SupplyChainNodeType,
} from '@/types/supply-chain'
import { formatDistance, formatDuration } from '@/api/supplyChainService'
import { NodeColors, NodeIcons, NodeLabels, SupplyChainNodeCard } from './SupplyChainNode'

export interface SupplyChainTimelineProps {
  journey: SupplyChainJourney
  title?: string
  description?: string
  defaultExpanded?: boolean
  onNodeClick?: (node: SupplyChainNodeType) => void
  className?: string
}

/**
 * Vertical timeline visualization of the supply chain journey.
 * Shows nodes connected by steps with verification status.
 */
export function SupplyChainTimeline({
  journey,
  title = 'Цепочка поставок',
  description = 'Отслеживайте путь продукта от производителя до прилавка',
  defaultExpanded = false,
  onNodeClick,
  className,
}: SupplyChainTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [selectedNode, setSelectedNode] = useState<SupplyChainNodeType | null>(null)

  // Calculate verification stats
  const totalItems = journey.total_nodes + journey.total_steps
  const verifiedItems = journey.verified_nodes + journey.verified_steps
  const verificationPercent = totalItems > 0 ? Math.round((verifiedItems / totalItems) * 100) : 0

  const handleNodeClick = (node: SupplyChainNodeType) => {
    setSelectedNode(node)
    if (!isExpanded) {
      setIsExpanded(true)
    }
    if (onNodeClick) {
      onNodeClick(node)
    }
  }

  if (journey.nodes.length === 0) {
    return null
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {title}
              {verificationPercent === 100 && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  100% верифицировано
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0"
          >
            {isExpanded ? (
              <>
                Свернуть
                <ChevronUp className="ml-1 h-4 w-4" />
              </>
            ) : (
              <>
                Подробнее
                <ChevronDown className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Verification Progress */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Верификация цепочки</span>
            <span className="font-medium">
              {verifiedItems} из {totalItems}
            </span>
          </div>
          <Progress
            value={verificationPercent}
            className={cn(
              'h-2',
              verificationPercent === 100 ? '[&>div]:bg-green-500' : ''
            )}
          />
        </div>

        {/* Summary stats */}
        {journey.total_distance_km > 0 || journey.total_duration_hours > 0 ? (
          <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
            {journey.total_distance_km > 0 && (
              <div className="flex items-center gap-1">
                <Truck className="h-4 w-4" />
                <span>{formatDistance(journey.total_distance_km)}</span>
              </div>
            )}
            {journey.total_duration_hours > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(journey.total_duration_hours)}</span>
              </div>
            )}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Compact Timeline View */}
        {!isExpanded && (
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {journey.nodes.map((journeyNode, idx) => {
              const { node } = journeyNode
              const Icon = NodeIcons[node.node_type]
              const colors = NodeColors[node.node_type]
              const isLast = idx === journey.nodes.length - 1

              return (
                <div key={node.id} className="flex items-center">
                  <button
                    onClick={() => handleNodeClick(node)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg p-2 transition-all',
                      'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring'
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
                      {NodeLabels[node.node_type]}
                    </span>
                  </button>
                  {!isLast && (
                    <div className="mx-1 flex items-center">
                      <div className="h-0.5 w-6 bg-border" />
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Expanded Timeline View */}
        {isExpanded && (
          <div className="relative space-y-0">
            {/* Vertical line */}
            <div className="absolute bottom-0 left-5 top-0 w-0.5 bg-border" />

            {journey.nodes.map((journeyNode, idx) => {
              const { node, step_to_next } = journeyNode
              const colors = NodeColors[node.node_type]
              const isSelected = selectedNode?.id === node.id
              const isLast = idx === journey.nodes.length - 1

              return (
                <div key={node.id}>
                  {/* Node */}
                  <div
                    className={cn(
                      'relative py-4 pl-14 transition-colors',
                      isSelected && '-mx-6 rounded-lg bg-muted/50 px-20'
                    )}
                  >
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        'absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background transition-all',
                        node.is_verified ? 'border-green-500' : 'border-border',
                        isSelected && 'ring-2 ring-primary ring-offset-2'
                      )}
                    >
                      {node.is_verified ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Node card */}
                    <SupplyChainNodeCard
                      node={node}
                      isSelected={isSelected}
                      onClick={handleNodeClick}
                    />
                  </div>

                  {/* Step connector (if not last) */}
                  {!isLast && step_to_next && (
                    <div className="relative py-2 pl-14">
                      <div className="rounded-lg border border-dashed bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {step_to_next.transport_method && (
                            <span className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {step_to_next.transport_method}
                            </span>
                          )}
                          {step_to_next.distance_km != null && (
                            <span>{formatDistance(step_to_next.distance_km)}</span>
                          )}
                          {step_to_next.duration_hours != null && (
                            <span>{formatDuration(step_to_next.duration_hours)}</span>
                          )}
                          {step_to_next.verified && (
                            <Badge
                              variant="outline"
                              className="border-green-300 text-green-600 dark:border-green-700 dark:text-green-400"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Верифицировано
                            </Badge>
                          )}
                        </div>
                        {step_to_next.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {step_to_next.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
