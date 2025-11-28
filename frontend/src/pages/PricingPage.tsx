import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const PricingPage = () => {
  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>Тарифы для производителей</CardTitle>
          <CardDescription>Скоро тут будет новая информация</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Мы разрабатываем гибкие тарифные планы для производителей. Скоро здесь вы сможете выбрать подходящий тариф
            для вашего бизнеса.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

