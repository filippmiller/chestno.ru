/**
 * Authentication Context Provider V2
 * 
 * Cookie-based authentication using backend sessions.
 * Uses httpOnly cookies instead of localStorage tokens.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { httpClient } from '@/api/httpClient'
import { getSupabaseClient } from '@/lib/supabaseClient'
import type { AppUser, Organization, OrganizationMembership, SessionPayload } from '@/types/auth'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextType {
    status: AuthStatus
    user: AppUser | null
    role: string | null
    organizations: Organization[]
    memberships: OrganizationMembership[]
    platformRoles: string[]

    // Auth methods
    loginWithEmail: (email: string, password: string) => Promise<string | void>
    signupWithEmail: (email: string, password: string, fullName?: string) => Promise<string | void>
    loginWithGoogle: () => Promise<void>
    loginWithYandex: () => Promise<void>
    logout: () => Promise<void>
    resetPassword: (email: string) => Promise<void>
    fetchAppUserData: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProviderV2({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<AuthStatus>('loading')
    const [user, setUser] = useState<AppUser | null>(null)
    const [role, setRole] = useState<string | null>(null)
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [memberships, setMemberships] = useState<OrganizationMembership[]>([])
    const [platformRoles, setPlatformRoles] = useState<string[]>([])

    // Fetch application data from backend
    const fetchAppUserData = async () => {
        try {
            console.log('[AuthProviderV2] Fetching app user data...')
            const { data } = await httpClient.get<SessionPayload>('/api/auth/v2/me')
            
            setUser(data.user)
            setOrganizations(data.organizations)
            setMemberships(data.memberships)
            setPlatformRoles(data.platform_roles)
            
            // Extract role from user or platform_roles
            const userRole = (data.user as any).role || 
                           (data.platform_roles.includes('platform_admin') ? 'admin' : 'user')
            setRole(userRole)
            
            setStatus('authenticated')
            console.log('[AuthProviderV2] App user data loaded:', data.user.email)
        } catch (error: any) {
            console.error('[AuthProviderV2] Failed to fetch app user data:', error)
            setStatus('unauthenticated')
            setUser(null)
            setRole(null)
            setOrganizations([])
            setMemberships([])
            setPlatformRoles([])
        }
    }

    // Initialize: check for existing session
    useEffect(() => {
        console.log('[AuthProviderV2] Initializing...')
        fetchAppUserData()
    }, [])

    // Auth methods
    const loginWithEmail = async (email: string, password: string) => {
        try {
            console.log('[AuthProviderV2] Starting login request to /api/auth/v2/login')
            console.log('[AuthProviderV2] httpClient baseURL:', httpClient.defaults.baseURL)
            console.log('[AuthProviderV2] httpClient withCredentials:', httpClient.defaults.withCredentials)
            
            const response = await httpClient.post('/api/auth/v2/login', {
                email,
                password,
            })
            
            console.log('[AuthProviderV2] Login response received:', {
                status: response.status,
                hasData: !!response.data,
                redirectUrl: response.data?.redirect_url,
            })
            
            const { data } = response
            
            setUser(data.user)
            setRole(data.role)
            setStatus('authenticated')
            
            // Fetch full session data
            console.log('[AuthProviderV2] Fetching app user data...')
            await fetchAppUserData()
            console.log('[AuthProviderV2] App user data fetched successfully')
            
            // Redirect handled by caller
            return data.redirect_url
        } catch (error: any) {
            console.error('[AuthProviderV2] Login failed:', error)
            console.error('[AuthProviderV2] Error details:', {
                message: error.message,
                response: error.response,
                code: error.code,
                config: error.config,
            })
            throw error
        }
    }

    const signupWithEmail = async (email: string, password: string, fullName?: string) => {
        try {
            console.log('[AuthProviderV2] Starting signup request to /api/auth/v2/signup')
            
            const response = await httpClient.post('/api/auth/v2/signup', {
                email,
                password,
                full_name: fullName || undefined,
            })
            
            console.log('[AuthProviderV2] Signup response received:', {
                status: response.status,
                hasData: !!response.data,
                redirectUrl: response.data?.redirect_url,
            })
            
            const { data } = response
            
            setUser(data.user)
            setRole(data.role)
            setStatus('authenticated')
            
            // Fetch full session data
            console.log('[AuthProviderV2] Fetching app user data after signup...')
            await fetchAppUserData()
            console.log('[AuthProviderV2] App user data fetched successfully')
            
            // Return redirect URL if provided
            return data.redirect_url
        } catch (error: any) {
            console.error('[AuthProviderV2] Signup failed:', error)
            console.error('[AuthProviderV2] Error details:', {
                message: error.message,
                response: error.response,
                code: error.code,
            })
            throw error
        }
    }

    const loginWithGoogle = async () => {
        // Redirect to backend OAuth endpoint
        window.location.href = '/api/auth/v2/google/start'
    }

    const loginWithYandex = async () => {
        // Redirect to backend OAuth endpoint
        const { data } = await httpClient.get('/api/auth/v2/yandex/start')
        if (data.redirect_url) {
            window.location.href = data.redirect_url
        }
    }

    const logout = async () => {
        try {
            await httpClient.post('/api/auth/v2/logout')
        } catch (error) {
            console.error('[AuthProviderV2] Logout error:', error)
        } finally {
            setStatus('unauthenticated')
            setUser(null)
            setRole(null)
            setOrganizations([])
            setMemberships([])
            setPlatformRoles([])
            window.location.href = '/'
        }
    }

    const resetPassword = async (email: string) => {
        // Password reset uses Supabase directly (no backend endpoint needed)
        const supabase = getSupabaseClient()
        const redirectTo = `${window.location.origin}/auth/reset`
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
        if (error) {
            throw error
        }
    }

    const value: AuthContextType = {
        status,
        user,
        role,
        organizations,
        memberships,
        platformRoles,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        loginWithYandex,
        logout,
        resetPassword,
        fetchAppUserData,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthV2() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuthV2 must be used within AuthProviderV2')
    }
    return context
}

