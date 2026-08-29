import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'
import {parse, compileScript} from '@vue/compiler-sfc'
import {ModuleKind, ScriptTarget, transpileModule} from 'typescript'

const bridge = await readFile(new URL('../scripts/erp-approvals-bridge.gs', import.meta.url), 'utf8')
const deployedBridge = await readFile(new URL('../gas/approvals-bridge/Code.gs', import.meta.url), 'utf8')
const smoke = await readFile(new URL('../scripts/staging-approvals-auth-smoke.py', import.meta.url), 'utf8')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')
const index = await readFile(new URL('../public/api/index.php', import.meta.url), 'utf8')
const approvals = await readFile(new URL('../public/api/src/Approvals.php', import.meta.url), 'utf8')
const api = await readFile(new URL('../app/utils/erp-api.ts', import.meta.url), 'utf8')
const sheets = await readFile(new URL('../app/utils/erp-sheets.ts', import.meta.url), 'utf8')
const approvalsStore = await readFile(new URL('../store/erp-approvals.store.ts', import.meta.url), 'utf8').catch(() => '')

// Настоящая реализация errorMessage для VM-контекста стора (см. createApprovalsStore).
const errorMessageSource = await readFile(new URL('../app/utils/error-message.ts', import.meta.url), 'utf8')
const errorMessageModule = {exports: {}}
vm.runInNewContext(
  transpileModule(errorMessageSource, {
    compilerOptions: {module: ModuleKind.CommonJS, target: ScriptTarget.ES2022},
  }).outputText,
  {module: errorMessageModule, exports: errorMessageModule.exports, require: () => ({})},
)

async function createApprovalCardController() {
  const source = await readFile(new URL('../app/components/erp/ErpApprovalCard.vue', import.meta.url), 'utf8')
  const {descriptor} = parse(source)
  const compiled = compileScript(descriptor, {id: 'approvals-contract'})
  const runnable = compiled.content.replace(
    "import { defineComponent as _defineComponent } from 'vue'\n",
    'const _defineComponent = options => options\nconst ref = value => ({value})\nconst computed = getter => ({get value() { return getter() }})\n',
  )
  const output = transpileModule(runnable, {
    compilerOptions: {module: ModuleKind.ESNext, target: ScriptTarget.ES2022},
  }).outputText
  const component = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
  const events = []
  const handlers = component.default.setup({
    approval: {amount: 1},
    pending: false,
    finalStatus: null,
  }, {
    expose: () => {},
    emit: (...event) => events.push(event),
  })

  return {events, handlers}
}

async function createApprovalsStore(fetchQueue) {
  const source = await readFile(new URL('../store/erp-approvals.store.ts', import.meta.url), 'utf8')
  const output = transpileModule(source, {
    compilerOptions: {module: ModuleKind.CommonJS, target: ScriptTarget.ES2022},
  }).outputText
  const module = {exports: {}}
  const context = {
    module,
    exports: module.exports,
    require: (name) => {
      if (name === 'pinia') return {defineStore: (_id, options) => options}
      if (name === '~/utils/erp-sheets') return {fetchApprovals: fetchQueue}
      // Отдаём настоящую реализацию, а не заглушку: её результат попадает
      // в state.error, и подмена скрыла бы регрессию в разборе ошибки.
      if (name === '~/utils/error-message') return errorMessageModule.exports
      throw new Error(`Unexpected store dependency: ${name}`)
    },
  }
  vm.runInNewContext(output, context)

  const definition = module.exports.useErpApprovalsStore
  const store = {...definition.state()}
  for (const [name, action] of Object.entries(definition.actions)) {
    store[name] = action.bind(store)
  }
  return store
}

const approvalRow = (rowNumber, invoice = `INV-${rowNumber}`) => ({
  rowNumber,
  stage: 'manager',
  site: 'North',
  departmentType: 'Sales',
  invoice,
  amount: 100,
  invoiceUrl: `https://example.test/${rowNumber}`,
})

