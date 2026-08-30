import {useErpApprovalsStore} from '~~/store/erp-approvals.store'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {erpApiRequest, getErpBackendMode} from '~/utils/erp-api'
import {registerErpPushSubscription, supportsWebPush} from '~/utils/erp-push'
import {syncAppBadge} from '~/utils/erp-app-badge'

const NOTIFIED_APPROVAL_ROWS_KEY = 'erp-approval-notification-row-numbers'
const POLL_INTERVAL_MS = 15_000

const seenRowNumbers = new Set<number>()
let pollingTimer: ReturnType<typeof window.setInterval> | null = null
let visibilityListenerAttached = false
let watchersStarted = false
let initialQueueLoaded = false
let pollInFlight = false

const notificationPermission = ref<NotificationPermission>('default')
const notificationsSupported = ref(false)
const inAppNotification = ref('')

const pushSupported = ref(false)
const pushSubscribed = ref(false)

const supportsNotifications = () => typeof window !== 'undefined' && 'Notification' in window
const hasNotificationPermission = () => supportsNotifications() && Notification.permission === 'granted'

const pushStatusToastMessage = ref('')

export const queuePushStatusToast = (message?: string) => {
  if (!import.meta.client) return
  pushStatusToastMessage.value = message || 'Push включён — новые счета придут даже при закрытом ERP.'
}

export const clearPushStatusToast = () => {
  pushStatusToastMessage.value = ''
}

export const clearInAppNotification = () => {
  inAppNotification.value = ''
}

export const canEnableApprovalsNotifications = computed(() =>
  (notificationsSupported.value || pushSupported.value) && notificationPermission.value === 'default',
)

export const approvalsNotificationStatus = computed(() => {
  if (pushSubscribed.value) {
    return 'Push включён — новые счета придут даже при закрытом ERP.'
  }
  if (pushSupported.value && notificationPermission.value === 'granted') {
    return 'Разрешение получено. Подписка на push обновляется…'
  }
  if (!notificationsSupported.value && !pushSupported.value) {
    return 'Новые счета будут показаны внутри ERP. Для системных уведомлений добавьте ERP на главный экран.'
  }
  if (notificationPermission.value === 'denied') return 'Уведомления запрещены в настройках браузера'
  return ''
})

const saveSeenRowNumbers = () => {
  try {
    sessionStorage.setItem(NOTIFIED_APPROVAL_ROWS_KEY, JSON.stringify([...seenRowNumbers]))
  } catch {
    // Storage may be unavailable; in-memory tracking still prevents duplicate notifications.
  }
}

const restoreSeenRowNumbers = () => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(NOTIFIED_APPROVAL_ROWS_KEY) ?? '[]')
    if (Array.isArray(stored)) {
      for (const rowNumber of stored) {
        if (Number.isInteger(rowNumber)) seenRowNumbers.add(rowNumber)
      }
    }
  } catch {
    // Malformed storage must not block the queue.
  }
}

const syncNotificationSupport = () => {
  notificationsSupported.value = supportsNotifications()
  pushSupported.value = supportsWebPush()
  if (notificationsSupported.value) {
    notificationPermission.value = Notification.permission
  }
}

const announceInApp = (invoice: string) => {
  if (!import.meta.client) return
  // Keep feedback inside the ERP shell while it is open. Some iOS browser
  // shells render page-created Notification() cards without readable content;
  // native background push is delivered only through the service worker.
  inAppNotification.value = `Новый счёт на согласование: ${invoice}`
}

const rememberInitialQueue = (rowNumbers: number[], invoices: string[]) => {
  const unreadRowNumbers = rowNumbers.filter(rowNumber => !seenRowNumbers.has(rowNumber))
  const latestUnreadIndex = unreadRowNumbers.at(-1)
  if (latestUnreadIndex !== undefined) {
    const index = rowNumbers.indexOf(latestUnreadIndex)
    const invoice = invoices[index]
    if (invoice) announceInApp(invoice)
  }

  for (const rowNumber of rowNumbers) seenRowNumbers.add(rowNumber)
  saveSeenRowNumbers()
  initialQueueLoaded = true
}

const notifyNewApprovals = (rows: Array<{rowNumber: number; invoice: string}>) => {
  if (!initialQueueLoaded) return

  for (const approval of rows) {
    if (seenRowNumbers.has(approval.rowNumber)) continue

    seenRowNumbers.add(approval.rowNumber)
    saveSeenRowNumbers()
    announceInApp(approval.invoice)

  }
}

