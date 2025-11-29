import axios from 'axios'

import { getSupabaseClient } from '@/lib/supabaseClient'

// Определяем baseURL для API запросов
// В production на Railway frontend и backend на одном домене, поэтому используем тот же origin
// Если VITE_BACKEND_URL указан и не localhost, используем его
// Иначе используем window.location.origin (текущий домен)
const rawBaseUrl = import.meta.env.VITE_BACKEND_URL?.trim()
let baseURL = ''

if (rawBaseUrl && !rawBaseUrl.startsWith('http://localhost') && !rawBaseUrl.startsWith('https://localhost')) {
  // Используем явно указанный URL
  baseURL = rawBaseUrl
} else if (typeof window !== 'undefined') {
  // В браузере используем текущий origin (для production на Railway)
  baseURL = window.location.origin
} else {
  // В SSR или других случаях - пустая строка (относительные URL)
  baseURL = ''
}

// Log baseURL configuration for debugging
console.log('[httpClient] Initializing httpClient')
console.log('[httpClient] VITE_BACKEND_URL from env:', import.meta.env.VITE_BACKEND_URL)
console.log('[httpClient] window.location.origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A (SSR)')
console.log('[httpClient] Final baseURL:', baseURL)

export const httpClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

httpClient.interceptors.request.use(
  async (config) => {
    // Формируем полный URL для логирования
    let fullUrl = config.url || ''
    if (config.baseURL) {
      fullUrl = config.baseURL.endsWith('/') && config.url?.startsWith('/')
        ? `${config.baseURL}${config.url.slice(1)}`
        : `${config.baseURL}${config.url}`
    } else if (config.url && !config.url.startsWith('http')) {
      // Если baseURL пустой, но URL относительный, используем текущий origin
      if (typeof window !== 'undefined') {
        fullUrl = `${window.location.origin}${config.url}`
      }
    }
    
    console.log('[httpClient] Request interceptor called:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL || '(empty)',
      fullUrl: fullUrl || '(could not determine)',
      headers: Object.keys(config.headers || {}),
    })
    
    // Убеждаемся, что baseURL установлен
    if (!config.baseURL && typeof window !== 'undefined' && config.url && !config.url.startsWith('http')) {
      console.log('[httpClient] Setting baseURL to window.location.origin as fallback')
      config.baseURL = window.location.origin
      fullUrl = `${window.location.origin}${config.url}`
    }

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

