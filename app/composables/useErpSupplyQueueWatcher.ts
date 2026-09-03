import {useErpSupplyQueueStore} from '~~/store/erp-supply-queue.store'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'

// Пуш о новой заявке инженеру снабжения уже шлёт сервер (erp_supply_notify_engineers)
// сразу при создании — эта отдельная сущность не про доставку уведомления, а
// только про то, чтобы бейдж раздела оставался свежим, пока приложение открыто.
// Тот же приём и тот же интервал, что у useErpApprovalsNotifications.
const POLL_INTERVAL_MS = 15_000

let pollingTimer: ReturnType<typeof window.setInterval> | null = null
let visibilityListenerAttached = false
let watchersStarted = false
let pollInFlight = false

const pollQueue = async () => {
  if (pollInFlight) return
  pollInFlight = true

  const employeeStore = useErpEmployeeStore()
  const queueStore = useErpSupplyQueueStore()

  if (!employeeStore.hasFio || !employeeStore.access.supply) {
    pollInFlight = false
    return
  }

  try {
    await queueStore.refresh()
  } catch {
    // Сбой перезагрузки очереди сохраняет последний известный счётчик.
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

export const startErpSupplyQueueWatcher = () => {
  if (watchersStarted || typeof window === 'undefined') return

  const employeeStore = useErpEmployeeStore()
  if (!employeeStore.hasFio || !employeeStore.access.supply) return

  watchersStarted = true
  attachVisibilityListener()

  if (pollingTimer === null) {
    pollingTimer = window.setInterval(() => void pollQueue(), POLL_INTERVAL_MS)
  }

  void pollQueue()
}

export const stopErpSupplyQueueWatcher = () => {
  watchersStarted = false
  detachVisibilityListener()

  if (pollingTimer !== null) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
}

export const __isSupplyQueuePollInFlightForTests = () => pollInFlight

export const __resetSupplyQueueWatcherForTests = () => {
  pollInFlight = false
  watchersStarted = false
  stopErpSupplyQueueWatcher()
}