const pollServerNotifications = async () => {
  if (getErpBackendMode() !== 'sql') return

  try {
    const data = await erpApiRequest<{notifications: Array<{rowNumber: number; invoice: string}>}>('approvals/notifications')
    const unread = data.notifications ?? []
    const fresh = unread.filter(note => !seenRowNumbers.has(note.rowNumber))
    if (fresh.length === 0) return

    const actionable = fresh.filter(note => !note.invoice.startsWith('ERP-BROADCAST-'))
    if (actionable.length === 0) return

    if (!initialQueueLoaded) {
      const latest = actionable.at(-1)
      if (latest) announceInApp(latest.invoice)
    } else {
      notifyNewApprovals(actionable)
    }

    for (const note of actionable) seenRowNumbers.add(note.rowNumber)
    saveSeenRowNumbers()

    await erpApiRequest<{marked: number}>('approvals/notifications/read', {
      method: 'POST',
      body: JSON.stringify({rowNumbers: actionable.map(note => note.rowNumber)}),
    })
  } catch {
    // Server inbox failures must not affect queue polling.
  }
}

const pollQueue = async () => {
  if (pollInFlight) return
  pollInFlight = true

  const employeeStore = useErpEmployeeStore()
  const approvalsStore = useErpApprovalsStore()

  if (!employeeStore.hasFio || !employeeStore.access.approvals) {
    pollInFlight = false
    return
  }

  try {
    await pollServerNotifications()
    await approvalsStore.refresh()
    const rows = approvalsStore.rows.map(row => ({rowNumber: row.rowNumber, invoice: row.invoice}))
    void syncAppBadge(approvalsStore.pendingCount)

    if (!initialQueueLoaded) {
      rememberInitialQueue(rows.map(row => row.rowNumber), rows.map(row => row.invoice))
    } else {
      notifyNewApprovals(rows)
    }
  } catch {
    // Queue reload failures retain the last known count in the store.
  } finally {
    pollInFlight = false
  }
}

const onVisibilityChange = () => {
  if (document.visibilityState === 'visible') void pollQueue()
}

const attachVisibilityListener = () => {
  if (visibilityListenerAttached || typeof document === 'undefined') return
  document.addEventListener('visibilitychange', onVisibilityChange)
  visibilityListenerAttached = true
}

const detachVisibilityListener = () => {
  if (!visibilityListenerAttached || typeof document === 'undefined') return
  document.removeEventListener('visibilitychange', onVisibilityChange)
  visibilityListenerAttached = false
}

export const startErpApprovalsNotifications = () => {
  if (watchersStarted || typeof window === 'undefined') return

  const employeeStore = useErpEmployeeStore()
  if (!employeeStore.hasFio || !employeeStore.access.approvals) return

  watchersStarted = true
  restoreSeenRowNumbers()
  syncNotificationSupport()
  attachVisibilityListener()

  if (pollingTimer === null) {
    pollingTimer = window.setInterval(() => void pollQueue(), POLL_INTERVAL_MS)
  }

  void pollQueue()
  if (hasNotificationPermission() && pushSupported.value && !pushSubscribed.value) {
    void registerErpPushSubscription()
      .then(subscribed => {
        pushSubscribed.value = subscribed
      })
      .catch(() => undefined)
  }
}

export const stopErpApprovalsNotifications = () => {
  watchersStarted = false
  detachVisibilityListener()

  if (pollingTimer !== null) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
}

export const enableApprovalsNotifications = async () => {
  if (!canEnableApprovalsNotifications.value && notificationPermission.value !== 'granted') return

  try {
    if (notificationPermission.value !== 'granted') {
      notificationPermission.value = await Notification.requestPermission()
    }
    syncNotificationSupport()

    if (notificationPermission.value === 'granted' && pushSupported.value) {
      pushSubscribed.value = await registerErpPushSubscription()
      if (pushSubscribed.value) {
        inAppNotification.value = 'Push включён. Новые счета придут даже при закрытом ERP.'
      }
    }
  } catch {
    // Permission or push errors must not affect the queue.
  }
}

export function useErpApprovalsNotifications() {
  return {
    inAppNotification,
    notificationPermission,
    notificationsSupported,
    pushSupported,
    pushSubscribed,
    pushStatusToastMessage,
    canEnableNotifications: canEnableApprovalsNotifications,
    notificationStatus: approvalsNotificationStatus,
    queuePushStatusToast,
    clearPushStatusToast,
    clearInAppNotification,
    enableNotifications: enableApprovalsNotifications,
    startWatching: startErpApprovalsNotifications,
    stopWatching: stopErpApprovalsNotifications,
  }
}

export const __resetApprovalsNotificationsForTests = () => {
  seenRowNumbers.clear()
  initialQueueLoaded = false
  pollInFlight = false
  watchersStarted = false
  inAppNotification.value = ''
  notificationPermission.value = 'default'
  notificationsSupported.value = false
  pushSubscribed.value = false
  pushStatusToastMessage.value = ''
  stopErpApprovalsNotifications()
}

export const __isPollInFlightForTests = () => pollInFlight
