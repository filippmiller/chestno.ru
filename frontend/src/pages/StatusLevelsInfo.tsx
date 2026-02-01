import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown, TrendingUp, Users, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// Status Level Badge Component
const StatusBadge = ({ level, className = '' }: { level: 'A' | 'B' | 'C'; className?: string }) => {
  const variants = {
    A: { color: 'bg-green-500', text: 'Уровень A', glow: 'shadow-green-500/50' },
    B: { color: 'bg-blue-500', text: 'Уровень B', glow: 'shadow-blue-500/50' },
    C: { color: 'bg-purple-500', text: 'Уровень C', glow: 'shadow-purple-500/50' },
  }

  const variant = variants[level]

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <div className={`${variant.color} ${variant.glow} rounded-full px-6 py-3 text-white font-bold text-2xl shadow-lg`}>
        {level}
      </div>
    </div>
  )
}

// Comparison Table Data
const levelData = {
  A: {
    name: 'Самодекларация',
    description: 'Заявляю о честности',
    price: '2 000 ₽/мес',
    priceAnnual: '20 000 ₽/год (скидка 2 месяца)',
    badge: 'A',
    badgeColor: 'green',
    features: [
      'QR-коды (неограниченно)',
      'Загрузка видео-контента',
      'Зелёный бейдж на профиле',
      'Подписка на отзывы',
      'Ответы на отзывы',
      '14 дней бесплатный trial',
    ],
    howToGet: [
      'Оплатить подписку',
      'Верифицировать email',
      'Загрузить видео о бизнесе (опционально)',
    ],
  },
  B: {
    name: 'Проверено платформой',
    description: 'Профессиональный контент',
    price: '5 000 ₽/мес',
    priceAnnual: '50 000 ₽/год (скидка 2 месяца)',
    badge: 'B',
    badgeColor: 'blue',
    features: [
      'Всё из уровня A',
      'Синий бейдж "Проверено"',
      'Профессиональное видео',
      'Приоритет в поиске',
      'Упоминание в маркетинге',
      'Видеопродакшн: 6 500 ₽',
    ],
    howToGet: [
      'Активный уровень A',
      'Заказать видеопродакшн (6 500 ₽)',
      'Пройти модерацию контента',
      'Оплатить подписку уровня B',
    ],
  },
  C: {
    name: 'Высшая репутация',
    description: 'Заработанный статус',
    price: 'БЕСПЛАТНО',
    priceAnnual: 'Заслужен действиями',
    badge: 'C',
    badgeColor: 'purple',
    features: [
      'Всё из уровня B',
      'Фиолетовый бейдж "Trust Leader"',
      'Публичное признание',
      'Эксклюзивные кейсы в блоге',
      'Статус доверенного партнёра',
      'Нельзя купить - только заработать',
    ],
    howToGet: [
      'Активный уровень B',
      '15+ опубликованных отзывов',
      '85%+ response rate (90 дней)',
      'Средний ответ < 48 часов',
      'Хотя бы 1 публичный кейс',
    ],
  },
}

