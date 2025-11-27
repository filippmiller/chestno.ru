import {
  Baby,
  Cpu,
  Home,
  Palette,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react'

const categories = [
  {
    icon: UtensilsCrossed,
    title: 'Еда и фермерские продукты',
    description: 'Сыры, мёд, варенье, мясные изделия и натуральные продукты',
    count: 342,
  },
  {
    icon: Shirt,
    title: 'Одежда и текстиль',
    description: 'Льняная одежда, трикотаж, постельное бельё и аксессуары',
    count: 286,
  },
  {
    icon: Home,
    title: 'Дом и интерьер',
    description: 'Мебель, посуда, декор и товары для уюта',
    count: 198,
  },
  {
    icon: Baby,
    title: 'Детские товары',
    description: 'Игрушки, одежда для детей и развивающие материалы',
    count: 124,
  },
  {
    icon: Sparkles,
    title: 'Косметика и уход',
    description: 'Натуральная косметика, мыло и средства по уходу',
    count: 156,
  },
  {
    icon: Cpu,
    title: 'Техника и электроника',
    description: 'Приборы, комплектующие и электронные устройства',
    count: 78,
  },
  {
    icon: Wrench,
    title: 'Инструменты и оборудование',
    description: 'Ручной инструмент, станки и производственное оборудование',
    count: 64,
  },
  {
    icon: Palette,
    title: 'Искусство и сувениры',
    description: 'Народные промыслы, картины и авторские изделия',
    count: 112,
  },
]

export const LandingCategories = () => (
  <section id="catalog" className="border-t border-border bg-background py-16 lg:py-24">
    <div className="container">
      <div className="mb-12 text-center">
        <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
          Производители по категориям
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">Найдите российских производителей в нужной вам отрасли</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category, index) => (
          <a
            key={category.title}
            href="#"
            className="group rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-elegant"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <category.icon className="h-6 w-6" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">{category.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{category.description}</p>
            <div className="mt-4 text-sm font-medium text-primary">{category.count} производителей →</div>
          </a>
        ))}
      </div>
    </div>
  </section>
)

