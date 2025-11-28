import { httpClient } from './httpClient'
import type {
  OrganizationPost,
  OrganizationPostCreate,
  OrganizationPostUpdate,
  OrganizationPostsResponse,
  PublicOrganizationPost,
  PublicOrganizationPostsResponse,
} from '@/types/posts'

export async function listOrganizationPosts(
  organizationId: string,
  params?: {
    status?: 'draft' | 'published' | 'archived'
    search?: string
    limit?: number
    offset?: number
  },
): Promise<OrganizationPostsResponse> {
  const response = await httpClient.get<OrganizationPostsResponse>(
    `/api/organizations/${organizationId}/posts`,
    { params },
  )
  return response.data
}

export async function getOrganizationPost(organizationId: string, postId: string): Promise<OrganizationPost> {
  const response = await httpClient.get<OrganizationPost>(`/api/organizations/${organizationId}/posts/${postId}`)
  return response.data
}

export async function createOrganizationPost(
  organizationId: string,
  payload: OrganizationPostCreate,
): Promise<OrganizationPost> {
  const response = await httpClient.post<OrganizationPost>(`/api/organizations/${organizationId}/posts`, payload)
  return response.data
}

export async function updateOrganizationPost(
  organizationId: string,
  postId: string,
  payload: OrganizationPostUpdate,
): Promise<OrganizationPost> {
  const response = await httpClient.patch<OrganizationPost>(
    `/api/organizations/${organizationId}/posts/${postId}`,
    payload,
  )
  return response.data
}

// Public API
export async function listPublicOrganizationPosts(
  slug: string,
  params?: { limit?: number; offset?: number },
): Promise<PublicOrganizationPostsResponse> {
  const response = await httpClient.get<PublicOrganizationPostsResponse>(`/api/public/organizations/by-slug/${slug}/posts`, {
    params,
  })
  return response.data
}

export async function listPublicOrganizationPostsById(
  organizationId: string,
  params?: { limit?: number; offset?: number },
): Promise<PublicOrganizationPostsResponse> {
  const response = await httpClient.get<PublicOrganizationPostsResponse>(`/api/public/organizations/${organizationId}/posts`, {
    params,
  })
  return response.data
}

export async function getPublicOrganizationPost(slug: string, postSlug: string): Promise<PublicOrganizationPost> {
  const response = await httpClient.get<PublicOrganizationPost>(
    `/api/public/organizations/by-slug/${slug}/posts/${postSlug}`,
  )
  return response.data
}

