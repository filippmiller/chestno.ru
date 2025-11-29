import axios from 'axios'

import { getSupabaseClient } from '@/lib/supabaseClient'

// В production используем тот же origin, если VITE_BACKEND_URL не указан
// или явно указывает на localhost (Railway не должен ходить на локальный backend)
const rawBaseUrl = import.meta.env.VITE_BACKEND_URL?.trim()
const baseURL =
  rawBaseUrl && !rawBaseUrl.startsWith('http://localhost') && !rawBaseUrl.startsWith('https://localhost')
    ? rawBaseUrl
    : ''

// Log baseURL configuration for debugging
console.log('[httpClient] Initializing with baseURL:', baseURL || '(empty - using same origin)')
console.log('[httpClient] VITE_BACKEND_URL from env:', import.meta.env.VITE_BACKEND_URL)

export const httpClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

httpClient.interceptors.request.use(
  async (config) => {
    const fullUrl = config.baseURL ? `${config.baseURL}${config.url}` : config.url
    console.log('[httpClient] Request interceptor called:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL,
      fullUrl,
      headers: Object.keys(config.headers || {}),
    })

    // Skip adding auth token for public auth endpoints (they don't need it)
    const publicAuthEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/yandex/start']
    const isPublicAuthEndpoint = publicAuthEndpoints.some((endpoint) => config.url?.includes(endpoint))
    
    if (isPublicAuthEndpoint) {
      console.log('[httpClient] Public auth endpoint detected, skipping auth token')
      console.log('[httpClient] Final request config:', {
        method: config.method,
        url: fullUrl,
        headers: config.headers,
      })
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
        console.log('[httpClient] Added auth token to request')
      } else {
        console.log('[httpClient] No auth token needed or already present')
      }
    } catch (error) {
      // If getSession fails, don't block the request - just log and continue
      console.warn('[httpClient] Failed to get session for request interceptor:', error)
    }
    
    console.log('[httpClient] Request interceptor completed, final URL:', fullUrl)
    return config
  },
  (error) => {
    // Handle request interceptor errors
    console.error('[httpClient] Request interceptor error:', error)
    return Promise.reject(error)
  },
)

httpClient.interceptors.response.use(
  (response) => {
    console.log('[httpClient] Response received:', {
      status: response.status,
      url: response.config.url,
      method: response.config.method,
    })
    return response
  },
  (error) => {
    console.error('[httpClient] API error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
      data: error.response?.data,
    })
    return Promise.reject(error)
  },
)

