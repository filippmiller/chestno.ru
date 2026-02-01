/**
 * CertificationBadge Component
 *
 * Displayable staff certification badge showing certification status,
 * expiration, and visual badge representation.
 */
import { Award, Calendar, CheckCircle, Clock, Download, Share2, Shield } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCertificationBadgeUrl } from '@/api/staffService'
import type { StaffCertification } from '@/types/retail'

interface CertificationBadgeProps {
  certification: StaffCertification
  showActions?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function CertificationBadge({
  certification,
  showActions = true,
  size = 'md',
  className = '',
}: CertificationBadgeProps) {
  const {
    staff_id,
    staff_name,
    store_name,
    is_certified,
    certified_at,
    expires_at,
    modules_completed,
    total_modules,
    badge_url,
  } = certification

  // Check if certification is expiring soon (within 30 days)
  const isExpiringSoon = expires_at
    ? new Date(expires_at).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
    : false

  // Check if certification is expired
  const isExpired = expires_at
    ? new Date(expires_at).getTime() < Date.now()
    : false

  // Size configurations
  const sizeConfig = {
    sm: {
      badgeSize: 'h-16 w-16',
      iconSize: 'h-8 w-8',
      titleSize: 'text-sm',
      textSize: 'text-xs',
    },
    md: {
      badgeSize: 'h-24 w-24',
      iconSize: 'h-12 w-12',
      titleSize: 'text-base',
      textSize: 'text-sm',
    },
    lg: {
      badgeSize: 'h-32 w-32',
      iconSize: 'h-16 w-16',
      titleSize: 'text-lg',
      textSize: 'text-base',
    },
  }[size]

  // Handle download badge
  const handleDownload = () => {
    const url = badge_url || getCertificationBadgeUrl(staff_id)
    window.open(url, '_blank')
  }

  // Handle share
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Сертификат Амбассадора Честно',
          text: `${staff_name} - сертифицированный Амбассадор Честно`,
          url: badge_url || getCertificationBadgeUrl(staff_id),
        })
      } catch (err) {
        console.error('Share failed:', err)
      }
    }
  }

  // Not certified view
  if (!is_certified) {
    return (
      <Card className={`${className}`}>
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div
              className={`
                flex items-center justify-center rounded-full bg-gray-100
                ${sizeConfig.badgeSize}
              `}
            >
              <Award className={`${sizeConfig.iconSize} text-gray-400`} />
            </div>
            <div>
              <p className={`font-medium ${sizeConfig.titleSize}`}>
                Сертификация не пройдена
              </p>
              <p className={`text-muted-foreground ${sizeConfig.textSize}`}>
                Пройдено {modules_completed} из {total_modules} модулей
              </p>
              <div className="mt-2 h-2 w-32 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(modules_completed / total_modules) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className={sizeConfig.titleSize}>
            Сертификат Амбассадора
          </CardTitle>
          {isExpired ? (
            <Badge variant="destructive">Истек</Badge>
          ) : isExpiringSoon ? (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
              Скоро истекает
            </Badge>
          ) : (
            <Badge className="bg-green-100 text-green-700">Активен</Badge>
          )}
        </div>
        <CardDescription>
          Платформа Честно
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {/* Badge visual */}
          <div className="relative">
            <div
              className={`
                flex items-center justify-center rounded-full
                ${sizeConfig.badgeSize}
                ${isExpired ? 'bg-gray-100' : 'bg-gradient-to-br from-primary/20 to-primary/5'}
              `}
            >
              {badge_url ? (
                <img
                  src={badge_url}
                  alt="Certification Badge"
                  className={`rounded-full object-cover ${sizeConfig.badgeSize}`}
                />
              ) : (
                <div className="relative">
                  <Shield
                    className={`
                      ${sizeConfig.iconSize}
                      ${isExpired ? 'text-gray-400' : 'text-primary'}
                    `}
                  />
                  <CheckCircle
                    className={`
                      absolute -bottom-1 -right-1 h-6 w-6
                      ${isExpired ? 'text-gray-400' : 'text-green-500'}
                    `}
                  />
                </div>
              )}
            </div>
            {/* Certified indicator */}
            {!isExpired && (
              <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
                <CheckCircle className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* Certificate info */}
          <div className="flex-1 text-center sm:text-left">
            <p className={`font-bold ${sizeConfig.titleSize}`}>{staff_name}</p>
            <p className={`text-muted-foreground ${sizeConfig.textSize}`}>
              {store_name}
            </p>

            <div className={`mt-3 space-y-1 ${sizeConfig.textSize}`}>
              {certified_at && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground sm:justify-start">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Сертифицирован: {new Date(certified_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              )}
              {expires_at && (
                <div
                  className={`
                    flex items-center justify-center gap-2 sm:justify-start
                    ${isExpired ? 'text-red-500' : isExpiringSoon ? 'text-yellow-600' : 'text-muted-foreground'}
                  `}
                >
                  <Clock className="h-4 w-4" />
                  <span>
                    {isExpired ? 'Истек' : 'Действует до'}:{' '}
                    {new Date(expires_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              )}
            </div>

            {/* Modules completed */}
            <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
              <Award className="h-4 w-4 text-primary" />
              <span className={sizeConfig.textSize}>
                {modules_completed} модулей пройдено
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {showActions && !isExpired && (
          <div className="mt-6 flex justify-center gap-3 sm:justify-start">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Скачать
            </Button>
            {navigator.share && (
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Поделиться
              </Button>
            )}
          </div>
        )}

        {/* Renewal notice */}
        {isExpiringSoon && !isExpired && (
          <div className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
            <p>
              Ваш сертификат скоро истечет. Пройдите повторное обучение для продления.
            </p>
          </div>
        )}

        {isExpired && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p>
              Срок действия сертификата истек. Пройдите обучение заново для восстановления статуса.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CertificationBadge
