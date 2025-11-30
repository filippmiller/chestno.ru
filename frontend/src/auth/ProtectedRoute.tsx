/**
 * Protected Route Component
 * 
 * Wraps routes that require authentication.
 * Redirects to /auth if user is not authenticated.
 */
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthV2 } from './AuthProviderV2'

interface ProtectedRouteProps {
    children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { status } = useAuthV2()
    const location = useLocation()

    if (status === 'loading') {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 text-lg">Загрузка...</div>
                    <div className="text-sm text-muted-foreground">Проверяем авторизацию</div>
                </div>
            </div>
        )
    }

    if (status === 'unauthenticated') {
        // Redirect to auth page, but save the attempted location
        return <Navigate to="/auth" state={{ from: location }} replace />
    }

    return <>{children}</>
}
