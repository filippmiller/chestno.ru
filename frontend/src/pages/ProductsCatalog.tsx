import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const ProductsCatalogPage = () => {
  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>Каталог товаров</CardTitle>
          <CardDescription>Скоро тут будет новая информация</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Мы работаем над созданием каталога товаров российских производителей. Скоро здесь вы сможете найти и
            купить качественные товары, сделанные в России.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

