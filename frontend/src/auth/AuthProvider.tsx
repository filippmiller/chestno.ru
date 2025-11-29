/**
 * Authentication Context Provider
 * 
 * Provides authentication state and methods throughout the app.
 * Relies on Supabase Auth as the single source of truth.
 */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { httpClient } from '@/api/httpClient'
import type { AppUser, Organization, OrganizationMembership, PlatformRole, SessionPayload } from '@/types/auth'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextType {
    status: AuthStatus
    session: Session | null
    user: AppUser | null
    organizations: Organization[]
    memberships: OrganizationMembership[]
    platformRoles: PlatformRole[]

    // Auth methods
    loginWithEmail: (email: string, password: string) => Promise<void>
    signupWithEmail: (email: string, password: string, fullName?: string) => Promise<void>
    loginWithGoogle: () => Promise<void>
    loginWithYandex: () => Promise<void>
    logout: () => Promise<void>
    resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const supabase = getSupabaseClient()

    const [status, setStatus] = useState<AuthStatus>('loading')
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<AppUser | null>(null)
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [memberships, setMemberships] = useState<OrganizationMembership[]>([])
    const [platformRoles, setPlatformRoles] = useState<PlatformRole[]>([])

    // Fetch application data from backend
    const fetchAppUserData = async (supabaseSession: Session) => {
        try {
            console.log('[AuthProvider] Fetching app user data...')
            const { data } = await httpClient.get<SessionPayload>('/api/auth/me', {
                headers: {
                    Authorization: `Bearer ${supabaseSession.access_token}`
                }
            })

            setUser(data.user)
            setOrganizations(data.organizations)
            setMemberships(data.memberships)
            setPlatformRoles(data.platform_roles)
            setStatus('authenticated')

            console.log('[AuthProvider] App user data loaded:', data.user.email)
        } catch (error) {
            console.error('[AuthProvider] Failed to fetch app user data:', error)
            // If backend fails but Supabase session is valid, still consider authenticated
            // but with limited data
            setStatus('authenticated')
        }
    }

    // Initialize: check for existing session
    useEffect(() => {
        console.log('[AuthProvider] Initializing...')

        const initAuth = async () => {
            try {
                const { data: { session: existingSession }, error } = await supabase.auth.getSession()

                if (error) {
                    console.error('[AuthProvider] Error getting session:', error)
                    setStatus('unauthenticated')
                    return
                }

                if (existingSession) {
                    console.log('[AuthProvider] Existing session found')
                    setSession(existingSession)
                    await fetchAppUserData(existingSession)
                } else {
                    console.log('[AuthProvider] No existing session')
                    setStatus('unauthenticated')
                }
            } catch (error) {
                console.error('[AuthProvider] Init error:', error)
                setStatus('unauthenticated')
            }
        }

        initAuth()

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            console.log('[AuthProvider] Auth state changed:', event)

            if (event === 'SIGNED_IN' && newSession) {
                setSession(newSession)
                await fetchAppUserData(newSession)
            } else if (event === 'SIGNED_OUT') {
                setSession(null)
                setUser(null)
                setOrganizations([])
                setMemberships([])
                setPlatformRoles([])
                setStatus('unauthenticated')
            } else if (event === 'TOKEN_REFRESHED' && newSession) {
                setSession(newSession)
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    // Auth methods
    const loginWithEmail = async (email: string, password: string) => {
        setStatus('loading')
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password })

            if (error) throw error

            if (data.session) {
                setSession(data.session)
                await fetchAppUserData(data.session)
            }
        } catch (error: any) {
            setStatus('unauthenticated')
            throw error
        }
    }

    const signupWithEmail = async (email: string, password: string, fullName?: string) => {
        setStatus('loading')
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName || null
                    }
                }
            })

            if (error) throw error

            // Note: Depending on Supabase config, user might need to confirm email
            if (data.session) {
                setSession(data.session)
                await fetchAppUserData(data.session)
            } else {
                // Email confirmation required
                setStatus('unauthenticated')
            }
        } catch (error: any) {
            setStatus('unauthenticated')
            throw error
        }
    }

    const loginWithGoogle = async () => {
        const redirectTo = `${window.location.origin}/auth/callback`
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo }
        })
    }

    const loginWithYandex = async () => {
        const redirectTo = `${window.location.origin}/auth/callback`
        await supabase.auth.signInWithOAuth({
            provider: 'yandex',
            options: { redirectTo }
        })
    }

    const logout = async () => {
        await supabase.auth.signOut()
        // State will be cleared by onAuthStateChange listener
    }

    const resetPassword = async (email: string) => {
        const redirectTo = `${window.location.origin}/auth/reset`
        await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    }

    const value: AuthContextType = {
        status,
        session,
        user,
        organizations,
        memberships,
        platformRoles,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        loginWithYandex,
        logout,
        resetPassword,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
