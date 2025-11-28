// Service Worker для Web Push Notifications
const CACHE_NAME = 'chestno-v1'
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY' // Замените на реальный ключ из env

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Работаем Честно!'
  const options = {
    body: data.body || 'У вас новое уведомление',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.id || 'notification',
    data: data,
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/notifications'

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i]
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

