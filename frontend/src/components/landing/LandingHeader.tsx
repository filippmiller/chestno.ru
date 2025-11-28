import { useState } from 'react'
import { Factory, Menu, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

const navLinks = [
  { label: 'Каталог производителей', href: '/orgs' },
  { label: 'Каталог товаров', href: '/products' },
  { label: 'Истории производств', href: '/stories' },
  { label: 'О проекте', href: '/about' },
  { label: 'Тарифы для производителей', href: '/pricing' },
]

export const LandingHeader = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between lg:h-20">
        <a href="/" className="flex items-center gap-2 group">
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
        </a>

        <nav className="hidden lg:flex lg:items-center lg:gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex lg:items-center lg:gap-3">
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
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
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
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}


