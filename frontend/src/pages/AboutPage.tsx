import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const AboutPage = () => {
  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>О проекте</CardTitle>
          <CardDescription>Скоро тут будет новая информация</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Мы создаем платформу для поддержки российских производителей. Скоро здесь вы сможете узнать больше о нашей
            миссии, целях и команде.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

