import { useEffect, useState } from 'react'
import { Factory, Menu, X, Bell, LogOut } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { listNotifications, getUnreadNotificationsCount } from '@/api/authService'
import type { NotificationDelivery } from '@/types/auth'

const navLinks = [
  { label: 'Каталог производителей', href: '/orgs' },
  { label: 'Каталог товаров', href: '/products' },
  { label: 'Истории производств', href: '/stories' },
  { label: 'О проекте', href: '/about' },
  { label: 'Тарифы для производителей', href: '/pricing' },
]

type LandingHeaderProps = {
  userEmail?: string
  onLogout?: () => void
  isAdmin?: boolean
}

export const LandingHeader = ({ userEmail, onLogout, isAdmin = false }: LandingHeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
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
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between lg:h-20">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary transition-transform group-hover:scale-105">
            <Factory className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold text-foreground lg:text-xl flex items-center gap-2 relative">
            <span className="text-2xl">🇷🇺</span>
            <span>Сделано в России! Честно!</span>
            {/* Made in Russia stamp - почтовая марка */}
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-14 h-14 bg-white shadow-lg rotate-12 hover:rotate-6 transition-transform rounded-full border-2 border-dashed border-primary">
              <span className="text-[7px] font-extrabold text-primary leading-tight text-center px-0.5">
                MADE<br />IN<br />RUSSIA
              </span>
            </span>
          </span>
        </Link>

        <nav className="hidden lg:flex lg:items-center lg:gap-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex lg:items-center lg:gap-3">
          {userEmail ? (
            <>
              <NavLink to="/dashboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Кабинет
              </NavLink>
              <NavLink to="/notifications" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Уведомления
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
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
          ) : (
            <>
              <a
                href="/login"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Войти
              </a>
              <a href="/register">
                <Button variant="outline" size="sm">
                  Регистрация
                </Button>
              </a>
              <Button variant="producer" size="sm">
                Я производитель
              </Button>
            </>
          )}
        </div>

        <button
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary lg:hidden"
          aria-label="Меню"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMobileMenuOpen ? (
        <div className="border-t border-border bg-background lg:hidden animate-fade-in">
          <nav className="container flex flex-col gap-1 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
              {userEmail ? (
                <>
                  <Link to="/dashboard" className="px-4 py-2 text-sm font-medium text-foreground">
                    Кабинет
                  </Link>
                  <Link to="/notifications" className="px-4 py-2 text-sm font-medium text-foreground">
                    Уведомления
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="px-4 py-2 text-sm font-medium text-foreground">
                      Admin
                    </Link>
                  )}
                  <span className="px-4 py-2 text-sm text-muted-foreground">{userEmail}</span>
                  <Button variant="ghost" className="w-full justify-start" onClick={onLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Выйти
                  </Button>
                </>
              ) : (
                <>
                  <a href="/login" className="px-4 py-2 text-sm font-medium text-muted-foreground">
                    Войти
                  </a>
                  <a href="/register" className="w-full">
                    <Button variant="outline" className="w-full">
                      Регистрация
                    </Button>
                  </a>
                  <Button variant="producer" className="w-full">
                    Я производитель
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}


