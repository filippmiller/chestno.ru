import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export const ProducersLandingPage = () => (
  <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10 text-center">
    <p className="text-sm uppercase text-muted-foreground">Работаем Честно!</p>
    <h1 className="text-4xl font-semibold">Проверенные производители скоро будут доступны</h1>
    <p className="text-muted-foreground">
      Публичный каталог производителей в разработке. Уже сейчас вы можете открыть любую страницу по QR-коду на
      упаковке или подписаться, чтобы узнать о запуске.
    </p>
    <div className="flex justify-center gap-3">
      <Button asChild>
        <Link to="/register">Стать производителем</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/org/demo-slug">Посмотреть пример профиля</Link>
      </Button>
    </div>
  </div>
)

