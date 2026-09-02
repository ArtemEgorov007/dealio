// Bump this value for each release that must replace an already-open iOS PWA
// shell. Hashed assets are normally enough, but an installed Safari web app can
// resume a stale document without asking the server for a new entry page.
const ERP_RELEASE_ID = 'staging-pwa-refresh-v1-20260829'
const ERP_SAFE_REFRESH_PATHS = new Set(['/reports', '/reports/', '/approvals', '/approvals/'])

const refreshSafeOpenScreens = async () => {
  const clients = await self.clients.matchAll({type: 'window', includeUncontrolled: true})

  await Promise.all(clients.map((client) => {
    const url = new URL(client.url)
    if (!ERP_SAFE_REFRESH_PATHS.has(url.pathname) || url.searchParams.get('erp-release') === ERP_RELEASE_ID) {
      return undefined
    }

    url.searchParams.set('erp-release', ERP_RELEASE_ID)
    return client.navigate(url.toString())
  }))
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim()
    await refreshSafeOpenScreens()
  })())
})

function showPushNotification(payload) {
  const tasks = [
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag || 'erp-approval',
      data: {url: payload.url || '/approvals', badgeCount: payload.badgeCount || 1},
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    }),
  ]

  // Badging API живёт на navigator, а не на ServiceWorkerRegistration.
  // Проверка стояла на self.registration, где такого метода нет вовсе:
  // она всегда была ложной, и значок непрочитанного не ставился ни разу —
  // ни на одном пуше, ни на одном устройстве. Своя утилита приложения
  // (app/utils/erp-app-badge.ts) с самого начала обращалась к navigator.
  if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
    const badgeCount = Number(payload.badgeCount) || 1
    // Значок — дополнение к уведомлению, а не его условие: если Badging
    // недоступен или откажет, уведомление всё равно должно показаться.
    tasks.push(navigator.setAppBadge(badgeCount).catch(() => undefined))
  }

  return Promise.all(tasks)
}

// Подтверждение показа. «Принято push-сервисом» и «показано человеку» — разные
// события: Apple и FCM отвечают успехом и для устройства, где уведомления
// потом выключили. Без этого отстука отправитель не знает, дошло ли, и
// остаётся только гадать.
//
// Отстукиваем ПОСЛЕ showNotification и не даём отказу сети что-либо сломать:
// неподтверждённая доставка — это неполный отчёт, а упавший обработчик push
// на iOS ведёт к отзыву подписки, то есть к молчанию навсегда.
function confirmDelivery(token) {
  if (!token) return Promise.resolve()

  return fetch('/api/push/delivered', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({deliveryToken: token}),
    // Токен сам себе право, но подтверждение вошедшего пусть остаётся
    // подтверждением вошедшего — cookie отправляем, если она есть.
    credentials: 'include',
    keepalive: true,
  }).catch(() => undefined)
}

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Новое согласование',
    body: 'Откройте ERP, чтобы посмотреть счёт',
    url: '/approvals',
    tag: 'erp-approval',
    badgeCount: 1,
  }

  if (event.data) {
    try {
      payload = {...payload, ...event.data.json()}
    } catch {
      payload.body = event.data.text() || payload.body
    }
  }

  event.waitUntil(
    showPushNotification(payload).then(() => confirmDelivery(payload.deliveryToken)),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/approvals'
  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if (client.url.includes(target)) {
            return client.focus()
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target)
      }
      return undefined
    }),
  )
})
