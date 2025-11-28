import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const StoriesPage = () => {
  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>Истории производств</CardTitle>
          <CardDescription>Скоро тут будет новая информация</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Мы собираем вдохновляющие истории российских производителей. Скоро здесь вы сможете узнать о людях, которые
            создают качественные товары и развивают производство в России.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

