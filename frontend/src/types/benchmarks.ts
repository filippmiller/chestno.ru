/**
 * TypeScript types for Competitor Benchmarking feature.
 */

export interface MetricComparison {
  value: number | null
  category_avg: number | null
  percentile: number | null
  diff_percent: number | null
}

export interface TrendData {
  current_period_value: number | null
  previous_period_value: number | null
  change_percent: number | null
  trend: 'up' | 'down' | 'stable'
}

export interface BenchmarkMetrics {
  average_rating: MetricComparison
  total_reviews: MetricComparison
  response_rate: MetricComparison
  avg_response_time_hours: MetricComparison | null
}

export interface BenchmarkTrends {
  rating_trend: TrendData
  reviews_trend: TrendData
  response_rate_trend: TrendData
}

export interface CategoryInfo {
  name: string | null
  total_organizations: number
  total_reviews: number
}

export interface BenchmarkResponse {
  organization_id: string
  organization_name: string
  category: CategoryInfo
  metrics: BenchmarkMetrics
  trends: BenchmarkTrends
  generated_at: string
  period_days: number
}
