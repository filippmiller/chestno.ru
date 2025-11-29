import { useEffect } from 'react'
import { AppRoutes } from '@/routes'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { useUserStore } from '@/store/userStore'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { fetchSession } from '@/api/authService'

function App() {
  const { user, reset, platformRoles, setSessionData, setLoading } = useUserStore()
  const supabase = getSupabaseClient()

  // Загружаем сессию при инициализации приложения
  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error('Error getting Supabase session:', sessionError)
          setLoading(false)
          return
        }
        if (session && !user) {
          setLoading(true)
          try {
            const sessionPayload = await fetchSession()
            console.log('App - loaded session:', sessionPayload)
            console.log('App - platform_roles:', sessionPayload.platform_roles)
            setSessionData(sessionPayload)
          } catch (fetchError) {
            console.error('Error fetching session data:', fetchError)
            // Try to use basic Supabase session data as fallback
            if (session.user) {
              console.warn('Using Supabase session data as fallback')
              setSessionData({
                user: {
                  id: session.user.id,
                  email: session.user.email || null,
                  full_name: session.user.user_metadata?.full_name || null,
                  locale: session.user.user_metadata?.locale || null,
                },
                organizations: [],
                memberships: [],
                platform_roles: [],
              })
            }
          } finally {
            setLoading(false)
          }
        } else if (!session) {
          console.log('No session found, user needs to log in')
          setLoading(false)
        }
      } catch (error) {
        console.error('Error loading session:', error)
        setLoading(false)
      }
    }
    void loadSession()

    // Слушаем изменения сессии
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        try {
          setLoading(true)
          const sessionPayload = await fetchSession()
          console.log('App - auth state changed, loaded session:', sessionPayload)
          setSessionData(sessionPayload)
          setLoading(false)
        } catch (error) {
          console.error('Error loading session on auth change:', error)
          setLoading(false)
        }
      } else if (event === 'SIGNED_OUT') {
        reset()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [user, setSessionData, setLoading, reset, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    reset()
  }

  const isAdmin = platformRoles.some((role) => role === 'platform_owner' || role === 'platform_admin')

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LandingHeader userEmail={user?.email ?? undefined} onLogout={handleLogout} isAdmin={isAdmin} />
      <main className="flex-1">
        <AppRoutes />
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Сделано в России! Честно!
      </footer>
    </div>
  )
}

export default App
