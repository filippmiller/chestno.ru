import { AppRoutes } from '@/routes'
import { Navbar } from '@/components/ui/navbar'
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
      <Navbar userEmail={user?.email ?? undefined} onLogout={handleLogout} isAdmin={isAdmin} />
      <main className="flex-1 bg-muted/10">
        <AppRoutes />
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Работаем Честно!
      </footer>
    </div>
  )
}

export default App
