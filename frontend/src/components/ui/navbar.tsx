import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'

import { listNotifications, getUnreadNotificationsCount } from '@/api/authService'
import { Button } from '@/components/ui/button'
import type { NotificationDelivery } from '@/types/auth'

type NavbarProps = {
  userEmail?: string
  onLogout?: () => void
  isAdmin?: boolean
}

export const Navbar = ({ userEmail, onLogout, isAdmin = false }: NavbarProps) => {
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<NotificationDelivery[]>([])

  useEffect(() => {
    if (!userEmail) return
    const load = async () => {
      try {
        const [count, feed] = await Promise.all([getUnreadNotificationsCount(), listNotifications({ limit: 5 })])
        setUnreadCount(count)
        setRecent(feed.items)
      } catch (err) {
        console.error(err)
      }
    }
    void load()
  }, [userEmail])

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
          <NavLink to="/levels" className={({ isActive }) => (isActive ? 'text-primary' : '')}>
            Уровни доверия
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
              <NavLink to="/notifications" className={({ isActive }) => (isActive ? 'text-primary' : '')}>
                Уведомления
              </NavLink>
              <NavLink to="/settings/notifications" className={({ isActive }) => (isActive ? 'text-primary' : '')}>
                Настройки
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className={({ isActive }) => (isActive ? 'text-primary' : '')}>
                  Admin
                </NavLink>
              )}
              <div className="relative">
                <button
                  type="button"
                  className="relative rounded-full p-2 transition hover:bg-muted"
                  onClick={() => setOpen((prev) => !prev)}
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-[1rem] rounded-full bg-red-500 px-1 text-xs text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {open && (
                  <div className="absolute right-0 z-50 mt-2 w-72 rounded-md border border-border bg-background p-3 shadow-lg">
                    <p className="mb-2 text-sm font-medium">Недавние уведомления</p>
                    <div className="space-y-2 text-sm">
                      {recent.length === 0 && <p className="text-muted-foreground">Нет новых уведомлений</p>}
                      {recent.map((item) => (
                        <div key={item.id} className="rounded-md bg-muted/40 p-2">
                          <p className="font-medium">{item.notification.title}</p>
                          <p className="text-xs text-muted-foreground">{item.notification.body}</p>
                        </div>
                      ))}
                    </div>
                    <Link to="/notifications" className="mt-3 block text-center text-sm text-primary underline">
                      Все уведомления
                    </Link>
                  </div>
                )}
              </div>
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

