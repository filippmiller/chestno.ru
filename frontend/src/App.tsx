import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/AuthProvider'
import { AppRoutes } from '@/routes'
import { LandingHeader } from '@/components/landing/LandingHeader'

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

function AppContent() {
  const { user, platformRoles, logout } = useAuth()
  const isAdmin = platformRoles.some((role) => role === 'platform_owner' || role === 'platform_admin')

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LandingHeader userEmail={user?.email ?? undefined} onLogout={logout} isAdmin={isAdmin} />
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
