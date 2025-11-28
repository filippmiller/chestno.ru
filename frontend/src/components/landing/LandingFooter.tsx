import { Factory, Mail, MapPin, Phone } from 'lucide-react'

const footerLinks = {
  platform: [
    { label: 'Каталог производителей', href: '#catalog' },
    { label: 'Каталог товаров', href: '#products' },
    { label: 'Истории героев', href: '#stories' },
    { label: 'О проекте', href: '#about' },
  ],
  producers: [
    { label: 'Тарифы', href: '#pricing' },
    { label: 'Заявка на добавление', href: '#apply' },
    { label: 'Личный кабинет', href: '#dashboard' },
    { label: 'QR-коды для товаров', href: '#qr' },
  ],
  support: [
    { label: 'Помощь', href: '#help' },
    { label: 'Контакты', href: '#contacts' },
    { label: 'Политика конфиденциальности', href: '#privacy' },
    { label: 'Условия использования', href: '#terms' },
  ],
}

export const LandingFooter = () => (
  <footer className="border-t border-border bg-graphite text-primary-foreground">
    <div className="container py-12 lg:py-16">
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Factory className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold flex items-center gap-2">
              <span className="text-2xl">🇷🇺</span>
              Сделано в России! Честно!
            </span>
          </a>
          <p className="mt-4 max-w-sm text-sm text-primary-foreground/70">
            Доверенный каталог российских производителей. Знайте своих героев и поддерживайте тех, кто создаёт
            качественные товары в России.
          </p>
          <div className="mt-6 space-y-2 text-sm text-primary-foreground/70">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              info@heroes-production.ru
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              8 (800) 123-45-67
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Москва, Россия
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-4 font-semibold">Платформа</h4>
          <ul className="space-y-2">
            {footerLinks.platform.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-semibold">Производителям</h4>
          <ul className="space-y-2">
            {footerLinks.producers.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-semibold">Поддержка</h4>
          <ul className="space-y-2">
            {footerLinks.support.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/10 pt-8 sm:flex-row">
        <p className="text-sm text-primary-foreground/60">© 2024 Сделано в России! Честно! Все права защищены.</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-primary-foreground/60">Сделано с</span>
          <span className="text-primary">❤️</span>
          <span className="text-sm text-primary-foreground/60">в России</span>
        </div>
      </div>
    </div>
  </footer>
)