async function createApprovalsNotificationsController({refreshQueue, permission = 'granted', notificationsAvailable = true} = {}) {
  const source = await readFile(new URL('../app/composables/useErpApprovalsNotifications.ts', import.meta.url), 'utf8')
  const output = transpileModule(
    source
      .replace(/^import .+$/gm, '')
      .replace(/import\.meta\.client/g, 'true')
      .replace(/supportsWebPush\(\)/g, 'false')
      .replace(/registerErpPushSubscription\(\)/g, 'Promise.resolve(false)')
      .replace(/syncAppBadge\([^)]+\)/g, 'Promise.resolve()'),
    {
      compilerOptions: {module: ModuleKind.CommonJS, target: ScriptTarget.ES2022},
    },
  ).outputText

  const timers = new Map()
  const storage = new Map()
  const notifications = []
  let nextTimer = 1
  let permissionRequests = 0
  const NotificationMock = function (title, options) {
    notifications.push({title, options})
  }
  NotificationMock.permission = permission
  NotificationMock.requestPermission = async () => {
    permissionRequests += 1
    return NotificationMock.permission
  }

  const store = {
    rows: [],
    pendingCount: 0,
    loading: false,
    error: '',
    refresh: async () => {
      const rows = await refreshQueue(store)
      store.rows = rows
      store.pendingCount = rows.length
      return {rows, pendingCount: rows.length}
    },
  }

  const module = {exports: {}}
  const context = {
    module,
    exports: module.exports,
    useErpApprovalsStore: () => store,
    useErpEmployeeStore: () => ({hasFio: true, access: {approvals: true}}),
    require: (name) => {
      if (name === '~~/store/erp-approvals.store') return {useErpApprovalsStore: () => store}
      if (name === '~~/store/erp-employee.store') {
        return {useErpEmployeeStore: () => ({hasFio: true, access: {approvals: true}})}
      }
      if (name === '~/composables/useAppToast') return {useAppToast: () => ({showSuccess: () => undefined})}
      throw new Error(`Unexpected composable dependency: ${name}`)
    },
    ref: value => ({value}),
    computed: getter => ({get value() { return getter() }}),
    useAppToast: () => ({showSuccess: () => undefined}),
    getErpBackendMode: () => 'gas',
    erpApiRequest: async () => ({notifications: []}),
    window: {
      ...(notificationsAvailable ? {Notification: NotificationMock} : {}),
      setInterval: (callback, delay) => {
        const id = nextTimer++
        timers.set(id, {callback, delay})
        return id
      },
      clearInterval: id => timers.delete(id),
      location: {pathname: '/register'},
    },
    document: {
      visibilityState: 'visible',
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    sessionStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  }
  if (notificationsAvailable) context.Notification = NotificationMock

  vm.runInNewContext(output, context)
  context.module.exports.__resetApprovalsNotificationsForTests()

  return {
    exports: context.module.exports,
    notification: NotificationMock,
    notifications,
    timers,
    store,
    get permissionRequests() {
      return permissionRequests
    },
    start: async () => {
      context.module.exports.startErpApprovalsNotifications()
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise(resolve => setImmediate(resolve))
        if (!context.module.exports.__isPollInFlightForTests()) break
      }
    },
    stop: () => context.module.exports.stopErpApprovalsNotifications(),
    fireOnlyTimer: async () => {
      assert.equal(timers.size, 1)
      const {callback} = [...timers.values()][0]
      callback()
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise(resolve => setImmediate(resolve))
        if (!context.module.exports.__isPollInFlightForTests()) break
      }
    },
    get handlers() {
      return context.module.exports.useErpApprovalsNotifications()
    },
  }
}

