/**
 * OAuth Callback Page
 * 
 * Handles redirect after OAuth login (Google, Yandex).
 * Supabase automatically handles the token exchange,
 * we just need to redirect to the appropriate page.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthV2 } from './AuthProviderV2'

export function AuthCallbackPage() {
    const navigate = useNavigate()
    const { status } = useAuthV2()

    useEffect(() => {
        console.log('[AuthCallbackPage] status:', status)

        if (status === 'authenticated') {
            // Successfully authenticated, redirect to dashboard
            navigate('/dashboard', { replace: true })
        } else if (status === 'unauthenticated') {
            // Auth failed, redirect back to auth page
            navigate('/auth', { replace: true })
        }
        // If status is 'loading', wait for it to resolve
    }, [status, navigate])

    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
                <div className="mb-4 text-lg">Завершение входа...</div>
                <div className="text-sm text-muted-foreground">Пожалуйста, подождите</div>
            </div>
        </div>
    )
}
