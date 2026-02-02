/**
 * ScanNotificationBadge Component
 *
 * Notification indicator showing scan activity count.
 * Supports multiple visual variants including a pulse animation for attention.
 */

'use client'

import { useEffect, useState } from 'react'
import { Bell, Radio } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ScanNotificationBadgeProps {
  count: number
  variant?: 'default' | 'pulse' | 'minimal'
  onClick?: () => void
  showZero?: boolean
  maxCount?: number
  tooltipText?: string
  className?: string
}

export function ScanNotificationBadge({
  count,
  variant = 'default',
  onClick,
  showZero = false,
  maxCount = 99,
  tooltipText,
  className = '',
}: ScanNotificationBadgeProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  // Trigger animation when count increases
  useEffect(() => {
    if (count > 0) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 300)
      return () => clearTimeout(timer)
    }
  }, [count])

  // Don't render if count is 0 and showZero is false
  if (count === 0 && !showZero) {
    return null
  }

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString()

  const badgeContent = (
    <div className={`relative ${className}`}>
      {variant === 'default' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className={`absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs ${
                isAnimating ? 'scale-125' : ''
              } transition-transform`}
            >
              {displayCount}
            </Badge>
          )}
        </Button>
      )}

      {variant === 'pulse' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <>
              {/* Pulse ring */}
              <span className="absolute -top-1 -right-1 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <Badge
                  variant="destructive"
                  className="relative h-5 min-w-5 px-1 flex items-center justify-center text-xs"
                >
                  {displayCount}
                </Badge>
              </span>
            </>
          )}
        </Button>
      )}

      {variant === 'minimal' && (
        <div
          onClick={onClick}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-sm ${
            count > 0
              ? 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20'
              : 'bg-muted text-muted-foreground'
          } transition-colors ${onClick ? 'cursor-pointer' : ''}`}
        >
          <Radio className={`h-3 w-3 ${count > 0 ? 'animate-pulse' : ''}`} />
          <span className="font-medium">{displayCount}</span>
        </div>
      )}
    </div>
  )

  if (tooltipText) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badgeContent
}

// Live connection status indicator
interface LiveStatusIndicatorProps {
  isConnected: boolean
  scanCount?: number
}

export function LiveStatusIndicator({
  isConnected,
  scanCount = 0,
}: LiveStatusIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
        isConnected
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-600'
      }`}>
        <span className={`h-2 w-2 rounded-full ${
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        }`} />
        {isConnected ? 'Live' : 'Offline'}
      </div>

      {scanCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {scanCount} сканирований
        </Badge>
      )}
    </div>
  )
}

// Scan activity summary widget
interface ScanActivitySummaryProps {
  todayCount: number
  weekCount: number
  suspiciousCount?: number
  onClick?: () => void
}

export function ScanActivitySummary({
  todayCount,
  weekCount,
  suspiciousCount = 0,
  onClick,
}: ScanActivitySummaryProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 p-3 rounded-lg border bg-card ${
        onClick ? 'cursor-pointer hover:bg-accent/50' : ''
      } transition-colors`}
    >
      <div className="p-2 rounded-full bg-primary/10">
        <Radio className="h-5 w-5 text-primary" />
      </div>

      <div className="flex-1">
        <p className="text-sm font-medium">Активность сканирований</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-muted-foreground">
            Сегодня: <span className="font-medium text-foreground">{todayCount}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            За неделю: <span className="font-medium text-foreground">{weekCount}</span>
          </span>
        </div>
      </div>

      {suspiciousCount > 0 && (
        <Badge variant="destructive" className="text-xs">
          {suspiciousCount} подозр.
        </Badge>
      )}
    </div>
  )
}
