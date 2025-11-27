import axios from 'axios'

import { getSupabaseClient } from '@/lib/supabaseClient'

const baseURL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

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
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
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

