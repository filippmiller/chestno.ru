/**
 * Review Votes API Service
 * Handles all vote-related API calls with proper error handling
 */

import type {
  VoteType,
  CastVoteResponse,
  UserVotesMap,
  ReviewSortOption,
  ReviewWithVotes,
} from '@/types/reviewVotes'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

/**
 * Cast or update a vote on a review
 */
export async function castReviewVote(
  reviewId: string,
  voteType: VoteType
): Promise<CastVoteResponse> {
  const response = await fetch(`${API_BASE}/reviews/${reviewId}/vote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      vote_type: voteType ?? 'none',
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }))

    // Handle specific error cases
    if (response.status === 401) {
      throw new Error('Please log in to vote on reviews')
    }
    if (response.status === 403) {
      throw new Error(error.message || 'You cannot vote on your own review')
    }
    if (response.status === 404) {
      throw new Error('Review not found')
    }

    throw new Error(error.message || 'Failed to cast vote')
  }

  return response.json()
}

/**
 * Remove a vote from a review
 */
export async function removeReviewVote(reviewId: string): Promise<CastVoteResponse> {
  return castReviewVote(reviewId, null)
}

/**
 * Get user's current vote on a single review
 */
export async function getUserVote(reviewId: string): Promise<VoteType> {
  const response = await fetch(`${API_BASE}/reviews/${reviewId}/vote`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    if (response.status === 401) {
      return null // Not logged in
    }
    throw new Error('Failed to fetch vote')
  }

  const data = await response.json()
  return data.vote_type as VoteType
}

/**
 * Get user's votes for multiple reviews (batch)
 * Useful for list pages to avoid N+1 queries
 */
export async function getUserVotes(reviewIds: string[]): Promise<UserVotesMap> {
  if (reviewIds.length === 0) {
    return {}
  }

  const response = await fetch(`${API_BASE}/reviews/votes/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ review_ids: reviewIds }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      return {} // Not logged in, no votes
    }
    throw new Error('Failed to fetch votes')
  }

  const data = await response.json()

  // Convert array response to map
  const votesMap: UserVotesMap = {}
  if (Array.isArray(data.votes)) {
    for (const vote of data.votes) {
      votesMap[vote.review_id] = vote.vote_type
    }
  }

  return votesMap
}

/**
 * Fetch reviews with sorting options
 */
export async function fetchReviews(params: {
  organizationId?: string
  productId?: string
  sort?: ReviewSortOption
  page?: number
  limit?: number
}): Promise<{
  reviews: ReviewWithVotes[]
  total: number
  page: number
  totalPages: number
}> {
  const searchParams = new URLSearchParams()

  if (params.organizationId) {
    searchParams.set('organization_id', params.organizationId)
  }
  if (params.productId) {
    searchParams.set('product_id', params.productId)
  }
  if (params.sort) {
    searchParams.set('sort', params.sort)
  }
  if (params.page) {
    searchParams.set('page', String(params.page))
  }
  if (params.limit) {
    searchParams.set('limit', String(params.limit))
  }

  const response = await fetch(`${API_BASE}/reviews?${searchParams.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to fetch reviews')
  }

  return response.json()
}

/**
 * Sort option display configuration
 */
export const SORT_OPTIONS: Array<{
  value: ReviewSortOption
  label: string
  description: string
}> = [
  {
    value: 'most_helpful',
    label: 'Most Helpful',
    description: 'Reviews that others found useful',
  },
  {
    value: 'most_recent',
    label: 'Most Recent',
    description: 'Newest reviews first',
  },
  {
    value: 'highest_rated',
    label: 'Highest Rated',
    description: '5-star reviews first',
  },
  {
    value: 'lowest_rated',
    label: 'Lowest Rated',
    description: '1-star reviews first',
  },
]
