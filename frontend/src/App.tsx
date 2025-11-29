import { AuthProviderV2 } from '@/auth/AuthProviderV2'
import { useAuthV2 } from '@/auth/AuthProviderV2'
import { AppRoutes } from '@/routes'
import { LandingHeader } from '@/components/landing/LandingHeader'

function App() {
  return (
    <AuthProviderV2>
      <AppContent />
    </AuthProviderV2>
  )
}

function AppContent() {
  const { user, role, status, logout } = useAuthV2()
  const isAdmin = role === 'admin'
  const isAuthenticated = status === 'authenticated'

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LandingHeader 
        userEmail={isAuthenticated ? user?.email ?? undefined : undefined} 
        onLogout={logout} 
        isAdmin={isAdmin}
        isAuthenticated={isAuthenticated}
      />
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
