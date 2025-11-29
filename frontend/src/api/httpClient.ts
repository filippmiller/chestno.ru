import axios from 'axios'

import { getSupabaseClient } from '@/lib/supabaseClient'

// В production используем тот же origin, если VITE_BACKEND_URL не указан
const baseURL =
  import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL.trim().length > 0
    ? import.meta.env.VITE_BACKEND_URL
    : ''

export const httpClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

httpClient.interceptors.request.use(async (config) => {
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
  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API error', error.response ?? error)
    return Promise.reject(error)
  },
)

