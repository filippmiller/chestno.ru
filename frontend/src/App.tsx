import { useLocation } from 'react-router-dom'

import { AuthProviderV2 } from '@/auth/AuthProviderV2'
import { useAuthV2 } from '@/auth/AuthProviderV2'
import { AppRoutes } from '@/routes'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'

function App() {
  return (
    <AuthProviderV2>
      <AppErrorBoundary>
        <AppContent />
      </AppErrorBoundary>
    </AuthProviderV2>
  )
}

function AppContent() {
  const { user, role, status, logout, platformRoles } = useAuthV2()
  const location = useLocation()
  const isAdmin = role === 'admin' || platformRoles.includes('platform_admin') || platformRoles.includes('platform_owner')
  const isAuthenticated = status === 'authenticated'

  // Check if current route is an admin route
  const isAdminRoute = location.pathname.startsWith('/admin')

  // If admin route and user is admin, use AdminLayout
  if (isAdminRoute && isAdmin && isAuthenticated) {
    return (
      <AdminLayout>
        <AppRoutes />
      </AdminLayout>
    )
  }

  // Default layout for all other routes
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
