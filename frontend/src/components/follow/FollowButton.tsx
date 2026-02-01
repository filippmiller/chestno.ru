import { useState, useCallback } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface FollowButtonProps {
  /** Whether the item is currently followed */
  isFollowed?: boolean
  /** Callback when follow state changes */
  onFollowChange?: (isFollowed: boolean) => Promise<void> | void
  /** Number of followers to display */
  followerCount?: number
  /** Show the follower count */
  showCount?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Visual variant */
  variant?: 'default' | 'outline' | 'ghost'
  /** Disable interactions */
  disabled?: boolean
  /** Additional class names */
  className?: string
}

const sizeConfig = {
  sm: {
    button: 'h-8 px-3 text-xs',
    icon: 'h-3.5 w-3.5',
    iconOnly: 'h-8 w-8',
  },
  md: {
    button: 'h-10 px-4 text-sm',
    icon: 'h-4 w-4',
    iconOnly: 'h-10 w-10',
  },
  lg: {
    button: 'h-12 px-5 text-base',
    icon: 'h-5 w-5',
    iconOnly: 'h-12 w-12',
  },
}

export function FollowButton({
  isFollowed: initialFollowed = false,
  onFollowChange,
  followerCount,
  showCount = false,
  size = 'md',
  variant = 'outline',
  disabled = false,
  className,
}: FollowButtonProps) {
  const [isFollowed, setIsFollowed] = useState(initialFollowed)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const config = sizeConfig[size]

  const handleClick = useCallback(async () => {
    if (disabled || isLoading) return

    setIsLoading(true)
    setIsAnimating(true)

    const newState = !isFollowed

    try {
      if (onFollowChange) {
        await onFollowChange(newState)
      }
      setIsFollowed(newState)
    } catch (error) {
      console.error('Failed to update follow state:', error)
    } finally {
      setIsLoading(false)
      setTimeout(() => setIsAnimating(false), 300)
    }
  }, [isFollowed, onFollowChange, disabled, isLoading])

  const buttonContent = (
    <>
      <Heart
        className={cn(
          config.icon,
          'transition-all duration-300',
          isFollowed && 'fill-current text-red-500',
          isAnimating && 'scale-125',
        )}
      />
      {showCount && followerCount !== undefined && (
        <span className="ml-1.5">{formatCount(followerCount + (isFollowed && !initialFollowed ? 1 : 0))}</span>
      )}
      {!showCount && (
        <span className="ml-1.5">{isFollowed ? 'Отслеживаю' : 'Отслеживать'}</span>
      )}
    </>
  )

  const button = (
    <Button
      variant={isFollowed ? 'default' : variant}
      size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default'}
      className={cn(
        config.button,
        isFollowed && 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900 dark:border-red-800',
        className,
      )}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-pressed={isFollowed}
      aria-label={isFollowed ? 'Перестать отслеживать' : 'Отслеживать'}
    >
      {buttonContent}
    </Button>
  )

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{isFollowed ? 'Нажмите, чтобы перестать отслеживать' : 'Нажмите, чтобы отслеживать обновления'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Icon-only variant of the follow button */
export function FollowButtonIcon({
  isFollowed: initialFollowed = false,
  onFollowChange,
  size = 'md',
  disabled = false,
  className,
}: Omit<FollowButtonProps, 'showCount' | 'followerCount' | 'variant'>) {
  const [isFollowed, setIsFollowed] = useState(initialFollowed)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const config = sizeConfig[size]

  const handleClick = useCallback(async () => {
    if (disabled || isLoading) return

    setIsLoading(true)
    setIsAnimating(true)

    const newState = !isFollowed

    try {
      if (onFollowChange) {
        await onFollowChange(newState)
      }
      setIsFollowed(newState)
    } catch (error) {
      console.error('Failed to update follow state:', error)
    } finally {
      setIsLoading(false)
      setTimeout(() => setIsAnimating(false), 300)
    }
  }, [isFollowed, onFollowChange, disabled, isLoading])

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              config.iconOnly,
              'rounded-full transition-all duration-200',
              isFollowed && 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950',
              className,
            )}
            onClick={handleClick}
            disabled={disabled || isLoading}
            aria-pressed={isFollowed}
            aria-label={isFollowed ? 'Перестать отслеживать' : 'Отслеживать'}
          >
            <Heart
              className={cn(
                config.icon,
                'transition-all duration-300',
                isFollowed && 'fill-current',
                isAnimating && 'scale-125',
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{isFollowed ? 'Перестать отслеживать' : 'Отслеживать'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}
