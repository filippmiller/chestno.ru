/**
 * Mock data for testing Status Notifications
 *
 * This file provides sample data for all notification types
 * to be used in development and testing.
 */

import type {
  StatusNotification,
  StatusGrantedMetadata,
  StatusExpiringMetadata,
  StatusRevokedMetadata,
  UpgradeRequestReviewedMetadata,
} from '@/types/status-notifications'

// Helper to generate timestamps
const daysAgo = (days: number): string => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

const daysFromNow = (days: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

/**
 * Mock: Status Granted (A Level)
 */
export const mockStatusGrantedA: StatusNotification = {
  id: 'notif-001',
  type: 'status_granted',
  severity: 'celebration',
  title: 'Поздравляем! Вы получили статус A',
  body: 'Ваша организация теперь имеет высший уровень доверия. Вы получаете приоритетное размещение в каталоге, расширенную аналитику и специальный значок верификации.',
  metadata: {
    level: 'A',
    benefits: [
      'Приоритетное размещение в каталоге',
      'Расширенная аналитика',
      'Специальный значок верификации',
      'Доступ к премиум-функциям',
    ],
    effective_date: new Date().toISOString(),
  } as StatusGrantedMetadata,
  created_at: daysAgo(0),
  read: false,
  cta_label: 'Посмотреть профиль',
  cta_url: '/organization/profile',
}

/**
 * Mock: Status Granted (B Level)
 */
export const mockStatusGrantedB: StatusNotification = {
  id: 'notif-002',
  type: 'status_granted',
  severity: 'celebration',
  title: 'Поздравляем! Вы получили статус B',
  body: 'Ваша организация получила статус подтверждённого производителя. Теперь у вас есть доступ к расширенным возможностям платформы.',
  metadata: {
    level: 'B',
    benefits: [
      'Значок подтверждённого производителя',
      'Доступ к базовой аналитике',
      'Возможность размещать до 50 товаров',
    ],
    effective_date: daysAgo(2),
  } as StatusGrantedMetadata,
  created_at: daysAgo(2),
  read: true,
  cta_label: 'Посмотреть профиль',
  cta_url: '/organization/profile',
}

/**
 * Mock: Status Expiring (7 days)
 */
export const mockStatusExpiring7Days: StatusNotification = {
  id: 'notif-003',
  type: 'status_expiring',
  severity: 'warning',
  title: 'Ваш статус A истекает через 7 дней',
  body: 'Чтобы сохранить все преимущества статуса A, необходимо продлить подписку до истечения срока действия. После истечения статус будет понижен до уровня B.',
  metadata: {
    level: 'A',
    days_left: 7,
    expiry_date: daysFromNow(7),
    renewal_url: '/subscription/renew',
    action_required: 'Продлите подписку Premium',
  } as StatusExpiringMetadata,
  created_at: daysAgo(0),
  read: false,
  cta_label: 'Продлить сейчас',
  cta_url: '/subscription/renew',
}

/**
 * Mock: Status Expiring (2 days - urgent)
 */
export const mockStatusExpiring2Days: StatusNotification = {
  id: 'notif-004',
  type: 'status_expiring',
  severity: 'warning',
  title: 'Срочно! Ваш статус B истекает через 2 дня',
  body: 'Осталось всего 2 дня до истечения срока действия статуса B. Обновите информацию о вашей организации или продлите подписку, чтобы сохранить текущий статус.',
  metadata: {
    level: 'B',
    days_left: 2,
    expiry_date: daysFromNow(2),
    renewal_url: '/subscription/renew',
    action_required: 'Обновите профиль или продлите подписку',
  } as StatusExpiringMetadata,
  created_at: daysAgo(0),
  read: false,
  cta_label: 'Продлить сейчас',
  cta_url: '/subscription/renew',
}

/**
 * Mock: Status Revoked
 */
export const mockStatusRevoked: StatusNotification = {
  id: 'notif-005',
  type: 'status_revoked',
  severity: 'error',
  title: 'Статус B отозван',
  body: 'К сожалению, ваш статус B был отозван из-за несоответствия требованиям платформы. Вы можете подать апелляцию или обратиться в службу поддержки для получения дополнительной информации.',
  metadata: {
    level: 'B',
    reason: 'Несоответствие требованиям верификации: отсутствие актуальных документов о сертификации продукции',
    revoked_at: daysAgo(1),
    appeal_url: '/support/appeal',
  } as StatusRevokedMetadata,
  created_at: daysAgo(1),
  read: false,
  cta_label: 'Узнать подробности',
  cta_url: '/support/appeal',
}

/**
 * Mock: Upgrade Request Approved
 */
export const mockUpgradeApproved: StatusNotification = {
  id: 'notif-006',
  type: 'upgrade_request_reviewed',
  severity: 'info',
  title: 'Ваш запрос на повышение до статуса A одобрен',
  body: 'Отличные новости! Ваша заявка на повышение статуса была одобрена модератором. Статус A будет присвоен в течение 24 часов.',
  metadata: {
    target_level: 'A',
    approved: true,
    review_notes: 'Все требования выполнены. Документы проверены и подтверждены. Высокий рейтинг и положительные отзывы.',
    reviewed_by: 'Модератор Алексей',
    reviewed_at: daysAgo(0),
    next_steps: 'Статус будет активирован автоматически в течение 24 часов',
  } as UpgradeRequestReviewedMetadata,
  created_at: daysAgo(0),
  read: false,
  cta_label: 'Посмотреть статус',
  cta_url: '/status-dashboard',
}

/**
 * Mock: Upgrade Request Rejected
 */
export const mockUpgradeRejected: StatusNotification = {
  id: 'notif-007',
  type: 'upgrade_request_reviewed',
  severity: 'error',
  title: 'Ваш запрос на повышение до статуса A отклонён',
  body: 'К сожалению, ваша заявка на повышение статуса была отклонена. Пожалуйста, ознакомьтесь с комментариями модератора и устраните указанные недостатки.',
  metadata: {
    target_level: 'A',
    approved: false,
    review_notes: 'Требуется дополнить документацию: отсутствуют сертификаты ISO, недостаточно информации о производственных мощностях. Также необходимо добавить больше фотографий продукции.',
    reviewed_by: 'Модератор Мария',
    reviewed_at: daysAgo(1),
    next_steps: 'Дополните информацию и повторите заявку через 30 дней',
  } as UpgradeRequestReviewedMetadata,
  created_at: daysAgo(1),
  read: false,
  cta_label: 'Посмотреть детали',
  cta_url: '/status-dashboard',
}

/**
 * Mock: Status Granted (C Level - first level)
 */
export const mockStatusGrantedC: StatusNotification = {
  id: 'notif-008',
  type: 'status_granted',
  severity: 'celebration',
  title: 'Добро пожаловать! Вам присвоен статус C',
  body: 'Ваша организация успешно зарегистрирована на платформе Честно.ру. Начните с заполнения профиля и добавления первых товаров.',
  metadata: {
    level: 'C',
    benefits: [
      'Базовый профиль организации',
      'Возможность размещать до 10 товаров',
      'Генерация QR-кодов',
    ],
    effective_date: daysAgo(5),
  } as StatusGrantedMetadata,
  created_at: daysAgo(5),
  read: true,
  cta_label: 'Настроить профиль',
  cta_url: '/organization/profile/edit',
}

/**
 * All mock notifications array
 */
export const mockStatusNotifications: StatusNotification[] = [
  mockStatusGrantedA,
  mockStatusGrantedB,
  mockStatusExpiring7Days,
  mockStatusExpiring2Days,
  mockStatusRevoked,
  mockUpgradeApproved,
  mockUpgradeRejected,
  mockStatusGrantedC,
]

/**
 * Helper to generate random mock notification
 */
export const generateRandomMockNotification = (): StatusNotification => {
  const random = Math.floor(Math.random() * mockStatusNotifications.length)
  return {
    ...mockStatusNotifications[random],
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    read: Math.random() > 0.5,
  }
}
