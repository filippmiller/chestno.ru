import { Link, NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'

type NavbarProps = {
  userEmail?: string
  onLogout?: () => void
  isAdmin?: boolean
}

export const Navbar = ({ userEmail, onLogout, isAdmin = false }: NavbarProps) => {
  return (
    <header className="w-full border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-lg font-semibold">
          Работаем Честно!
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <NavLink to="/orgs" className={({ isActive }) => (isActive ? 'text-primary' : '')}>
            Производители
          </NavLink>
          <NavLink to="/register" className={({ isActive }) => (isActive ? 'text-primary' : '')}>
            Регистрация
          </NavLink>
          <NavLink to="/login" className={({ isActive }) => (isActive ? 'text-primary' : '')}>
            Вход
          </NavLink>
          {userEmail && (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'text-primary' : '')}>
                Кабинет
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className={({ isActive }) => (isActive ? 'text-primary' : '')}>
                  Admin
                </NavLink>
              )}
              <NavLink
                to="/dashboard/organization/profile"
                className={({ isActive }) => (isActive ? 'text-primary' : '')}
              >
                Профиль производства
              </NavLink>
              <span className="hidden text-xs text-muted-foreground sm:inline">{userEmail}</span>
              <Button variant="ghost" size="sm" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Выйти
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

