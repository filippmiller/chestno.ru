/**
 * API service for Competitor Benchmarking feature.
 */
import type { BenchmarkResponse } from '@/types/benchmarks'
import { httpClient } from './httpClient'

/**
 * Get benchmark comparison for an organization against category peers.
 * @param organizationId - The organization ID to benchmark
 * @param days - Period for trend analysis (7-90 days, default 30)
 */
export async function getOrganizationBenchmarks(
  organizationId: string,
  days: number = 30
): Promise<BenchmarkResponse> {
  const { data } = await httpClient.get<BenchmarkResponse>(
    `/api/v1/organizations/${organizationId}/benchmarks`,
    { params: { days } }
  )
  return data
}
