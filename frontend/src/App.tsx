import { AppRoutes } from '@/routes'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { useUserStore } from '@/store/userStore'
import { getSupabaseClient } from '@/lib/supabaseClient'

function App() {
  const { user, reset, platformRoles } = useUserStore()
  const supabase = getSupabaseClient()

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