test('approvals bridge sources require preconfigured private properties', () => {
  for (const source of [bridge, deployedBridge]) {
    assert.doesNotMatch(source, /setProperty\(\s*['"]APPROVALS_(?:SPREADSHEET_ID|BRIDGE_TOKEN)['"]/) 
    assert.doesNotMatch(source, /APPROVALS_SPREADSHEET_ID['"],\s*['"][A-Za-z0-9_-]{20,}['"]/) 
  }
})

test('approvals staging auth smoke requires injected QA credentials', () => {
  assert.match(smoke, /os\.environ\[['"]ERP_QA_LOGIN['"]\]/)
  assert.match(smoke, /os\.environ\[['"]ERP_QA_PASSWORD['"]\]/)
  assert.doesNotMatch(smoke, /os\.environ\.get\(\s*['"]ERP_QA_(?:LOGIN|PASSWORD)['"]\s*,/)
})

function createBridge(rows) {
  const writes = []
  const auditRows = []
  const source = {
    getDataRange: () => ({getDisplayValues: () => rows}),
    getRange: (row, column) => ({setValue: value => {
      writes.push({row, column, value})
      rows[row - 1][column - 1] = value
    }}),
    getParent: () => spreadsheet,
  }
  const audit = {
    getLastRow: () => auditRows.length,
    appendRow: row => auditRows.push(row),
  }
  const spreadsheet = {
    getSheetByName: name => name === 'Согласования' ? source : (name === 'ERP — журнал согласований' ? audit : null),
    insertSheet: () => audit,
  }
  const context = {
    PropertiesService: {getScriptProperties: () => ({getProperty: () => 'configured'})},
    SpreadsheetApp: {openById: () => spreadsheet},
    LockService: {getScriptLock: () => ({waitLock: () => {}, releaseLock: () => {}})},
    console: {warn: () => {}},
    ContentService: {MimeType: {JSON: 'application/json'}, createTextOutput: value => ({value, setMimeType: () => ({value})})},
  }
  vm.runInNewContext(`${bridge}\nthis.bridge = {approvalQueue_, approvalDecision_, doPost}`, context)
  return {bridge: context.bridge, writes, auditRows}
}

const headers = ['Площадка', 'Отдел', 'Тип', 'Счет', 'Сумма счета', 'Ссылка на счет', 'Согласование руководителя', 'Ожидает РО', 'Ожидает ГД', 'Дата РО', 'Дата ГД', 'Отмена']
const row = (site, department, type, invoice, amount, manager, pendingManager, pendingDirector, dateManager = '', dateDirector = '', cancelled = '') => [site, department, type, invoice, amount, 'https://example.test/invoice.pdf', manager, pendingManager, pendingDirector, dateManager, dateDirector, cancelled]

test('approvals bridge declares the protected source-sheet contract', () => {
  assert.match(bridge, /APPROVALS_SPREADSHEET_ID/)
  assert.match(bridge, /'Согласования'/)
  assert.doesNotMatch(bridge, /'Право согласования'/)
  assert.match(bridge, /'Согласование руководителя'/)
  assert.match(bridge, /'Ожидает РО'/)
  assert.match(bridge, /'Ожидает ГД'/)
  assert.match(bridge, /'Дата РО'/)
  assert.match(bridge, /'Дата ГД'/)
  assert.match(bridge, /'Отмена'/)
})

test('approvals bridge routes decisions and returns idempotent status', () => {
  assert.match(bridge, /function approvalDecision_\(/)
  assert.match(bridge, /action === 'approve'/)
  assert.match(bridge, /'Дата РО'/)
  assert.match(bridge, /'Дата ГД'/)
  assert.match(bridge, /'Отмена'/)
  assert.match(bridge, /already_processed/)
  assert.match(bridge, /replace\(\/\[\^\\d,.-\]\//)
  assert.ok(bridge.indexOf('const visible = approvalVisibleForActor_') < bridge.indexOf("return {status: 'already_processed'}"))
  assert.match(bridge, /payload\.decision/)
  assert.doesNotMatch(bridge, /payload\.approvalAction|payload\.actionType|payload\.intent/)
})

test('approvals queue filters actors, parses currency, and derives stage from actor', () => {
  const fixture = createBridge([headers, row('North', 'Sales', 'Goods', 'INV-1', '40 000,00 ₽', 'Иванов Иван', 'yes', ''), row('South', 'Ops', 'Service', 'INV-2', '12,50 ₽', 'Петров Петр', '', 'yes')])
  const manager = fixture.bridge.approvalQueue_('configured', {fio: '  Иванов   Иван ', position: 'Руководитель'})
  assert.equal(JSON.stringify(manager.map(item => item.invoice)), JSON.stringify(['INV-1']))
  assert.equal(manager[0].amount, 40000)
  assert.equal(manager[0].stage, 'manager')
  const director = fixture.bridge.approvalQueue_('configured', {fio: 'Петров Петр', position: ' генеральный директор '})
  assert.equal(JSON.stringify(director.map(item => item.invoice)), JSON.stringify(['INV-2']))
  assert.equal(director[0].stage, 'director')
})

test('approvals queue skips malformed rows without writing to the sheet', () => {
  const fixture = createBridge([headers, row('', 'Sales', 'Goods', 'INV-1', 'not money', 'Иванов Иван', 'yes', '')])
  const manager = fixture.bridge.approvalQueue_('configured', {fio: 'Иванов Иван', position: 'Руководитель'})
  assert.equal(manager.length, 0)
  assert.equal(fixture.auditRows.length, 0)
  assert.equal(fixture.writes.length, 0)
})

test('approvals decisions reject cross-action conflicts and repeat without a second write', () => {
  const conflict = createBridge([headers, row('North', 'Sales', 'Goods', 'INV-1', '10 ₽', 'Иванов Иван', 'yes', '', '2026-08-28', '')])
  assert.throws(() => conflict.bridge.approvalDecision_('configured', {fio: 'Иванов Иван', position: 'Руководитель'}, 2, 'reject'), /conflict/)
  assert.equal(conflict.writes.length, 0)

  const cancelled = createBridge([headers, row('North', 'Sales', 'Goods', 'INV-2', '10 ₽', 'Иванов Иван', 'yes', '', '', '', '2026-08-28')])
  assert.throws(() => cancelled.bridge.approvalDecision_('configured', {fio: 'Иванов Иван', position: 'Руководитель'}, 2, 'approve'), /conflict/)
  assert.equal(cancelled.writes.length, 0)

  const repeatRows = [headers, row('North', 'Sales', 'Goods', 'INV-1', '10 ₽', 'Иванов Иван', 'yes', '', '', '')]
  const repeat = createBridge(repeatRows)
  const actor = {fio: 'Иванов Иван', position: 'Руководитель'}
  assert.equal(repeat.bridge.approvalDecision_('configured', actor, 2, 'approve').status, 'approved')
  repeatRows[1][7] = ''
  repeat.bridge.approvalQueue_('configured', actor)
  repeat.bridge.approvalDecision_('configured', actor, 2, 'approve')
  assert.equal(repeat.writes.length, 1)
})

test('malformed but responsible rows cannot be decided', () => {
  const fixture = createBridge([headers, row('North', 'Sales', 'Goods', 'INV-1', 'not money', 'Иванов Иван', 'yes', '')])
  assert.throws(() => fixture.bridge.approvalDecision_('configured', {fio: 'Иванов Иван', position: 'Руководитель'}, 2, 'approve'), /malformed_row/)
  assert.equal(fixture.writes.length, 0)
})

test('doPost accepts only the canonical decide envelope', () => {
  const fixture = createBridge([headers, row('North', 'Sales', 'Goods', 'INV-1', '10 ₽', 'Иванов Иван', 'yes', '')])
  const response = fixture.bridge.doPost({postData: {contents: JSON.stringify({
    action: 'decide',
    decision: 'approve',
    rowNumber: 2,
    actor: {fio: 'Иванов Иван', position: 'Руководитель'},
    token: 'configured',
  })}})
  assert.deepEqual(JSON.parse(response.value), {ok: true, status: 'approved'})
  assert.equal(fixture.writes.length, 1)

  const invalid = fixture.bridge.doPost({postData: {contents: JSON.stringify({
    action: 'approve',
    rowNumber: 2,
    actor: {fio: 'Иванов Иван', position: 'Руководитель'},
    token: 'configured',
  })}})
  assert.deepEqual(JSON.parse(invalid.value), {ok: false, error: 'unknown_action'})
})

test('approvals SQL API exposes the authenticated queue and decision boundary', () => {
  assert.match(router, /GET.*\/approvals/)
  assert.match(router, /POST.*\/approvals\/decisions/)
  assert.match(router, /GET.*\/approvals\/notifications/)
  assert.match(router, /POST.*\/approvals\/notifications\/read/)
  assert.match(router, /POST.*\/internal\/approvals-notify-all/)
  assert.match(index, /approvals_current/)
  assert.match(index, /approvals_decide/)
  assert.match(approvals, /erp_require_user\(\$pdo, \$config, \$requestId\)/)
  assert.match(approvals, /erp_require_permission\(\$pdo, \$actor, 'approvals', \$requestId\)/)
  assert.match(api, /credentials: 'include'/)
  assert.match(api, /export interface ErpApproval/)
  assert.match(api, /fetchApprovalsViaApi/)
  assert.match(api, /decideApprovalViaApi/)
  assert.match(sheets, /fetchApprovals\(/)
  assert.match(sheets, /decideApproval\(/)
})

test('approvals client contract returns and stores the authoritative pending count', () => {
  assert.match(api, /export interface ErpApprovalsResponse\s*\{[\s\S]*?rows: ErpApproval\[\][\s\S]*?pendingCount: number/)
  assert.match(api, /fetchApprovalsViaApi\(\): Promise<ErpApprovalsResponse>/)
  assert.match(sheets, /fetchApprovals\(\): Promise<ErpApprovalsResponse>/)
  assert.match(approvalsStore, /defineStore\('erp-approvals'/)
  assert.match(approvalsStore, /pendingCount: 0/)
  assert.match(approvalsStore, /async load\(\)/)
  assert.match(approvalsStore, /async refresh\(\)/)
})

test('approvals store retains the last pending count when refresh is rejected', async () => {
  let rejectRefresh = false
  const store = await createApprovalsStore(async () => {
    if (rejectRefresh) throw new Error('temporary outage')
    return {
      rows: [
        {rowNumber: 2, stage: 'manager', site: 'North', departmentType: 'Sales', invoice: 'INV-1', amount: 100, invoiceUrl: 'https://example.test/1'},
        {rowNumber: 3, stage: 'director', site: 'South', departmentType: 'Ops', invoice: 'INV-2', amount: 200, invoiceUrl: 'https://example.test/2'},
      ],
      pendingCount: 2,
    }
  })

  await store.load()
  assert.equal(store.pendingCount, 2)
  assert.equal(store.rows.length, 2)

  rejectRefresh = true
  await assert.rejects(store.refresh(), /temporary outage/)

  assert.equal(store.pendingCount, 2)
  assert.equal(store.rows.length, 2)
  assert.notEqual(store.error, '')
  assert.equal(store.loading, false)
})

test('horizontal approval swipe suppresses its immediate trailing click', async () => {
  const {events, handlers} = await createApprovalCardController()

  handlers.startSwipe({clientX: 0, clientY: 0})
  handlers.finishSwipe({clientX: 80, clientY: 0})
  handlers.onOpen()

  assert.deepEqual(events, [['request-decision', 'approve']])
})

test('horizontal approval swipe expires suppression when no trailing click arrives', async () => {
  const {events, handlers} = await createApprovalCardController()

  handlers.startSwipe({clientX: 0, clientY: 0})
  handlers.finishSwipe({clientX: 80, clientY: 0})
  assert.deepEqual(events, [['request-decision', 'approve']])

  await new Promise(resolve => setTimeout(resolve, 0))
  handlers.onOpen()

  assert.deepEqual(events, [
    ['request-decision', 'approve'],
    ['open'],
  ])
})

test('approvals UI exposes card gestures, viewer, and queue actions', async () => {
  const card = await readFile(new URL('../app/components/erp/ErpApprovalCard.vue', import.meta.url), 'utf8')
  const viewer = await readFile(new URL('../app/components/erp/ErpInvoiceViewer.vue', import.meta.url), 'utf8')
  const page = await readFile(new URL('../app/pages/approvals.vue', import.meta.url), 'utf8')

  assert.match(card, /Площадка/)
  assert.match(card, /Согласовать/)
  assert.match(card, /Отклонить/)
  assert.match(card, /pointerdown/)
  assert.match(card, /pointerup/)
  assert.match(card, /const suppressNextOpen = ref\(false\)/)
  assert.match(card, /@pointerdown\.stop/)
  assert.match(card, /@pointerup\.stop/)
  assert.match(card, /<div\s+v-if="!isFinal"\s+class="erp-approval-card__actions"\s+@click\.stop\s+@pointerdown\.stop\s+@pointerup\.stop/)
  assert.match(card, /event\.target instanceof Element && event\.target\.closest\('\.erp-approval-card__actions'\)/)
  assert.match(card, /suppressNextOpen\.value = true/)
  assert.match(card, /if \(suppressNextOpen\.value\) \{\s*suppressNextOpen\.value = false[\s\S]*?return\s*\}/)
  assert.match(viewer, /iframe/)
  assert.match(viewer, /Открыть счёт/)
  assert.match(page, /useErpApprovalsStore/)
  assert.match(page, /decideApproval/)
})

test('approvals UI shares its pending count and only notifies after an explicit opt-in', async () => {
  const page = await readFile(new URL('../app/pages/approvals.vue', import.meta.url), 'utf8')
  const composable = await readFile(new URL('../app/composables/useErpApprovalsNotifications.ts', import.meta.url), 'utf8')
  const plugin = await readFile(new URL('../app/plugins/erp-approvals-watch.client.ts', import.meta.url), 'utf8')
  const layout = await readFile(new URL('../app/layouts/erp.vue', import.meta.url), 'utf8')
  const banner = await readFile(new URL('../app/components/erp/ErpTransientBanner.vue', import.meta.url), 'utf8')
  const profile = await readFile(new URL('../app/pages/register.vue', import.meta.url), 'utf8')
  const tabbar = await readFile(new URL('../app/components/erp/ErpTabBar.vue', import.meta.url), 'utf8')

  assert.match(page, /useErpApprovalsStore/)
  assert.match(page, /useErpApprovalsNotifications/)
  assert.doesNotMatch(page, /fetchApprovals/)
  assert.match(profile, /useErpApprovalsStore/)
  assert.match(profile, /count:\s*a\.approvals\s*&&\s*approvalsStore\.pendingCount\s*>\s*0\s*\?\s*approvalsStore\.pendingCount\s*:\s*null/)
  assert.match(profile, /:count="m\.count"/)
  assert.match(tabbar, /useErpApprovalsStore/)
  assert.match(tabbar, /v-if="access\.approvals\s*&&\s*approvalsStore\.pendingCount\s*>\s*0"/)
  assert.match(plugin, /startErpApprovalsNotifications/)
  assert.match(plugin, /stopErpApprovalsNotifications/)

  assert.match(page, />\s*Включить уведомления\s*</)
  assert.match(composable, /Notification\.requestPermission\(\)/)
  assert.match(composable, /POLL_INTERVAL_MS\s*=\s*15_000/)
  assert.match(composable, /setInterval\([^,]+,\s*POLL_INTERVAL_MS\)/)
  assert.match(composable, /Notification\.permission\s*===\s*'granted'/)
  assert.match(composable, /new Set<number>\(\)/)
  // ERP must use its own visible in-app banner while open. Browser-level
  // Notification() produces an unreadable blank card in some iOS shells;
  // background delivery belongs to the service worker instead.
  assert.doesNotMatch(composable, /new Notification\(/)
  assert.match(layout, /useErpApprovalsNotifications/)
  assert.match(layout, /ErpTransientBanner/)
  assert.match(layout, /inAppNotification/)
  assert.match(layout, /clearInAppNotification/)
  assert.match(banner, /\{immediate: true\}/)
  assert.match(composable, /visibilitychange/)
  assert.match(composable, /registerErpPushSubscription/)
  assert.match(composable, /supportsWebPush/)
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  const pushUtil = await readFile(new URL('../app/utils/erp-push.ts', import.meta.url), 'utf8')
  assert.match(sw, /addEventListener\('push'/)
  assert.match(sw, /notificationclick/)
  assert.match(pushUtil, /push\/subscribe/)
  assert.match(composable, /syncAppBadge/)
  assert.match(sw, /setAppBadge/)
  assert.match(sw, /badgeCount/)
  assert.match(pushUtil, /push\/vapid-key/)
})

test('approvals notifications stop when the watcher is torn down', async () => {
  const controller = await createApprovalsNotificationsController({
    refreshQueue: async () => [approvalRow(2)],
  })

  await controller.start()
  controller.stop()

  assert.equal(controller.timers.size, 0)
})

test('approvals notifications show a visible ERP banner after an initial load failure', async () => {
  let refreshAttempt = 0
  const controller = await createApprovalsNotificationsController({
    refreshQueue: async () => {
      refreshAttempt += 1
      if (refreshAttempt === 1) throw new Error('temporary outage')
      return refreshAttempt === 2 ? [approvalRow(2)] : [approvalRow(2), approvalRow(3)]
    },
  })

  await controller.start()
  await controller.fireOnlyTimer()

  assert.equal(controller.notifications.length, 0)

  await controller.fireOnlyTimer()

  assert.equal(controller.notifications.length, 0)
  assert.match(controller.handlers.inAppNotification.value, /INV-3/)
})

test('approvals notifications show an unread initial queue inside ERP without firing a native notification', async () => {
  const controller = await createApprovalsNotificationsController({
    refreshQueue: async () => [approvalRow(2)],
  })

  await controller.start()

  assert.equal(controller.notifications.length, 0)
  assert.match(controller.handlers.inAppNotification.value, /INV-2/)
})

test('approval notification permission is requested only by explicit action and denied permission explains itself', async () => {
  const controller = await createApprovalsNotificationsController({
    permission: 'default',
    refreshQueue: async () => [approvalRow(2)],
  })

  await controller.start()
  assert.equal(controller.permissionRequests, 0)

  controller.notification.permission = 'denied'
  await controller.handlers.enableNotifications()
  await controller.handlers.enableNotifications()

  assert.equal(controller.permissionRequests, 1)
  assert.equal(controller.handlers.notificationPermission.value, 'denied')
  assert.match(controller.handlers.notificationStatus.value, /запрещены/)
})

test('approval queue keeps polling globally and announces a new invoice inside ERP without native notifications', async () => {
  let refreshAttempt = 0
  const controller = await createApprovalsNotificationsController({
    notificationsAvailable: false,
    refreshQueue: async () => {
      refreshAttempt += 1
      return refreshAttempt === 1 ? [approvalRow(2)] : [approvalRow(2), approvalRow(3)]
    },
  })

  await controller.start()
  await controller.fireOnlyTimer()

  assert.equal(controller.timers.size, 1)
  assert.match(controller.handlers.inAppNotification.value, /INV-3/)
  assert.match(controller.handlers.notificationStatus.value, /внутри ERP/)
})