export const StatusLevelsInfo = () => {
  // Set page title
  useEffect(() => {
    document.title = 'Система уровней доверия | Честно.ру - Прозрачная репутация для честного бизнеса'
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="container relative py-16 lg:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4 animate-slide-up">
              <h1 className="font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
                Система уровней <span className="text-primary">доверия</span>
              </h1>
              <p className="text-xl text-muted-foreground lg:text-2xl">
                Прозрачная репутация для честного бизнеса
              </p>
            </div>

            <p className="max-w-2xl mx-auto text-lg leading-relaxed text-muted-foreground">
              Покажите свою честность через действия, а не слова. Три уровня доверия помогут вашему бизнесу выделиться
              среди конкурентов и завоевать доверие покупателей.
            </p>

            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth">
                  Получить статус <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/pricing">Узнать цены</Link>
              </Button>
            </div>

            {/* Badge Preview */}
            <div className="flex flex-wrap justify-center gap-8 pt-8">
              <div className="text-center space-y-2">
                <StatusBadge level="A" />
                <p className="text-sm text-muted-foreground">Самодекларация</p>
              </div>
              <div className="text-center space-y-2">
                <StatusBadge level="B" />
                <p className="text-sm text-muted-foreground">Проверено</p>
              </div>
              <div className="text-center space-y-2">
                <StatusBadge level="C" />
                <p className="text-sm text-muted-foreground">Высшая репутация</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container">
          <div className="max-w-7xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-bold lg:text-4xl">Выберите свой уровень</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Начните с уровня A и двигайтесь к вершине. Уровень C нельзя купить — только заработать действиями.
              </p>
            </div>

            {/* Desktop: 3 columns */}
            <div className="hidden lg:grid lg:grid-cols-3 gap-8">
              {Object.entries(levelData).map(([level, data]) => (
                <Card
                  key={level}
                  className={`relative ${level === 'C' ? 'border-primary shadow-lg scale-105' : ''}`}
                >
                  {level === 'C' && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary">Самый желанный</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center space-y-4 pb-8">
                    <StatusBadge level={level as 'A' | 'B' | 'C'} />
                    <div>
                      <CardTitle className="text-2xl">{data.name}</CardTitle>
                      <CardDescription className="text-base mt-2">{data.description}</CardDescription>
                    </div>
                    <div className="pt-4">
                      <div className="text-3xl font-bold">{data.price}</div>
                      <div className="text-sm text-muted-foreground mt-1">{data.priceAnnual}</div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Возможности
                      </h4>
                      <ul className="space-y-2">
                        {data.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">Как получить</h4>
                      <ol className="space-y-2 list-decimal list-inside text-sm text-muted-foreground">
                        {data.howToGet.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    <Button asChild className="w-full" variant={level === 'C' ? 'default' : 'outline'}>
                      <Link to={level === 'C' ? '#criteria' : '/auth'}>
                        {level === 'C' ? 'Узнать критерии' : 'Получить уровень'}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Mobile: Stacked cards */}
            <div className="lg:hidden space-y-6">
              {Object.entries(levelData).map(([level, data]) => (
                <Card key={level} className={`${level === 'C' ? 'border-primary' : ''}`}>
                  <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between">
                      <StatusBadge level={level as 'A' | 'B' | 'C'} className="scale-75" />
                      {level === 'C' && <Badge className="bg-primary">Самый желанный</Badge>}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{data.name}</CardTitle>
                      <CardDescription className="mt-1">{data.description}</CardDescription>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{data.price}</div>
                      <div className="text-xs text-muted-foreground">{data.priceAnnual}</div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Возможности
                      </h4>
                      <ul className="space-y-1.5">
                        {data.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                            <span className="text-xs">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 text-sm">Как получить</h4>
                      <ol className="space-y-1 list-decimal list-inside text-xs text-muted-foreground">
                        {data.howToGet.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    <Button asChild className="w-full" size="sm" variant={level === 'C' ? 'default' : 'outline'}>
                      <Link to={level === 'C' ? '#criteria' : '/auth'}>
                        {level === 'C' ? 'Узнать критерии' : 'Получить'}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-16 lg:py-24">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-bold lg:text-4xl">Результаты говорят сами</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Организации с уровнем доверия растут быстрее и зарабатывают больше
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <Card className="text-center">
                <CardHeader>
                  <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-green-600" />
                  </div>
                  <CardTitle className="text-4xl font-bold">500+</CardTitle>
                  <CardDescription>организаций получили статус</CardDescription>
                </CardHeader>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardTitle className="text-4xl font-bold">+40%</CardTitle>
                  <CardDescription>рост конверсии для уровня B</CardDescription>
                </CardHeader>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <div className="mx-auto w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                    <Zap className="h-8 w-8 text-purple-600" />
                  </div>
                  <CardTitle className="text-4xl font-bold">14 дней</CardTitle>
                  <CardDescription>средний срок получения статуса C</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-bold lg:text-4xl">Истории успеха</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Узнайте, как статусы помогли другим бизнесам расти
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {/* Story 1 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
                      МК
                    </div>
                    <div>
                      <StatusBadge level="B" className="scale-50" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">Мастерская «Керамика»</CardTitle>
                  <CardDescription>Москва, керамика ручной работы</CardDescription>
                </CardHeader>
                <CardContent>
                  <blockquote className="text-sm text-muted-foreground italic border-l-4 border-primary pl-4">
                    "После получения уровня B наши продажи выросли на 40%. Покупатели доверяют проверенному статусу!"
                  </blockquote>
                  <p className="text-xs text-muted-foreground mt-4">— Анна Смирнова, владелец</p>
                </CardContent>
              </Card>

              {/* Story 2 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                      ЭМ
                    </div>
                    <div>
                      <StatusBadge level="C" className="scale-50" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">ЭкоМёд</CardTitle>
                  <CardDescription>Алтай, органический мёд</CardDescription>
                </CardHeader>
                <CardContent>
                  <blockquote className="text-sm text-muted-foreground italic border-l-4 border-primary pl-4">
                    "Уровень C — это гордость! Мы отвечаем на каждый отзыв и делимся опытом. Клиенты ценят это."
                  </blockquote>
                  <p className="text-xs text-muted-foreground mt-4">— Михаил Петров, основатель</p>
                </CardContent>
              </Card>

              {/* Story 3 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-xl">
                      ТЛ
                    </div>
                    <div>
                      <StatusBadge level="A" className="scale-50" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">Текстиль Льна</CardTitle>
                  <CardDescription>Иваново, натуральные ткани</CardDescription>
                </CardHeader>
                <CardContent>
                  <blockquote className="text-sm text-muted-foreground italic border-l-4 border-primary pl-4">
                    "Начали с уровня A и сразу получили первые заказы. QR-коды на ярмарке сработали отлично!"
                  </blockquote>
                  <p className="text-xs text-muted-foreground mt-4">— Елена Кузнецова, директор</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="criteria" className="py-16 lg:py-24">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-bold lg:text-4xl">Часто задаваемые вопросы</h2>
              <p className="text-lg text-muted-foreground">Всё, что нужно знать о системе уровней</p>
            </div>

            <div className="space-y-4">
              {/* FAQ Items */}
              {[
                {
                  question: 'Как получить уровень A?',
                  answer:
                    'Для получения уровня A нужно: 1) Зарегистрироваться на платформе, 2) Верифицировать email, 3) Оплатить подписку (2 000 ₽/мес или воспользоваться бесплатным trial на 14 дней). После оплаты уровень активируется автоматически, и вы получите доступ ко всем возможностям.',
                },
                {
                  question: 'Сколько стоит уровень B?',
                  answer:
                    'Уровень B стоит 5 000 ₽/мес (или 50 000 ₽/год со скидкой в 2 месяца). Дополнительно требуется разовая оплата видеопродакшна — 6 500 ₽. Платформа создаст профессиональное видео о вашем бизнесе за 3-5 рабочих дней. Можно загрузить своё видео и пройти модерацию.',
                },
                {
                  question: 'Можно ли купить уровень C?',
                  answer:
                    'Нет, уровень C нельзя купить — его можно только заработать действиями. Критерии: активный уровень B, 15+ отзывов, 85%+ response rate, средний ответ < 48 часов, хотя бы 1 публичный кейс. Система проверяет критерии автоматически каждые 24 часа.',
                },
                {
                  question: 'Что будет, если не продлить подписку?',
                  answer:
                    'Предоставляется grace period (14 дней), в течение которого вы можете возобновить подписку без потери статуса. Вы получите уведомления на день 7, 3 и 1. Если подписка не продлена — статус деактивируется, QR-коды перестанут работать. При восстановлении подписки статус возвращается.',
                },
                {
                  question: 'Как работает grace period?',
                  answer:
                    'Grace period — это период "милости" после истечения подписки. Для уровня A — 14 дней, для уровня B — 30 дней. В это время статус остаётся активным, но вы получаете напоминания об оплате. Это защита от случайных просрочек и технических сбоев.',
                },
                {
                  question: 'Можно ли иметь несколько уровней одновременно?',
                  answer:
                    'Да, можно иметь несколько активных уровней. Например, активные уровни A и B одновременно. На профиле будет показываться максимальный уровень (приоритет: C > B > A). Это позволяет плавно переходить между уровнями без потери доступа.',
                },
                {
                  question: 'Что такое деградация статуса?',
                  answer:
                    'Деградация — это автоматическое понижение уровня при невыполнении критериев. Уровень B деградирует до A через 18 месяцев без обновления контента. Уровень C деградирует до B, если критерии не выполняются (например, response rate упал ниже 80%). Предупреждения приходят заранее.',
                },
                {
                  question: 'Сколько времени занимает получение уровня C?',
                  answer:
                    'В среднем — 14 дней при активной работе с отзывами. Критерии: 15+ отзывов, 85%+ response rate, средний ответ < 48 часов. Если отвечать быстро и качественно, уровень C может быть получен уже через 2 недели активности. Система проверяет критерии ежедневно.',
                },
                {
                  question: 'Есть ли региональные цены?',
                  answer:
                    'Да, действуют региональные коэффициенты. Москва и Санкт-Петербург — полная цена. Города-миллионники — скидка 10%. Регионы — скидка 20%. Регион определяется по основной локации организации при регистрации. Можно изменить 1 раз в год.',
                },
                {
                  question: 'Что такое видеопродакшн?',
                  answer:
                    'Видеопродакшн — это услуга профессиональной съёмки видео о вашем бизнесе нашей командой. Стоимость: 6 500 ₽ (разово). Срок: 3-5 рабочих дней. В цену включён 1 бесплатный reshoot (пересъёмка), если первая версия не понравится. Также можно загрузить своё видео.',
                },
              ].map((faq, idx) => (
                <Collapsible key={idx}>
                  <Card>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardTitle className="text-left text-base lg:text-lg">{faq.question}</CardTitle>
                        <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="text-sm text-muted-foreground pt-0">{faq.answer}</CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold lg:text-5xl">Готовы стать частью честного бизнеса?</h2>
              <p className="text-lg text-muted-foreground lg:text-xl max-w-2xl mx-auto">
                Начните с бесплатного trial на 14 дней. Карта не требуется. Полный доступ ко всем возможностям уровня A.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="gap-2 text-lg px-8">
                <Link to="/auth">
                  Начать бесплатный trial <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8">
                <Link to="/pricing">Посмотреть все тарифы</Link>
              </Button>
            </div>

            <div className="pt-8 text-sm text-muted-foreground space-y-2">
              <p>Уже есть аккаунт? <Link to="/auth" className="text-primary underline">Войти в кабинет</Link></p>
              <p>Хотите узнать подробнее о нашей системе оценки? <Link to="/methodology" className="text-primary underline">Открытая методология</Link></p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
