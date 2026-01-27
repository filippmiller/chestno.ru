import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LevelDetail, StatusLevel } from '@/types/auth'

interface StatusCardProps {
  level: StatusLevel
  details?: LevelDetail
  className?: string
}

const LEVEL_CONFIG = {
  A: {
    label: 'Уровень A',
    description: 'Базовый статус',
    color: 'bg-gray-500',
  },
  B: {
    label: 'Уровень B',
    description: 'Повышенный статус',
    color: 'bg-blue-500',
  },
  C: {
    label: 'Уровень C',
    description: 'Премиум статус',
    color: 'bg-green-500',
  },
} as const

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export const StatusCard = ({ level, details, className }: StatusCardProps) => {
  const config = LEVEL_CONFIG[level]

  const getDaysUntilExpiry = () => {
    if (!details?.expires_at) return null
    const now = new Date()
    const expiry = new Date(details.expires_at)
    const diffTime = expiry.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysUntilExpiry = getDaysUntilExpiry()

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Текущий статус</span>
          <Badge className={`${config.color} text-white text-lg px-4 py-2`}>{config.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-muted-foreground">{config.description}</p>
        </div>

        {details && (
          <div className="space-y-2 text-sm">
            {details.valid_from && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Действует с:</span>
                <span className="font-medium">{formatDate(details.valid_from)}</span>
              </div>
            )}

            {details.expires_at && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Действует до:</span>
                  <span className="font-medium">{formatDate(details.expires_at)}</span>
                </div>

                {daysUntilExpiry !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">До истечения:</span>
                    <span
                      className={`font-medium ${
                        daysUntilExpiry <= 7
                          ? 'text-red-600'
                          : daysUntilExpiry <= 30
                            ? 'text-yellow-600'
                            : 'text-green-600'
                      }`}
                    >
                      {daysUntilExpiry} дней
                    </span>
                  </div>
                )}
              </>
            )}

            {!details.expires_at && details.valid_from && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Срок действия:</span>
                <span className="font-medium text-green-600">Бессрочно</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
