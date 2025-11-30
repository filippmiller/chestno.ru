import { BarChart3, FileText, Heart, MessageSquare, Search, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'

const producerSteps = [
  {
    icon: FileText,
    step: '1',
    title: 'Оставьте заявку',
    description: 'Заполните форму с информацией о вашем производстве',
  },
  {
    icon: ShieldCheck,
    step: '2',
    title: 'Пройдите модерацию',
    description: 'Мы проверим данные и свяжемся с вами',
  },
  {
    icon: BarChart3,
    step: '3',
    title: 'Получите карточку',
    description: 'Карточка производителя с аналитикой и QR-кодами',
  },
]

const buyerSteps = [
  {
    icon: Search,
    step: '1',
    title: 'Ищите производителей',
    description: 'Фильтруйте по категориям, регионам и товарам',
  },
  {
    icon: Heart,
    step: '2',
    title: 'Сохраняйте избранное',
    description: 'Создавайте коллекции любимых производителей',
  },
  {
    icon: MessageSquare,
    step: '3',
    title: 'Связывайтесь напрямую',
    description: 'Переходите на сайт или сканируйте QR с товара',
  },
]

export const LandingHowItWorks = () => (
  <section id="about" className="border-t border-border bg-background py-16 lg:py-24">
    <div className="container">
      <div className="mb-12 text-center">
        <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">Как это работает</h2>
        <p className="mt-4 text-lg text-muted-foreground">Простые шаги для производителей и покупателей</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <span className="text-sm font-semibold text-primary">Для производителей</span>
          </div>

          <div className="space-y-6">
            {producerSteps.map((step) => (
              <div key={step.title} className="flex gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-display text-lg font-bold">
                  {step.step}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">{step.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Button variant="default" className="mt-8 w-full">
            Стать героем производства
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2">
            <span className="text-sm font-semibold text-accent">Для покупателей и партнёров</span>
          </div>

          <div className="space-y-6">
            {buyerSteps.map((step) => (
              <div key={step.title} className="flex gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground font-display text-lg font-bold">
                  {step.step}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">{step.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" className="mt-8 w-full">
            Найти производителей
          </Button>
        </div>
      </div>
    </div>
  </section>
)



