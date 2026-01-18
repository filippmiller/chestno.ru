import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileUp,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  Users,
  Zap,
  ClipboardList,
  CreditCard,
  QrCode,
  X,
} from 'lucide-react'

import { useAuthV2 } from '@/auth/AuthProviderV2'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type AdminNavItem = {
  label: string
  href: string
  icon: React.ElementType
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Organizations', href: '/admin?tab=businesses', icon: Building2 },
  { label: 'Users', href: '/admin?tab=users', icon: Users },
  { label: 'Reviews', href: '/admin?tab=reviews', icon: MessageSquare },
  { label: 'Registrations', href: '/admin?tab=pending', icon: Shield },
  { label: 'Imports Catalog', href: '/admin/imports', icon: FileUp },
  { label: 'Database Explorer', href: '/admin/db', icon: Database },
  { label: 'Subscriptions', href: '/admin?tab=subscriptions', icon: CreditCard },
  { label: 'QR Codes', href: '/admin?tab=qr', icon: QrCode },
  { label: 'AI Integrations', href: '/admin?tab=ai', icon: Zap },
  { label: 'Dev Tasks', href: '/admin?tab=dev', icon: ClipboardList },
]

const QUICK_LINKS = [
  { label: 'Dashboard (User)', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Settings', href: '/dashboard/settings/notifications', icon: Settings },
]

type AdminLayoutProps = {
  children: React.ReactNode
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, logout } = useAuthV2()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (href: string) => {
    if (href.includes('?tab=')) {
      const tab = new URLSearchParams(href.split('?')[1]).get('tab')
      const currentTab = new URLSearchParams(location.search).get('tab')
      return location.pathname === '/admin' && currentTab === tab
    }
    return location.pathname === href
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen border-r border-border bg-background transition-all duration-300 lg:block',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          {!sidebarCollapsed && (
            <Link to="/admin" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">Admin Panel</span>
            </Link>
          )}
          {sidebarCollapsed && (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
              <Shield className="h-4 w-4 text-white" />
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-2">
          {!sidebarCollapsed && (
            <span className="mb-1 px-3 text-xs font-medium uppercase text-muted-foreground">Admin Tools</span>
          )}
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                sidebarCollapsed && 'justify-center px-2'
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}

          {!sidebarCollapsed && (
            <>
              <div className="my-4 border-t border-border" />
              <span className="mb-1 px-3 text-xs font-medium uppercase text-muted-foreground">Quick Links</span>
            </>
          )}
          {sidebarCollapsed && <div className="my-4 border-t border-border" />}
          {QUICK_LINKS.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                sidebarCollapsed && 'justify-center px-2'
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-3">
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Platform Admin</p>
              </div>
              <Button variant="ghost" size="icon" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" onClick={logout} className="mx-auto flex">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/admin" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold">Admin</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-background p-4">
            <div className="mb-4 flex items-center justify-between">
              <Link to="/admin" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold">Admin Panel</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              <span className="mb-1 px-3 text-xs font-medium uppercase text-muted-foreground">Admin Tools</span>
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              <div className="my-4 border-t border-border" />
              <span className="mb-1 px-3 text-xs font-medium uppercase text-muted-foreground">Quick Links</span>
              {QUICK_LINKS.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="absolute bottom-4 left-4 right-4 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">Platform Admin</p>
                </div>
                <Button variant="ghost" size="icon" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 pt-14 transition-all duration-300 lg:pt-0',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        <div className="min-h-screen p-4 lg:p-6">{children}</div>
      </main>
    </div>
  )
}
