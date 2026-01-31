import axios from 'axios'

import { getSupabaseClient } from '@/lib/supabaseClient'

// Определяем baseURL для API запросов
// В production на Railway frontend и backend на одном домене, поэтому используем тот же origin
// Если VITE_BACKEND_URL указан и не localhost, используем его
// Иначе используем window.location.origin (текущий домен)
const rawBaseUrl = import.meta.env.VITE_BACKEND_URL?.trim()
let baseURL = ''

if (import.meta.env.DEV) {
  // В режиме разработки используем прокси (пустой baseURL или origin),
  // чтобы избежать CORS и использовать настройки vite.config.ts
  baseURL = window.location.origin
} else if (rawBaseUrl) {
  // Используем явно указанный URL
  baseURL = rawBaseUrl
} else if (typeof window !== 'undefined') {
  // В браузере используем текущий origin (для production на Railway)
  baseURL = window.location.origin
} else {
  // В SSR или других случаях - пустая строка (относительные URL)
  baseURL = ''
}

const httpDebugEnabled = import.meta.env.DEV || import.meta.env.VITE_HTTP_DEBUG === 'true'
const debugLog = (...args: unknown[]) => {
  if (httpDebugEnabled) {
    console.log(...args)
  }
}
const debugWarn = (...args: unknown[]) => {
  if (httpDebugEnabled) {
    console.warn(...args)
  }
}

// Log baseURL configuration for debugging
debugLog('[httpClient] Initializing httpClient')
debugLog('[httpClient] VITE_BACKEND_URL from env:', import.meta.env.VITE_BACKEND_URL)
debugLog('[httpClient] window.location.origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A (SSR)')
debugLog('[httpClient] Final baseURL:', baseURL)

export const httpClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required for cookie-based auth (Auth V2)
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

    debugLog('[httpClient] Request interceptor called:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL || '(empty)',
      fullUrl: fullUrl || '(could not determine)',
      headers: Object.keys(config.headers || {}),
    })

    // Убеждаемся, что baseURL установлен
    if (!config.baseURL && typeof window !== 'undefined' && config.url && !config.url.startsWith('http')) {
      debugLog('[httpClient] Setting baseURL to window.location.origin as fallback')
      config.baseURL = window.location.origin
      fullUrl = `${window.location.origin}${config.url}`
    }

    // Skip adding auth token for public auth endpoints (they don't need it)
    const publicAuthEndpoints = [
      '/api/auth/login', 
      '/api/auth/register', 
      '/api/auth/yandex/start',
      '/api/auth/v2/login',  // Auth V2 login endpoint
      '/api/auth/v2/signup',  // Auth V2 signup endpoint
      '/api/auth/v2/logout',  // Auth V2 logout endpoint
      '/api/auth/v2/oauth-callback',  // Auth V2 OAuth callback
      '/api/auth/v2/yandex/start',  // Auth V2 Yandex OAuth start
      '/api/auth/v2/google/start',  // Auth V2 Google OAuth start
    ]
    const isPublicAuthEndpoint = publicAuthEndpoints.some((endpoint) => config.url?.includes(endpoint))

    if (isPublicAuthEndpoint) {
      debugLog('[httpClient] Public auth endpoint detected, skipping auth token')
      debugLog('[httpClient] Final request config:', {
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
        debugLog('[httpClient] Added auth token to request')
      } else {
        debugLog('[httpClient] No auth token needed or already present')
      }
    } catch (error) {
      // If getSession fails, don't block the request - just log and continue
      debugWarn('[httpClient] Failed to get session for request interceptor:', error)
    }

    debugLog('[httpClient] Request interceptor completed, final URL:', fullUrl)
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
    debugLog('[httpClient] Response received:', {
      status: response.status,
      url: response.config.url,
      method: response.config.method,
    })
    return response
  },
  (error) => {
    // Only log non-401 errors (401 is expected for unauthenticated users)
    if (error.response?.status !== 401) {
      console.error('[httpClient] API error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        data: error.response?.data,
      })
    }
    return Promise.reject(error)
  },
)

