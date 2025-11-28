import { ArrowRight, Clock, MapPin, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { RussianFlag } from '@/components/ui/RussianFlag'
import { MadeInRussiaStamp } from '@/components/ui/MadeInRussiaStamp'

const categories = [
  'Еда и фермерские продукты',
  'Одежда и текстиль',
  'Дом и интерьер',
  'Детские товары',
  'Косметика и уход',
  'Техника и электроника',
]

const stats = [
  { value: '1 284', label: 'Производителей в каталоге' },
  { value: '73', label: 'Города России' },
  { value: '9 540', label: 'Товаров с отметкой «Сделано здесь»' },
]

const recentProducers = [
  { name: 'Мастерская «Северный Фарфор»', city: 'Архангельск', category: 'Керамика' },
  { name: 'Сыроварня «Три коровы»', city: 'Тверь', category: 'Сыры' },
  { name: 'Ателье «Русский лён»', city: 'Кострома', category: 'Текстиль' },
  { name: 'Мастерская «Деревянная сказка»', city: 'Вологда', category: 'Мебель' },
]

export const LandingHero = () => (
  <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-cream">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />
    </div>

    <div className="container relative py-12 lg:py-20">
      <div className="grid gap-12 lg:grid-cols-5 lg:gap-16">
        <div className="space-y-8 lg:col-span-3">
          <div className="space-y-6 animate-slide-up">
            <h1 className="font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl flex items-center gap-3 relative">
              <RussianFlag className="w-10 h-7 sm:w-12 sm:h-8 lg:w-14 lg:h-10" />
              <span>Сделано в России! <span className="text-primary">Честно!</span></span>
              {/* Made in Russia stamp - почтовая марка */}
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 lg:-top-8 lg:-right-8">
                <MadeInRussiaStamp size="lg" />
              </div>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
              Мы собираем доверенный каталог российских производителей, которые делают товары в России, создают рабочие
              места и развивают свои города. Здесь вы найдёте тех, кем действительно можно гордиться — от семейных
              мастерских до крупных фабрик.
            </p>
          </div>

          <div className="flex flex-col gap-6 sm:flex-row animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex flex-col gap-2">
              <Button variant="hero" size="xl" className="group">
                Я производитель
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <span className="text-xs text-muted-foreground max-w-[280px]">
                Добавьте своё производство в каталог и расскажите о себе всей стране.
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="hero-secondary" size="xl">
                Я покупатель / партнёр
              </Button>
              <span className="text-xs text-muted-foreground max-w-[280px]">
                Ищите надёжных российских производителей и их товары.
              </span>
            </div>
          </div>

          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Найти производителя или товар…"
                  className="h-14 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-foreground shadow-sm transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <Button variant="default" size="xl">
                Найти
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 lg:gap-3">
              {categories.map((category) => (
                <button
                  key={category}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 lg:gap-8 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-card p-4 text-center shadow-sm lg:p-6"
              >
                <div className="font-display text-2xl font-bold text-primary lg:text-3xl">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground lg:text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl border border-border bg-card/50 p-6 animate-slide-up"
            style={{ animationDelay: '0.4s' }}
          >
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Вы производитель?</span> Заполните заявку — мы проверим
              данные и добавим вас в каталог как героя российского производства.
            </p>
            <Button variant="outline" size="sm" className="mt-4">
              Заполнить заявку производителя
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-6 animate-slide-in-right lg:col-span-2" style={{ animationDelay: '0.2s' }}>
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-elegant">
            <div className="relative aspect-video bg-gradient-to-br from-cream to-secondary">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-3xl">🏭</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Фото мастера</span>
                </div>
              </div>
              <div className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Герой недели
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-display text-lg font-semibold text-foreground">Мастерская «Северный Фарфор»</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Семейная мастерская из Архангельска, возрождающая традиции северной керамики с 2015 года.
              </p>
              <Button variant="outline" size="sm" className="mt-4 w-full">
                Смотреть профиль
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-foreground">Последние добавленные</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                24 часа
              </div>
            </div>

            <div className="space-y-3">
              {recentProducers.map((producer, index) => (
                <div
                  key={producer.name}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-background p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-secondary text-xl">
                    {['🏺', '🧀', '🧵', '🪑'][index]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{producer.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {producer.city}
                    </div>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                    {producer.category}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <a href="#catalog" className="text-sm font-medium text-primary hover:underline">
                Смотреть всех →
              </a>
              <span className="text-xs text-muted-foreground">Добавлены за последние 24 часа</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
)


