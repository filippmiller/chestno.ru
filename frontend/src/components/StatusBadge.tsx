import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type StatusLevel = 'A' | 'B' | 'C'

export interface StatusBadgeProps {
  level: StatusLevel
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  className?: string
}

const levelConfig = {
  A: {
    color: '#10B981',
    bgColor: 'bg-green-100 dark:bg-green-950',
    textColor: 'text-green-800 dark:text-green-100',
    borderColor: 'border-green-200 dark:border-green-800',
    name: 'Статус A',
    description: 'Высшая степень честности — полная открытость производства',
  },
  B: {
    color: '#3B82F6',
    bgColor: 'bg-blue-100 dark:bg-blue-950',
    textColor: 'text-blue-800 dark:text-blue-100',
    borderColor: 'border-blue-200 dark:border-blue-800',
    name: 'Статус B',
    description: 'Продвинутая честность — расширенная информация о производстве',
  },
  C: {
    color: '#8B5CF6',
    bgColor: 'bg-purple-100 dark:bg-purple-950',
    textColor: 'text-purple-800 dark:text-purple-100',
    borderColor: 'border-purple-200 dark:border-purple-800',
    name: 'Статус C',
    description: 'Базовая честность — проверенная организация',
  },
} as const

const sizeConfig = {
  sm: 'px-2 py-0.5 text-[10px] sm:text-xs',
  md: 'px-2.5 py-0.5 text-xs sm:text-sm',
  lg: 'px-3 py-1 text-sm sm:text-base',
} as const

export const StatusBadge = ({
  level,
  size = 'md',
  showTooltip = true,
  className,
}: StatusBadgeProps) => {
  const config = levelConfig[level]
  const sizeClass = sizeConfig[size]

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-semibold transition-transform hover:scale-105',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeClass,
        className,
      )}
      aria-label={`${config.name}: ${config.description}`}
    >
      {level}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-xs"
        >
          <div className="space-y-1">
            <p className="font-semibold">{config.name}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
