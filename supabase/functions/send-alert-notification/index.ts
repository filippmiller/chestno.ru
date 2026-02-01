/**
 * Edge Function: Send Alert Notification
 *
 * Multi-channel notification delivery for scan alerts:
 * - Push notifications (Web Push)
 * - Email (via Resend/SendGrid)
 * - Telegram
 *
 * Triggered by database webhook on notification_deliveries insert
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const SITE_URL = Deno.env.get('SITE_URL') || 'https://chestno.ru'

interface NotificationDelivery {
  id: string
  notification_id: string
  user_id: string
  channel: 'in_app' | 'push' | 'email' | 'telegram'
  status: string
}

interface Notification {
  id: string
  title: string
  body: string
  payload: Record<string, unknown>
  severity: string
  category: string
  org_id: string
}

interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

interface TelegramLink {
  telegram_chat_id: string
  is_verified: boolean
  is_enabled: boolean
}

interface UserProfile {
  id: string
  email: string
  display_name?: string
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ============================================
// Push Notification
// ============================================

async function sendPushNotification(
  subscription: PushSubscription,
  notification: Notification
): Promise<boolean> {
  if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
    console.error('VAPID keys not configured')
    return false
  }

  try {
    // Using web-push library logic
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: '/icons/alert-icon.png',
      badge: '/icons/badge-icon.png',
      tag: `alert-${notification.id}`,
      data: {
        url: `${SITE_URL}/producer/alerts/${notification.payload?.alert_id || ''}`,
        notification_id: notification.id,
        severity: notification.severity,
      },
      actions: [
        { action: 'view', title: 'Посмотреть' },
        { action: 'dismiss', title: 'Скрыть' },
      ],
    })

    // For production, use proper web-push library
    // This is a simplified version
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        'Urgency': notification.severity === 'critical' ? 'high' : 'normal',
      },
      body: payload,
    })

    return response.ok
  } catch (error) {
    console.error('Push notification failed:', error)
    return false
  }
}

// ============================================
// Email Notification
// ============================================

async function sendEmailNotification(
  user: UserProfile,
  notification: Notification,
  orgName: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('Resend API key not configured')
    return false
  }

  const severityColors = {
    info: '#3B82F6',
    warning: '#F59E0B',
    critical: '#EF4444',
  }

  const severityLabels = {
    info: 'Информация',
    warning: 'Предупреждение',
    critical: 'КРИТИЧЕСКОЕ',
  }

  const color = severityColors[notification.severity as keyof typeof severityColors] || '#6B7280'
  const label = severityLabels[notification.severity as keyof typeof severityLabels] || 'Уведомление'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${color}; padding: 20px 30px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">
                ${label}: ${notification.title}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ${notification.body}
              </p>

              ${notification.payload?.batch_code ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
                <tr>
                  <td>
                    <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase;">Партия</p>
                    <p style="color: #111827; font-size: 14px; font-weight: 600; margin: 0;">${notification.payload.batch_code}</p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <a href="${SITE_URL}/producer/alerts/${notification.payload?.alert_id || ''}"
                 style="display: inline-block; background-color: ${color}; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
                Посмотреть детали
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Это автоматическое уведомление от ${orgName} на платформе Честно.
                <br>
                <a href="${SITE_URL}/producer/settings/notifications" style="color: #3B82F6;">Настроить уведомления</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Честно <alerts@chestno.ru>',
        to: user.email,
        subject: `${label}: ${notification.title}`,
        html,
      }),
    })

    const data = await response.json()
    return response.ok && data.id
  } catch (error) {
    console.error('Email notification failed:', error)
    return false
  }
}

// ============================================
// Telegram Notification
// ============================================

async function sendTelegramNotification(
  chatId: string,
  notification: Notification
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('Telegram bot token not configured')
    return false
  }

  const severityEmoji = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
  }

  const emoji = severityEmoji[notification.severity as keyof typeof severityEmoji] || '📢'

  const message = `${emoji} *${escapeMarkdown(notification.title)}*

${escapeMarkdown(notification.body)}

${notification.payload?.batch_code ? `📦 Партия: \`${notification.payload.batch_code}\`` : ''}

[Посмотреть детали](${SITE_URL}/producer/alerts/${notification.payload?.alert_id || ''})`

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '👁 Посмотреть',
                  url: `${SITE_URL}/producer/alerts/${notification.payload?.alert_id || ''}`,
                },
              ],
              notification.severity === 'critical'
                ? [
                    {
                      text: '✅ Принять',
                      callback_data: `ack_${notification.payload?.alert_id}`,
                    },
                  ]
                : [],
            ].filter((row) => row.length > 0),
          },
        }),
      }
    )

    const data = await response.json()
    return response.ok && data.ok
  } catch (error) {
    console.error('Telegram notification failed:', error)
    return false
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
}

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const body = await req.json()

    // Handle database webhook payload
    const delivery: NotificationDelivery = body.record || body

    if (!delivery.id || !delivery.notification_id || !delivery.user_id) {
      return new Response(
        JSON.stringify({ error: 'Invalid delivery record' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    // Skip if not pending
    if (delivery.status !== 'pending') {
      return new Response(
        JSON.stringify({ message: 'Delivery not pending, skipping' }),
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    // Get notification details
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', delivery.notification_id)
      .single()

    if (notifError || !notification) {
      throw new Error(`Notification not found: ${notifError?.message}`)
    }

    // Get user profile
    const { data: user, error: userError } = await supabase.auth
      .admin.getUserById(delivery.user_id)

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message}`)
    }

    // Get organization name
    let orgName = 'Честно'
    if (notification.org_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', notification.org_id)
        .single()
      if (org) orgName = org.name
    }

    let success = false
    let errorMessage: string | null = null

    // Send based on channel
    switch (delivery.channel) {
      case 'in_app':
        // In-app is handled by the notifications table itself
        success = true
        break

      case 'push': {
        const { data: pushSubs } = await supabase
          .from('user_push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', delivery.user_id)

        if (pushSubs && pushSubs.length > 0) {
          const results = await Promise.all(
            pushSubs.map((sub) => sendPushNotification(sub, notification))
          )
          success = results.some((r) => r)
        } else {
          errorMessage = 'No push subscriptions found'
        }
        break
      }

      case 'email': {
        const userProfile: UserProfile = {
          id: user.user.id,
          email: user.user.email!,
          display_name: user.user.user_metadata?.display_name,
        }
        success = await sendEmailNotification(userProfile, notification, orgName)
        if (!success) errorMessage = 'Email delivery failed'
        break
      }

      case 'telegram': {
        const { data: telegramLink } = await supabase
          .from('user_telegram_links')
          .select('telegram_chat_id, is_verified, is_enabled')
          .eq('user_id', delivery.user_id)
          .single()

        if (telegramLink?.is_verified && telegramLink?.is_enabled) {
          success = await sendTelegramNotification(
            telegramLink.telegram_chat_id,
            notification
          )
          if (!success) errorMessage = 'Telegram delivery failed'
        } else {
          errorMessage = 'Telegram not linked or disabled'
        }
        break
      }

      default:
        errorMessage = `Unknown channel: ${delivery.channel}`
    }

    // Update delivery status
    await supabase
      .from('notification_deliveries')
      .update({
        status: success ? 'sent' : 'failed',
        sent_at: success ? new Date().toISOString() : null,
        error_message: errorMessage,
      })
      .eq('id', delivery.id)

    return new Response(
      JSON.stringify({
        success,
        delivery_id: delivery.id,
        channel: delivery.channel,
        error: errorMessage,
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  }
})
