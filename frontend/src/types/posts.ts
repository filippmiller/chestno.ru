export interface GalleryItem {
  url: string
  alt?: string | null
  sort_order?: number | null
}

export interface OrganizationPost {
  id: string
  organization_id: string
  author_user_id: string
  slug: string
  title: string
  excerpt?: string | null
  body: string
  status: 'draft' | 'published' | 'archived'
  main_image_url?: string | null
  gallery: GalleryItem[]
  video_url?: string | null
  published_at?: string | null
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface OrganizationPostCreate {
  slug: string
  title: string
  excerpt?: string | null
  body: string
  status?: 'draft' | 'published' | 'archived'
  main_image_url?: string | null
  gallery?: GalleryItem[]
  video_url?: string | null
  is_pinned?: boolean
}

export interface OrganizationPostUpdate {
  slug?: string
  title?: string
  excerpt?: string | null
  body?: string
  status?: 'draft' | 'published' | 'archived'
  main_image_url?: string | null
  gallery?: GalleryItem[]
  video_url?: string | null
  is_pinned?: boolean
  published_at?: string | null
}

export interface PublicOrganizationPost {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  body: string
  main_image_url?: string | null
  gallery: GalleryItem[]
  video_url?: string | null
  published_at: string
  is_pinned: boolean
}

export interface OrganizationPostsResponse {
  items: OrganizationPost[]
  total: number
}

export interface PublicOrganizationPostsResponse {
  items: PublicOrganizationPost[]
  total: number
}

