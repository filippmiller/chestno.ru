'use client'

import { useState, useCallback, useTransition } from 'react'
import { ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type {
  VoteType,
  ReviewVoteProps,
  VoteStats,
  CastVoteResponse,
} from '@/types/reviewVotes'

// API call to cast vote - implement in your service layer
async function castVote(reviewId: string, voteType: VoteType): Promise<CastVoteResponse> {
  const response = await fetch('/api/reviews/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      review_id: reviewId,
      vote_type: voteType ?? 'none',
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to cast vote')
  }

  return response.json()
}

/**
 * Review Vote Button Component
 *
 * Displays thumbs up/down voting interface with:
 * - Optimistic updates for instant feedback
 * - Anti-manipulation (prevents self-voting via API)
 * - Trust indicators (verified purchase badge)
 * - Accessible keyboard navigation
 */
export function ReviewVoteButton({
  reviewId,
  authorUserId,
  upvoteCount: initialUpvotes,
  downvoteCount: initialDownvotes,
  isVerifiedPurchase = false,
  initialUserVote = null,
  onVoteChange,
  disabled = false,
  size = 'md',
  showCounts = true,
  showHelpfulLabel = true,
}: ReviewVoteProps) {
  const [userVote, setUserVote] = useState<VoteType>(initialUserVote)
  const [upvotes, setUpvotes] = useState(initialUpvotes)
  const [downvotes, setDownvotes] = useState(initialDownvotes)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Calculate current stats
  const calculateStats = useCallback(
    (up: number, down: number): VoteStats => {
      const total = up + down
      return {
        upvotes: up,
        downvotes: down,
        total_votes: total,
        wilson_score: 0, // Calculated on server
        net_score: up - down,
        helpful_percentage: total > 0 ? Math.round((up / total) * 100) : 0,
      }
    },
    []
  )

  // Handle vote click
  const handleVote = useCallback(
    async (newVoteType: 'up' | 'down') => {
      if (disabled || isPending) return

      // Determine new vote state (toggle or switch)
      const targetVote: VoteType = userVote === newVoteType ? null : newVoteType

      // Store previous state for rollback
      const prevVote = userVote
      const prevUpvotes = upvotes
      const prevDownvotes = downvotes

      // Optimistic update
      setUserVote(targetVote)
      setError(null)

      // Calculate new counts optimistically
      let newUpvotes = upvotes
      let newDownvotes = downvotes

      // Remove previous vote
      if (prevVote === 'up') newUpvotes--
      if (prevVote === 'down') newDownvotes--

      // Add new vote
      if (targetVote === 'up') newUpvotes++
      if (targetVote === 'down') newDownvotes++

      setUpvotes(newUpvotes)
      setDownvotes(newDownvotes)

      // Notify parent
      onVoteChange?.(targetVote, calculateStats(newUpvotes, newDownvotes))

      // Make API call
      startTransition(async () => {
        try {
          await castVote(reviewId, targetVote)
        } catch (err) {
          // Rollback on error
          setUserVote(prevVote)
          setUpvotes(prevUpvotes)
          setDownvotes(prevDownvotes)
          setError(err instanceof Error ? err.message : 'Vote failed')
          onVoteChange?.(prevVote, calculateStats(prevUpvotes, prevDownvotes))
        }
      })
    },
    [
      disabled,
      isPending,
      userVote,
      upvotes,
      downvotes,
      reviewId,
      onVoteChange,
      calculateStats,
    ]
  )

  // Size variants
  const sizeClasses = {
    sm: {
      button: 'h-7 px-2 text-xs',
      icon: 'h-3.5 w-3.5',
      gap: 'gap-1',
    },
    md: {
      button: 'h-8 px-3 text-sm',
      icon: 'h-4 w-4',
      gap: 'gap-1.5',
    },
    lg: {
      button: 'h-10 px-4 text-base',
      icon: 'h-5 w-5',
      gap: 'gap-2',
    },
  }

  const s = sizeClasses[size]
  const totalVotes = upvotes + downvotes
  const helpfulPercent = totalVotes > 0 ? Math.round((upvotes / totalVotes) * 100) : null

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1">
        {/* Vote buttons */}
        <div className={cn('flex items-center', s.gap)}>
          {/* Helpful (thumbs up) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={userVote === 'up' ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  s.button,
                  s.gap,
                  'transition-all',
                  userVote === 'up' && 'bg-green-600 hover:bg-green-700 text-white',
                  userVote !== 'up' && 'hover:text-green-600 hover:bg-green-50'
                )}
                onClick={() => handleVote('up')}
                disabled={disabled || isPending}
                aria-label={userVote === 'up' ? 'Remove helpful vote' : 'Mark as helpful'}
                aria-pressed={userVote === 'up'}
              >
                <ThumbsUp
                  className={cn(
                    s.icon,
                    userVote === 'up' && 'fill-current'
                  )}
                />
                {showCounts && <span>{upvotes}</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{userVote === 'up' ? 'Remove helpful vote' : 'This review was helpful'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Not helpful (thumbs down) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={userVote === 'down' ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  s.button,
                  s.gap,
                  'transition-all',
                  userVote === 'down' && 'bg-red-600 hover:bg-red-700 text-white',
                  userVote !== 'down' && 'hover:text-red-600 hover:bg-red-50'
                )}
                onClick={() => handleVote('down')}
                disabled={disabled || isPending}
                aria-label={
                  userVote === 'down' ? 'Remove not helpful vote' : 'Mark as not helpful'
                }
                aria-pressed={userVote === 'down'}
              >
                <ThumbsDown
                  className={cn(
                    s.icon,
                    userVote === 'down' && 'fill-current'
                  )}
                />
                {showCounts && <span>{downvotes}</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {userVote === 'down'
                  ? 'Remove not helpful vote'
                  : 'This review was not helpful'}
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Verified purchase indicator */}
          {isVerifiedPurchase && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-green-600 ml-2">
                  <CheckCircle2 className={s.icon} />
                  <span className="text-xs font-medium">Verified</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reviewer made a verified purchase</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Helpful summary label */}
        {showHelpfulLabel && totalVotes > 0 && helpfulPercent !== null && (
          <p className="text-xs text-muted-foreground">
            {helpfulPercent}% found this helpful ({totalVotes}{' '}
            {totalVotes === 1 ? 'vote' : 'votes'})
          </p>
        )}

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </TooltipProvider>
  )
}

/**
 * Compact inline vote display (for lists)
 */
export function ReviewVoteInline({
  upvoteCount,
  downvoteCount,
  isVerifiedPurchase = false,
}: {
  upvoteCount: number
  downvoteCount: number
  isVerifiedPurchase?: boolean
}) {
  const netScore = upvoteCount - downvoteCount

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span
        className={cn(
          'flex items-center gap-1',
          netScore > 0 && 'text-green-600',
          netScore < 0 && 'text-red-600'
        )}
      >
        {netScore >= 0 ? (
          <ThumbsUp className="h-3.5 w-3.5" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5" />
        )}
        <span>{Math.abs(netScore)}</span>
      </span>

      {isVerifiedPurchase && (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  )
}

export default ReviewVoteButton
