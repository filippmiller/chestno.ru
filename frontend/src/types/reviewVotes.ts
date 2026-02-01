/**
 * Review Helpfulness Voting Types
 * Types for the up/down voting system with trust weighting
 */

// Vote types
export type VoteType = 'up' | 'down' | null

// User's vote on a review
export interface ReviewVote {
  review_id: string
  vote_type: VoteType
  is_verified_voter: boolean
  vote_weight: number
  created_at: string
}

// Review with vote counts (extended from base Review type)
export interface ReviewWithVotes {
  id: string
  organization_id: string
  product_id?: string | null
  author_user_id: string
  rating: number
  title?: string | null
  body: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string

  // Vote fields
  upvote_count: number
  downvote_count: number
  helpful_count: number // Legacy, equals upvote_count
  wilson_score: number

  // Verification
  is_verified_purchase: boolean

  // User's current vote (populated client-side)
  user_vote?: VoteType
}

// Response from cast_review_vote function
export interface CastVoteResponse {
  success: boolean
  action: 'created' | 'updated' | 'removed'
  vote_type: VoteType
  vote_weight?: number
  previous_vote?: VoteType
}

// Batch vote lookup response
export interface UserVotesMap {
  [reviewId: string]: VoteType
}

// Sorting options for reviews
export type ReviewSortOption =
  | 'most_helpful'  // Wilson score descending
  | 'most_recent'   // Created at descending
  | 'highest_rated' // Rating descending
  | 'lowest_rated'  // Rating ascending

// Verified purchase record
export interface VerifiedPurchase {
  id: string
  user_id: string
  organization_id: string
  product_id?: string | null
  verification_method: 'qr_scan' | 'receipt_upload' | 'order_integration' | 'manual_approval'
  verified_at: string
  purchase_date?: string | null
}

// Vote statistics for a review
export interface VoteStats {
  upvotes: number
  downvotes: number
  total_votes: number
  wilson_score: number
  net_score: number // upvotes - downvotes
  helpful_percentage: number // upvotes / total * 100
}

// Props for the voting component
export interface ReviewVoteProps {
  reviewId: string
  authorUserId: string
  upvoteCount: number
  downvoteCount: number
  isVerifiedPurchase?: boolean
  initialUserVote?: VoteType
  onVoteChange?: (newVote: VoteType, stats: VoteStats) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  showCounts?: boolean
  showHelpfulLabel?: boolean
}

// Vote action for optimistic updates
export interface VoteAction {
  type: 'vote'
  reviewId: string
  previousVote: VoteType
  newVote: VoteType
}
