/**
 * Supply Chain Visualization API Service
 * Handles all API calls for supply chain nodes and steps
 */

import { httpClient } from './httpClient'
import type {
  SupplyChainJourney,
  SupplyChainNode,
  SupplyChainNodeCreate,
  SupplyChainNodeUpdate,
  SupplyChainStats,
  SupplyChainStep,
  SupplyChainStepCreate,
  SupplyChainStepUpdate,
} from '@/types/supply-chain'

const API_BASE = '/api/supply-chain'

// ============================================================
// PUBLIC ENDPOINTS (no auth required)
// ============================================================

/**
 * Get the complete supply chain journey for a product
 */
export async function getProductSupplyChain(productId: string): Promise<SupplyChainJourney> {
  const response = await httpClient.get<SupplyChainJourney>(`${API_BASE}/product/${productId}`)
  return response.data
}

/**
 * Alias for getProductSupplyChain
 */
export async function getSupplyChainJourney(productId: string): Promise<SupplyChainJourney> {
  const response = await httpClient.get<SupplyChainJourney>(`${API_BASE}/journey/${productId}`)
  return response.data
}

/**
 * Get supply chain statistics for a product
 */
export async function getSupplyChainStats(productId: string): Promise<SupplyChainStats> {
  const response = await httpClient.get<SupplyChainStats>(`${API_BASE}/product/${productId}/stats`)
  return response.data
}

/**
 * Get all supply chain nodes for a product (public)
 */
export async function getProductNodes(productId: string): Promise<SupplyChainNode[]> {
  const response = await httpClient.get<SupplyChainNode[]>(`${API_BASE}/product/${productId}/nodes`)
  return response.data
}

/**
 * Get all supply chain steps for a product (public)
 */
export async function getProductSteps(productId: string): Promise<SupplyChainStep[]> {
  const response = await httpClient.get<SupplyChainStep[]>(`${API_BASE}/product/${productId}/steps`)
  return response.data
}

// ============================================================
// AUTHENTICATED ENDPOINTS - Nodes
// ============================================================

/**
 * Create a new supply chain node
 */
export async function createNode(
  organizationId: string,
  payload: SupplyChainNodeCreate
): Promise<SupplyChainNode> {
  const response = await httpClient.post<SupplyChainNode>(
    `${API_BASE}/nodes`,
    payload,
    { params: { organization_id: organizationId } }
  )
  return response.data
}

/**
 * Get a single supply chain node by ID
 */
export async function getNode(nodeId: string): Promise<SupplyChainNode> {
  const response = await httpClient.get<SupplyChainNode>(`${API_BASE}/nodes/${nodeId}`)
  return response.data
}

/**
 * Update a supply chain node
 */
export async function updateNode(
  nodeId: string,
  payload: SupplyChainNodeUpdate
): Promise<SupplyChainNode> {
  const response = await httpClient.put<SupplyChainNode>(`${API_BASE}/nodes/${nodeId}`, payload)
  return response.data
}

/**
 * Delete a supply chain node
 */
export async function deleteNode(nodeId: string): Promise<{ deleted: boolean; node_id: string }> {
  const response = await httpClient.delete<{ deleted: boolean; node_id: string }>(
    `${API_BASE}/nodes/${nodeId}`
  )
  return response.data
}

/**
 * Verify a supply chain node
 */
export async function verifyNode(
  nodeId: string,
  notes?: string
): Promise<SupplyChainNode> {
  const response = await httpClient.post<SupplyChainNode>(
    `${API_BASE}/nodes/${nodeId}/verify`,
    null,
    { params: notes ? { notes } : undefined }
  )
  return response.data
}

// ============================================================
// AUTHENTICATED ENDPOINTS - Steps
// ============================================================

/**
 * Create a new supply chain step
 */
export async function createStep(
  productId: string,
  payload: SupplyChainStepCreate
): Promise<SupplyChainStep> {
  const response = await httpClient.post<SupplyChainStep>(
    `${API_BASE}/product/${productId}/steps`,
    payload
  )
  return response.data
}

/**
 * Get a single supply chain step by ID
 */
export async function getStep(stepId: string): Promise<SupplyChainStep> {
  const response = await httpClient.get<SupplyChainStep>(`${API_BASE}/steps/${stepId}`)
  return response.data
}

/**
 * Update a supply chain step
 */
export async function updateStep(
  stepId: string,
  payload: SupplyChainStepUpdate
): Promise<SupplyChainStep> {
  const response = await httpClient.put<SupplyChainStep>(`${API_BASE}/steps/${stepId}`, payload)
  return response.data
}

/**
 * Delete a supply chain step
 */
export async function deleteStep(stepId: string): Promise<{ deleted: boolean; step_id: string }> {
  const response = await httpClient.delete<{ deleted: boolean; step_id: string }>(
    `${API_BASE}/steps/${stepId}`
  )
  return response.data
}

/**
 * Verify a supply chain step
 */
export async function verifyStep(
  stepId: string,
  notes?: string
): Promise<SupplyChainStep> {
  const response = await httpClient.post<SupplyChainStep>(
    `${API_BASE}/steps/${stepId}/verify`,
    null,
    { params: notes ? { notes } : undefined }
  )
  return response.data
}

// ============================================================
// ORGANIZATION ENDPOINTS
// ============================================================

/**
 * Get all supply chain nodes for an organization
 */
export async function getOrganizationNodes(
  organizationId: string,
  productId?: string
): Promise<SupplyChainNode[]> {
  const response = await httpClient.get<SupplyChainNode[]>(
    `${API_BASE}/organization/${organizationId}/nodes`,
    { params: productId ? { product_id: productId } : undefined }
  )
  return response.data
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Calculate verification percentage from journey data
 */
export function calculateVerificationPercentage(journey: SupplyChainJourney): number {
  const totalItems = journey.total_nodes + journey.total_steps
  const verifiedItems = journey.verified_nodes + journey.verified_steps
  if (totalItems === 0) return 0
  return Math.round((verifiedItems / totalItems) * 100)
}

/**
 * Format distance for display
 */
export function formatDistance(km: number | null | undefined): string {
  if (km == null) return '-'
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

/**
 * Format duration for display
 */
export function formatDuration(hours: number | null | undefined): string {
  if (hours == null) return '-'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) return `${hours.toFixed(1)} hrs`
  const days = Math.floor(hours / 24)
  const remainingHours = Math.round(hours % 24)
  return `${days}d ${remainingHours}h`
}
