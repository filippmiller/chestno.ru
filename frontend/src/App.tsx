import { useLocation } from 'react-router-dom'

import { AppRoutes } from '@/routes'
import { Navbar } from '@/components/ui/navbar'
import { useUserStore } from '@/store/userStore'
import { getSupabaseClient } from '@/lib/supabaseClient'

function App() {
  const { user, reset, platformRoles } = useUserStore()
  const supabase = getSupabaseClient()
  const location = useLocation()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    reset()
  }

  const isAdmin = platformRoles.some((role) => role === 'platform_owner' || role === 'platform_admin')

  const showChrome = !(location.pathname === '/' || location.pathname === '/orgs')

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {showChrome ? <Navbar userEmail={user?.email ?? undefined} onLogout={handleLogout} isAdmin={isAdmin} /> : null}
      <main className={`flex-1 ${showChrome ? 'bg-muted/10' : 'bg-background'}`}>
        <AppRoutes />
      </main>
      {showChrome ? (
        <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Работаем Честно!
        </footer>
      ) : null}
    </div>
  )
}

export default App
