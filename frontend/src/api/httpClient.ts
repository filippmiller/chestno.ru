import axios from 'axios'

import { getSupabaseClient } from '@/lib/supabaseClient'

// В production используем тот же origin, если VITE_BACKEND_URL не указан
// или явно указывает на localhost (Railway не должен ходить на локальный backend)
const rawBaseUrl = import.meta.env.VITE_BACKEND_URL?.trim()
const baseURL =
  rawBaseUrl && !rawBaseUrl.startsWith('http://localhost') && !rawBaseUrl.startsWith('https://localhost')
    ? rawBaseUrl
    : ''

export const httpClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

httpClient.interceptors.request.use(
  async (config) => {
    // Skip adding auth token for public auth endpoints (they don't need it)
    const publicAuthEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/yandex/start']
    const isPublicAuthEndpoint = publicAuthEndpoints.some((endpoint) => config.url?.includes(endpoint))
    if (isPublicAuthEndpoint) {
      return config
    }

    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token && !config.headers?.Authorization) {
        if (config.headers) {
          config.headers['Authorization'] = `Bearer ${token}`
        } else {
          config.headers = {
            Authorization: `Bearer ${token}`,
          } as typeof config.headers
        }
      }
    } catch (error) {
      // If getSession fails, don't block the request - just log and continue
      console.warn('Failed to get session for request interceptor:', error)
    }
    return config
  },
  (error) => {
    // Handle request interceptor errors
    console.error('Request interceptor error:', error)
    return Promise.reject(error)
  },
)

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API error', error.response ?? error)
    return Promise.reject(error)
  },
)

