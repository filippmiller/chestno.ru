/**
 * Toast hook for displaying notifications
 *
 * Simple toast implementation using state and setTimeout.
 * In production, consider using a library like sonner or react-hot-toast.
 */

import { useState, useCallback } from 'react'

interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

interface Toast extends ToastOptions {
  id: string
}

// Global toast state for simple implementation
let toastListeners: Array<(toast: Toast) => void> = []
let dismissListeners: Array<(id: string) => void> = []

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((options: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant || 'default',
      duration: options.duration || 5000,
    }

    setToasts((prev) => [...prev, newToast])

    // Auto dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, newToast.duration)

    // Notify listeners (for console logging in dev)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Toast] ${options.variant === 'destructive' ? 'ERROR' : 'INFO'}: ${options.title}`, options.description)
    }

    return id
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return {
    toast,
    dismiss,
    toasts,
  }
}
