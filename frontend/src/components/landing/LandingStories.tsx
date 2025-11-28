import { MapPin, Quote } from 'lucide-react'

import { Button } from '@/components/ui/button'

const stories = [
  {
    name: 'Мастерская «Тульский самовар»',
    city: 'Тула',
    quote: 'Мы начинали с гаража в Туле, а сегодня наши изделия есть в домах по всей стране.',
    category: 'Посуда и утварь',
    emoji: '☕',
  },
  {
    name: 'Сыроварня «Три коровы»',
    city: 'Тверь',
    quote: 'Каждый сыр мы делаем вручную по рецептам, которым нас научила бабушка из Швейцарии.',
    category: 'Фермерские продукты',
    emoji: '🧀',
  },
  {
    name: 'Ателье «Русский лён»',
    city: 'Кострома',
    quote: 'Лён — это не просто ткань. Это часть русской культуры, которую мы хотим сохранить.',
    category: 'Текстиль',
    emoji: '🧵',
  },
]

export const LandingStories = () => (
  <section id="stories" className="border-t border-border bg-cream py-16 lg:py-24">
    <div className="container">
      <div className="mb-12 text-center">
        <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
          Истории производств
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Реальные истории людей, которые создают качественные товары в России
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {stories.map((story) => (
          <div
            key={story.name}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant"
          >
            <div className="relative aspect-[4/3] bg-gradient-to-br from-secondary to-cream">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl">{story.emoji}</span>
              </div>
              <div className="absolute right-4 top-4 rounded-full bg-card/90 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                {story.category}
              </div>
            </div>

            <div className="p-6">
              <h3 className="font-display text-xl font-semibold text-foreground">{story.name}</h3>
              <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {story.city}
              </div>

              <div className="relative mt-4">
                <Quote className="absolute -left-1 -top-1 h-6 w-6 text-primary/20" />
                <p className="pl-5 text-sm italic leading-relaxed text-muted-foreground">{story.quote}</p>
              </div>

              <Button variant="ghost" className="mt-4 w-full justify-start px-0 text-primary hover:text-primary">
                Читать историю →
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Button variant="outline" size="lg">
          Все истории производств
        </Button>
      </div>
    </div>
  </section>
)


