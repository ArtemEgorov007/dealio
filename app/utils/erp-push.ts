import {erpApiRequest} from '~/utils/erp-api'

const SW_URL = '/sw.js'

export interface ErpPushSubscriptionPayload {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export function supportsErpServiceWorker(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator
}

export function supportsWebPush(): boolean {
  return supportsErpServiceWorker() && 'PushManager' in window
}

export async function registerErpServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!supportsErpServiceWorker()) return null
  return navigator.serviceWorker.register(SW_URL, {scope: '/'})
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }
  return output
}

export async function fetchPushVapidPublicKey(): Promise<string> {
  const data = await erpApiRequest<{publicKey: string}>('push/vapid-key')
  return data.publicKey
}

export async function subscribePushOnServer(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Invalid push subscription')
  }
  await erpApiRequest<{subscribed: boolean}>('push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
    }),
  })
}

export async function registerErpPushSubscription(): Promise<boolean> {
  if (!supportsWebPush()) return false
  if (Notification.permission !== 'granted') return false

  const registration = await registerErpServiceWorker()
  if (!registration) return false
  await navigator.serviceWorker.ready

  const publicKey = await fetchPushVapidPublicKey()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  await subscribePushOnServer(subscription)
  return true
}

export async function unregisterErpPushSubscription(): Promise<void> {
  if (!supportsWebPush()) return
  const registration = await navigator.serviceWorker.getRegistration(SW_URL)
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe().catch(() => undefined)
  await erpApiRequest<{subscribed: boolean}>('push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({endpoint}),
  }).catch(() => undefined)
}
