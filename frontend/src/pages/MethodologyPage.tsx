import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  Eye,
  EyeOff,
  FileCheck,
  HelpCircle,
  Layers,
  Lightbulb,
  MessageSquare,
  Scale,
  Search,
  Shield,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// ============================================================
// STATUS BADGE COMPONENT
// ============================================================
const StatusBadge = ({ level, size = 'md' }: { level: 'A' | 'B' | 'C'; size?: 'sm' | 'md' | 'lg' }) => {
  const variants = {
    A: { color: 'bg-green-500', glow: 'shadow-green-500/50' },
    B: { color: 'bg-blue-500', glow: 'shadow-blue-500/50' },
    C: { color: 'bg-purple-500', glow: 'shadow-purple-500/50' },
  }
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl',
  }
  const variant = variants[level]
  return (
    <div
      className={`${variant.color} ${variant.glow} ${sizes[size]} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}
    >
      {level}
    </div>
  )
}

// ============================================================
// CRITERIA DATA
// ============================================================
const levelCriteria = {
  A: {
    name: 'Самодекларация',
    tagline: 'Заявляю о честности',
    color: 'green',
    requirements: [
      { label: 'Регистрация на платформе', description: 'Создание аккаунта организации' },
      { label: 'Верификация email', description: 'Подтверждение электронной почты' },
      { label: 'Оплата подписки', description: '2 000 руб/мес или бесплатный trial 14 дней' },
      { label: 'Базовое заполнение профиля', description: 'Название, контакты, описание деятельности' },
    ],
    whatWeCheck: [
      'Корректность email адреса',
      'Статус оплаты подписки',
      'Заполненность обязательных полей профиля',
    ],
    whatWeDoNotCheck: [
      'Достоверность информации о компании',
      'Реальность производства',
      'Качество продукции',
      'Отзывы клиентов',
    ],
  },
  B: {
    name: 'Проверено платформой',
    tagline: 'Профессиональный контент',
    color: 'blue',
    requirements: [
      { label: 'Активный уровень A', description: 'Действующая подписка уровня A' },
      { label: 'Профессиональное видео', description: 'Видеопродакшн от платформы (6 500 руб) или свое видео' },
      { label: 'Модерация контента', description: 'Проверка видеоматериалов нашей командой' },
      { label: 'Подписка уровня B', description: '5 000 руб/мес' },
    ],
    whatWeCheck: [
      'Наличие активного уровня A',
      'Качество и достоверность видеоконтента',
      'Соответствие видео заявленной деятельности',
      'Отсутствие манипуляций и монтажных искажений',
    ],
    whatWeDoNotCheck: [
      'Финансовую отчетность компании',
      'Юридическую чистоту бизнеса',
      'Сертификаты и лицензии (если не заявлены)',
      'Историю взаимоотношений с клиентами',
    ],
  },
  C: {
    name: 'Высшая репутация',
    tagline: 'Заработанный статус',
    color: 'purple',
    requirements: [
      { label: 'Активный уровень B', description: 'Действующая подписка и статус уровня B' },
      { label: '15+ отзывов', description: 'Опубликованные отзывы за последние 12 месяцев' },
      { label: '85%+ response rate', description: 'Процент ответов на отзывы за 90 дней' },
      { label: 'Средний ответ < 48 часов', description: 'Скорость реакции на отзывы' },
      { label: '1+ публичный кейс', description: 'Опубликованная история решения проблемы' },
    ],
    whatWeCheck: [
      'Количество реальных отзывов',
      'Процент ответов организации на отзывы',
      'Среднее время ответа',
      'Наличие публичных кейсов решения конфликтов',
      'Активность уровня B',
    ],
    whatWeDoNotCheck: [
      'Субъективную оценку качества ответов',
      'Удовлетворенность клиентов результатами',
      'Содержание частных переписок',
      'Оффлайн-взаимодействия с клиентами',
    ],
  },
}

// ============================================================
// DATA SOURCES
// ============================================================
const dataSources = [
  {
    icon: Database,
    title: 'Внутренние данные платформы',
    description: 'Регистрации, подписки, активность, отзывы, ответы, публикации',
    reliability: 'Высокая',
    reliabilityColor: 'text-green-600',
  },
  {
    icon: Users,
    title: 'Отзывы пользователей',
    description: 'Публичные отзывы, оценки, комментарии посетителей',
    reliability: 'Средняя',
    reliabilityColor: 'text-yellow-600',
  },
  {
    icon: FileCheck,
    title: 'Модерация контента',
    description: 'Ручная проверка видео и материалов нашей командой',
    reliability: 'Высокая',
    reliabilityColor: 'text-green-600',
  },
  {
    icon: Clock,
    title: 'Метрики активности',
    description: 'Время ответа, частота публикаций, вовлеченность',
    reliability: 'Высокая',
    reliabilityColor: 'text-green-600',
  },
]

// ============================================================
// DATA GAPS (HONESTY SECTION)
// ============================================================
const dataGaps = [
  {
    icon: Scale,
    title: 'Юридическая проверка',
    description: 'Мы НЕ проверяем юридический статус компании, наличие судебных дел, задолженностей или нарушений законодательства.',
    whatToDo: 'Рекомендуем самостоятельно проверять контрагентов через ФНС и другие официальные источники.',
  },
  {
    icon: FileCheck,
    title: 'Сертификаты и лицензии',
    description: 'Мы НЕ запрашиваем и НЕ верифицируем сертификаты качества, лицензии или разрешения, если организация не предоставила их добровольно.',
    whatToDo: 'Если для вашей сферы важны сертификаты, запросите их напрямую у производителя.',
  },
  {
    icon: BarChart3,
    title: 'Финансовая стабильность',
    description: 'Мы НЕ анализируем финансовую отчетность, кредитную историю или платежеспособность организаций.',
    whatToDo: 'Для крупных сделок используйте профессиональные сервисы проверки контрагентов.',
  },
  {
    icon: MessageSquare,
    title: 'Полнота отзывов',
    description: 'Отзывы на платформе могут не отражать полную картину. Негативные отзывы могут быть удалены по запросу, а позитивные могут быть заказными.',
    whatToDo: 'Изучайте отзывы на нескольких площадках и обращайте внимание на детали.',
  },
  {
    icon: Eye,
    title: 'Оффлайн-реальность',
    description: 'Видео и фото могут показывать идеальную картину. Мы не можем гарантировать, что реальное производство соответствует показанному.',
    whatToDo: 'При возможности посетите производство лично или запросите дополнительные материалы.',
  },
]

// ============================================================
// IMPROVEMENT TIPS
// ============================================================
const improvementTips = {
  A: [
    { tip: 'Полностью заполните профиль', impact: 'Повышает доверие посетителей', effort: 'Низкая' },
    { tip: 'Добавьте качественные фото', impact: 'Увеличивает конверсию на 25%', effort: 'Низкая' },
    { tip: 'Опишите процесс производства', impact: 'Демонстрирует открытость', effort: 'Средняя' },
    { tip: 'Укажите контакты для связи', impact: 'Облегчает коммуникацию', effort: 'Низкая' },
  ],
  B: [
    { tip: 'Закажите профессиональное видео', impact: 'Открывает уровень B', effort: 'Средняя' },
    { tip: 'Покажите реальное производство', impact: 'Доказывает подлинность', effort: 'Средняя' },
    { tip: 'Начните отвечать на отзывы', impact: 'Готовит к уровню C', effort: 'Средняя' },
    { tip: 'Публикуйте регулярный контент', impact: 'Повышает видимость', effort: 'Высокая' },
  ],
  C: [
    { tip: 'Отвечайте на ВСЕ отзывы', impact: 'Критично для 85%+ rate', effort: 'Высокая' },
    { tip: 'Отвечайте в течение 24 часов', impact: 'Улучшает метрику времени', effort: 'Высокая' },
    { tip: 'Публикуйте кейсы решения проблем', impact: 'Обязательно для уровня C', effort: 'Средняя' },
    { tip: 'Благодарите за позитивные отзывы', impact: 'Укрепляет отношения', effort: 'Низкая' },
  ],
}

// ============================================================
// FAQ DATA
// ============================================================
const faqItems = [
  {
    question: 'Как рассчитывается уровень доверия?',
    answer:
      'Уровень доверия определяется по четким критериям для каждого статуса. Уровень A выдается при оплате подписки. Уровень B требует профессионального видео и модерации. Уровень C рассчитывается автоматически на основе метрик: количество отзывов (15+), процент ответов (85%+), скорость ответа (<48ч) и наличие публичных кейсов. Система проверяет критерии ежедневно.',
  },
  {
    question: 'Почему уровень C нельзя купить?',
    answer:
      'Уровень C - это награда за реальную работу с клиентами, а не за финансовые возможности. Мы считаем, что настоящее доверие нельзя купить - его можно только заработать последовательными действиями. Это делает статус C особенно ценным для потребителей.',
  },
  {
    question: 'Как часто обновляются данные?',
    answer:
      'Большинство метрик обновляется в реальном времени. Проверка критериев уровня C происходит каждые 24 часа. Модерация видео для уровня B занимает 3-5 рабочих дней. Статистика отзывов и ответов обновляется мгновенно.',
  },
  {
    question: 'Может ли уровень понизиться?',
    answer:
      'Да, уровень может деградировать. Уровень B понижается до A через 18 месяцев без обновления видеоконтента. Уровень C понижается до B, если метрики падают ниже порогов (response rate < 80%, время ответа > 72 часа). Перед понижением отправляются предупреждения.',
  },
  {
    question: 'Проверяете ли вы юридическую чистоту компаний?',
    answer:
      'Нет, мы НЕ проводим юридическую проверку организаций. Мы не проверяем наличие судебных дел, долгов, нарушений или банкротств. Наши уровни отражают активность организации на платформе и работу с отзывами, но не заменяют due diligence.',
  },
  {
    question: 'Как я могу оспорить свой уровень?',
    answer:
      'Если вы считаете, что ваш уровень определен некорректно, напишите в поддержку support@chestno.ru с описанием ситуации. Мы проверим данные и при необходимости скорректируем. Для уровня C вы можете отслеживать прогресс в личном кабинете.',
  },
  {
    question: 'Что означает "Проверено платформой" (уровень B)?',
    answer:
      'Это означает, что наша команда просмотрела видеоматериалы организации и убедилась, что они соответствуют заявленной деятельности. Мы проверяем, что видео не является монтажом или манипуляцией, и что показанное производство реально существует. Но это НЕ означает сертификацию качества продукции.',
  },
  {
    question: 'Как отзывы влияют на уровень?',
    answer:
      'Количество отзывов влияет только на уровень C (нужно 15+). Важнее не количество, а ваша реакция: процент ответов и скорость ответа. Негативные отзывы не понижают уровень напрямую, но отсутствие ответов на них - понижает.',
  },
  {
    question: 'Можно ли удалить негативные отзывы?',
    answer:
      'Отзывы можно оспорить через модерацию, если они содержат клевету, оскорбления или не соответствуют правилам платформы. Однако честные негативные отзывы удалению не подлежат. Лучшая стратегия - публично ответить и показать решение проблемы.',
  },
  {
    question: 'Публикуете ли вы данные о методологии?',
    answer:
      'Да, вы находитесь на странице публичной методологии. Мы придерживаемся политики максимальной прозрачности. Все критерии, источники данных и ограничения описаны на этой странице. При изменении методологии мы уведомляем организации заранее.',
  },
]

// ============================================================
// VERIFICATION PROCESS STEPS
// ============================================================
const verificationSteps = [
  {
    step: 1,
    title: 'Регистрация',
    description: 'Организация создает аккаунт и заполняет базовую информацию',
    duration: '5 минут',
    automated: true,
  },
  {
    step: 2,
    title: 'Верификация email',
    description: 'Подтверждение электронной почты по ссылке',
    duration: 'Мгновенно',
    automated: true,
  },
  {
    step: 3,
    title: 'Оплата подписки',
    description: 'Выбор тарифа и оплата (или активация trial)',
    duration: '2 минуты',
    automated: true,
  },
  {
    step: 4,
    title: 'Уровень A активен',
    description: 'Автоматическое присвоение статуса после оплаты',
    duration: 'Мгновенно',
    automated: true,
  },
  {
    step: 5,
    title: 'Загрузка видео (для B)',
    description: 'Загрузка профессионального видео или заказ съемки',
    duration: '1-7 дней',
    automated: false,
  },
  {
    step: 6,
    title: 'Модерация (для B)',
    description: 'Ручная проверка видеоматериалов командой',
    duration: '3-5 дней',
    automated: false,
  },
  {
    step: 7,
    title: 'Работа с отзывами (для C)',
    description: 'Накопление отзывов и ответов, публикация кейсов',
    duration: '14+ дней',
    automated: true,
  },
  {
    step: 8,
    title: 'Автоматическое повышение до C',
    description: 'Система проверяет критерии ежедневно',
    duration: 'При выполнении критериев',
    automated: true,
  },
]

// ============================================================
// MAIN COMPONENT
// ============================================================
export const MethodologyPage = () => {
  const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C'>('A')

  useEffect(() => {
    document.title = 'Методология оценки | Честно.ру - Как мы оцениваем производителей'
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
            <div className="space-y-4">
              <Badge variant="outline" className="px-4 py-1">
                <Shield className="w-4 h-4 mr-2" />
                Полная прозрачность
              </Badge>
              <h1 className="font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
                Как мы оцениваем <span className="text-primary">производителей</span>
              </h1>
              <p className="text-xl text-muted-foreground lg:text-2xl">
                Открытая методология расчета уровней доверия
              </p>
            </div>

            <p className="max-w-2xl mx-auto text-lg leading-relaxed text-muted-foreground">
              Мы верим, что доверие начинается с прозрачности. На этой странице подробно описано, как работает наша
              система оценки, какие данные мы используем и - что особенно важно - чего мы НЕ проверяем.
            </p>

            <div className="flex flex-wrap justify-center gap-8 pt-8">
              <div className="text-center space-y-2">
                <StatusBadge level="A" size="lg" />
                <p className="text-sm text-muted-foreground font-medium">Самодекларация</p>
              </div>
              <div className="text-center space-y-2">
                <StatusBadge level="B" size="lg" />
                <p className="text-sm text-muted-foreground font-medium">Проверено</p>
              </div>
              <div className="text-center space-y-2">
                <StatusBadge level="C" size="lg" />
                <p className="text-sm text-muted-foreground font-medium">Высшая репутация</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="container py-4">
          <nav className="flex flex-wrap justify-center gap-4 text-sm">
            <a href="#criteria" className="text-muted-foreground hover:text-primary transition-colors">
              Критерии
            </a>
            <a href="#process" className="text-muted-foreground hover:text-primary transition-colors">
              Процесс верификации
            </a>
            <a href="#sources" className="text-muted-foreground hover:text-primary transition-colors">
              Источники данных
            </a>
            <a href="#gaps" className="text-muted-foreground hover:text-primary transition-colors">
              Ограничения
            </a>
            <a href="#improve" className="text-muted-foreground hover:text-primary transition-colors">
              Как улучшить статус
            </a>
            <a href="#faq" className="text-muted-foreground hover:text-primary transition-colors">
              FAQ
            </a>
          </nav>
        </div>
      </section>

      {/* Level Criteria Section */}
      <section id="criteria" className="py-16 lg:py-24">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-bold lg:text-4xl">Критерии присвоения уровней</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Четкие и измеримые требования для каждого уровня доверия
              </p>
            </div>

            {/* Level Tabs */}
            <div className="flex justify-center gap-4 mb-8">
              {(['A', 'B', 'C'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setActiveTab(level)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                    activeTab === level
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  <StatusBadge level={level} size="sm" />
                  <span>Уровень {level}</span>
                </button>
              ))}
            </div>

            {/* Level Content */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Requirements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Требования для получения
                  </CardTitle>
                  <CardDescription>{levelCriteria[activeTab].tagline}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {levelCriteria[activeTab].requirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">{req.label}</p>
                          <p className="text-sm text-muted-foreground">{req.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* What We Check vs Don't Check */}
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Eye className="h-5 w-5 text-green-600" />
                      Что мы проверяем
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {levelCriteria[activeTab].whatWeCheck.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <EyeOff className="h-5 w-5 text-orange-600" />
                      Что мы НЕ проверяем
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {levelCriteria[activeTab].whatWeDoNotCheck.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <XCircle className="h-4 w-4 text-orange-600 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Verification Process */}
      <section id="process" className="py-16 lg:py-24 bg-muted/30">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-bold lg:text-4xl">Процесс верификации</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Пошаговый путь от регистрации до высшего уровня доверия
              </p>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-border -translate-x-1/2" />

              <div className="space-y-8">
                {verificationSteps.map((step, idx) => (
                  <div
                    key={step.step}
                    className={`relative flex flex-col lg:flex-row items-center gap-4 lg:gap-8 ${
                      idx % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
                    }`}
                  >
                    {/* Step Card */}
                    <Card className="w-full lg:w-5/12">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={step.automated ? 'default' : 'secondary'}>
                            {step.automated ? 'Автоматически' : 'Ручная проверка'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{step.duration}</span>
                        </div>
                        <CardTitle className="text-lg">{step.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </CardContent>
                    </Card>

                    {/* Step Number */}
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg shadow-lg z-10">
                      {step.step}
                    </div>

                    {/* Empty space for alignment */}
                    <div className="hidden lg:block w-5/12" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section id="sources" className="py-16 lg:py-24">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-bold lg:text-4xl">Источники данных</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Откуда мы берем информацию для оценки организаций
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {dataSources.map((source, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <source.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{source.title}</CardTitle>
                          <p className={`text-sm font-medium ${source.reliabilityColor}`}>
                            Надежность: {source.reliability}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{source.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Data Gaps / Honesty Section */}
      <section id="gaps" className="py-16 lg:py-24 bg-orange-50/50 dark:bg-orange-950/10">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <Badge variant="outline" className="px-4 py-1 border-orange-500 text-orange-700">
                <AlertCircle className="w-4 h-4 mr-2" />
                Важно понимать
              </Badge>
              <h2 className="text-3xl font-bold lg:text-4xl">Ограничения нашей оценки</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Мы честно признаем, что наша система НЕ покрывает все аспекты. Вот что вам нужно знать.
              </p>
            </div>

            <div className="space-y-6">
              {dataGaps.map((gap, idx) => (
                <Card key={idx} className="border-orange-200">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                        <gap.icon className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="space-y-2">
                        <CardTitle className="text-lg">{gap.title}</CardTitle>
                        <p className="text-muted-foreground">{gap.description}</p>
                        <div className="flex items-start gap-2 pt-2">
                          <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <p className="text-sm text-primary">{gap.whatToDo}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>

            <div className="mt-12 p-6 bg-background rounded-lg border text-center">
              <p className="text-lg font-medium mb-2">Наши уровни - это НЕ гарантия качества</p>
              <p className="text-muted-foreground">
                Уровень доверия показывает активность организации на платформе и работу с отзывами. Это полезный
                индикатор, но не замена собственной проверки при важных решениях.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Improvement Tips for Producers */}
      <section id="improve" className="py-16 lg:py-24">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <Badge variant="outline" className="px-4 py-1">
                <TrendingUp className="w-4 h-4 mr-2" />
                Для производителей
              </Badge>
              <h2 className="text-3xl font-bold lg:text-4xl">Как улучшить свой статус</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Практические советы для повышения уровня доверия
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {(['A', 'B', 'C'] as const).map((level) => (
                <Card key={level} className={level === 'C' ? 'border-primary' : ''}>
                  <CardHeader className="text-center">
                    <StatusBadge level={level} size="lg" />
                    <CardTitle className="mt-4">
                      {level === 'A' && 'Укрепление уровня A'}
                      {level === 'B' && 'Путь к уровню B'}
                      {level === 'C' && 'Достижение уровня C'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {improvementTips[level].map((tip, idx) => (
                        <li key={idx} className="space-y-1">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-1 shrink-0" />
                            <span className="font-medium text-sm">{tip.tip}</span>
                          </div>
                          <div className="ml-6 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {tip.impact}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Усилия: {tip.effort}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth">
                  Начать повышение статуса <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 lg:py-24 bg-muted/30">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-bold lg:text-4xl">Часто задаваемые вопросы</h2>
              <p className="text-lg text-muted-foreground">Ответы на вопросы о методологии оценки</p>
            </div>

            <div className="space-y-4">
              {faqItems.map((faq, idx) => (
                <Collapsible key={idx}>
                  <Card>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardTitle className="text-left text-base lg:text-lg flex items-center gap-2">
                          <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                          {faq.question}
                        </CardTitle>
                        <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="text-sm text-muted-foreground pt-0 pl-12">{faq.answer}</CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Summary / Trust Statement */}
      <section className="py-16 lg:py-24">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 border-primary/20">
              <CardContent className="p-8 lg:p-12 text-center space-y-6">
                <Award className="h-16 w-16 mx-auto text-primary" />
                <h2 className="text-2xl lg:text-3xl font-bold">Наше обещание</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    Мы стремимся быть максимально прозрачными в том, как работает наша система оценки. Если у вас есть
                    вопросы или предложения по улучшению методологии - мы всегда открыты к диалогу.
                  </p>
                  <p>
                    Наша цель - создать честную среду, где добросовестные производители могут доказать свою
                    надежность, а потребители могут принимать информированные решения.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-4 pt-4">
                  <Button asChild variant="outline">
                    <a href="mailto:methodology@chestno.ru">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Вопросы по методологии
                    </a>
                  </Button>
                  <Button asChild>
                    <Link to="/levels">
                      <Layers className="h-4 w-4 mr-2" />
                      Подробнее об уровнях
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Last Updated */}
      <section className="py-8 border-t">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center text-sm text-muted-foreground">
            <p>
              Последнее обновление методологии: Февраль 2026 | Версия 2.1
            </p>
            <p className="mt-2">
              При изменении критериев оценки все организации уведомляются за 30 дней до вступления изменений в силу.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default MethodologyPage
