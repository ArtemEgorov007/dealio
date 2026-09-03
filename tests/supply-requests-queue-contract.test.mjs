import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const php = await readFile(new URL('../public/api/src/SupplyWork.php', import.meta.url), 'utf8')
const supplyPhp = await readFile(new URL('../public/api/src/Supply.php', import.meta.url), 'utf8')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')
const indexPhp = await readFile(new URL('../public/api/index.php', import.meta.url), 'utf8')
const middleware = await readFile(new URL('../app/middleware/erp-flow.global.ts', import.meta.url), 'utf8')
const sections = await readFile(new URL('../app/utils/erp-sections.ts', import.meta.url), 'utf8')
const hubPage = await readFile(new URL('../app/pages/supply-work.vue', import.meta.url), 'utf8')
const queuePage = await readFile(new URL('../app/pages/supply-requests-queue.vue', import.meta.url), 'utf8')
const api = await readFile(new URL('../app/utils/erp-supply.ts', import.meta.url), 'utf8')
const store = await readFile(new URL('../store/erp-supply-queue.store.ts', import.meta.url), 'utf8')
const watcher = await readFile(new URL('../app/composables/useErpSupplyQueueWatcher.ts', import.meta.url), 'utf8')
const plugin = await readFile(new URL('../app/plugins/erp-supply-queue-watch.client.ts', import.meta.url), 'utf8')
const tabbar = await readFile(new URL('../app/components/erp/ErpTabBar.vue', import.meta.url), 'utf8')
const profile = await readFile(new URL('../app/pages/register.vue', import.meta.url), 'utf8')

test('раздел переименован в «Заявки и счета»', () => {
    // ТЗ: «Работа со снабжением» → «Заявки и счета».
    assert.match(sections, /key: 'supply',[\s\S]*?label: 'Заявки и счета'/)
    assert.doesNotMatch(sections, /label: 'Работа со снабжением'/)
    assert.match(hubPage, /title="Заявки и счета"/)
})

test('маршрут подраздела «Заявки» объявлен в реестре, миддлваре и роутере', () => {
    assert.match(sections, /routes: \['\/supply-work', '\/invoice-new', '\/invoices', '\/supply-catalog', '\/supply-requests-queue'\]/)
    assert.match(middleware, /'\/supply-requests-queue',/)
    assert.match(middleware, /'\/supply-requests-queue': 'supply'/)
    assert.match(router, /\$path === '\/supply-work\/requests-queue'/)
    assert.match(indexPhp, /erp_supply_work_requests_queue\(\$pdo, \$config, \$requestId\)/)
})

test('ручка очереди закрыта правом supply и ничего не пишет', () => {
    const start = php.indexOf('function erp_supply_work_requests_queue')
    const body = php.slice(start, php.indexOf('\n}\n', start) + 3)
    assert.match(body, /erp_require_permission\(\$pdo, \$actor, 'supply', \$requestId\)/)
    // Граница ТЗ («не входит: изменения в процедуре заявок») держится тем,
    // что ручка — чистое чтение.
    assert.doesNotMatch(body, /INSERT INTO|UPDATE |DELETE FROM|beginTransaction/)
})

test('список ограничен: очередь не растёт бессрочно под 15-секундным поллингом', () => {
    assert.match(php, /GROUP BY r\.request_code\s*\n\s*ORDER BY MAX\(r\.id\) DESC\s*\n\s*LIMIT 200/)
})

test('текущий статус читается из последнего счёта заявки, а не из самой заявки', () => {
    // erp_supply_requests.status обновляется один раз при заведении счёта и
    // дальше не меняется вместе с erp_approvals.status — короткий JOIN по
    // request_code единственный источник актуального статуса.
    assert.match(php, /LEFT JOIN erp_approvals a ON a\.id = \(/)
    assert.match(php, /WHERE a2\.request_code = r\.request_code/)
    assert.match(php, /ORDER BY a2\.id DESC/)
})

test('легаси-заявка без связки со счётом бакетится по своему статусу, а не тонет в «новых»', () => {
    // scripts/sql-import-warehouse.php пишет реальный исторический статус
    // прямо в erp_supply_requests.status, но request_code в erp_approvals не
    // проставляет (колонка добавлена позже самого импорта) — такая строка не
    // находится через JOIN. Без запасного чтения r.status уже согласованная
    // историческая заявка навсегда осела бы в «Новых».
    assert.match(php, /MIN\(r\.status\) AS request_status/)
    assert.match(php, /erp_supply_work_queue_bucket\(\$approvalStatus \?\? \$requestStatus\)/)
})

test('ровно 4 бакета из ТЗ, отклонённый и незаведённый счёт — оба «новые»', () => {
    assert.match(php, /function erp_supply_work_queue_bucket\(\?string \$approvalStatus\): string/)
    assert.match(php, /ERP_INVOICE_STATUS_NEW => 'awaiting_ro'/)
    assert.match(php, /ERP_INVOICE_STATUS_PENDING_GD => 'awaiting_gd'/)
    assert.match(php, /ERP_INVOICE_STATUS_APPROVED => 'approved'/)
    assert.match(php, /default => 'new'/)
    // ERP_INVOICE_STATUS_REJECTED не упомянут отдельной веткой — обязан
    // попадать в default вместе с «счёт ещё не заведён» (approvalStatus === null).
    assert.doesNotMatch(php, /ERP_INVOICE_STATUS_REJECTED =>/)
})

test('уведомление инженеру ведёт в подраздел «Заявки», а не на форму заказа', () => {
    // Раньше вело на /supply — экран формы заказа под правом orders, которого
    // у снабженца обычно нет: тап приводил к редиректу в middleware.
    assert.match(supplyPhp, /erp_push_send_to_users\(\$pdo, \$config, \$engineers, 'Новая заявка на снабжение', "\{\$requestCode\} — \{\$authorFio\}", '\/supply-requests-queue'\)/)
})

test('клиентский тип очереди и фетчер объявлены', () => {
    assert.match(api, /export type ErpSupplyQueueStatus = 'new' \| 'awaiting_ro' \| 'awaiting_gd' \| 'approved'/)
    assert.match(api, /export async function fetchSupplyRequestsQueue\(\): Promise<ErpSupplyQueueRequest\[\]>/)
    assert.match(api, /erpApiRequest<\{requests: ErpSupplyQueueRequest\[\]\}>\('supply-work\/requests-queue'\)/)
})

test('стор очереди считает бейдж по бакету «new»', () => {
    assert.match(store, /defineStore\('erp-supply-queue'/)
    assert.match(store, /newCount: \(state\): number => state\.rows\.filter\(row => row\.queueStatus === 'new'\)\.length/)
    assert.match(store, /async load\(\)/)
    assert.match(store, /async refresh\(\)/)
})

test('вотчер очереди работает только у держателей supply и переживает уход со страницы', () => {
    assert.match(watcher, /employeeStore\.access\.supply/)
    assert.match(watcher, /POLL_INTERVAL_MS = 15_000/)
    assert.match(plugin, /startErpSupplyQueueWatcher/)
    assert.match(plugin, /stopErpSupplyQueueWatcher/)
    assert.match(plugin, /employeeStore\.access\.supply/)
})

test('бейдж раздела снабжения виден в таб-баре и на плитках профиля', () => {
    assert.match(tabbar, /useErpSupplyQueueStore/)
    assert.match(tabbar, /key === 'supply' && employeeStore\.access\.supply && supplyQueueStore\.newCount > 0/)
    assert.match(profile, /useErpSupplyQueueStore/)
    assert.match(profile, /section\.key === 'supply' && supplyQueueStore\.newCount > 0/)
    // Существующий счётчик согласований не тронут — тест approvals-contract
    // уже проверяет его литерально, здесь только подтверждаем, что он рядом.
    assert.match(tabbar, /key === 'approvals' && employeeStore\.access\.approvals && approvalsStore\.pendingCount > 0/)
})

test('на плитке «Заявки» в хабе виден тот же бейдж', () => {
    assert.match(hubPage, /useErpSupplyQueueStore/)
    assert.match(hubPage, /to: '\/supply-requests-queue'/)
    assert.match(hubPage, /count: supplyQueueStore\.newCount > 0 \? supplyQueueStore\.newCount : null/)
    assert.match(hubPage, /:count="action\.count"/)
})

test('подраздел «Заявки» показывает ровно 4 таба из ТЗ в порядке цикла согласования', () => {
    assert.match(queuePage, /\{key: 'new', label: 'Новые'\}/)
    assert.match(queuePage, /\{key: 'awaiting_ro', label: 'Ожидают РО'\}/)
    assert.match(queuePage, /\{key: 'awaiting_gd', label: 'Ожидают ГД'\}/)
    assert.match(queuePage, /\{key: 'approved', label: 'Согласованные'\}/)
    // Экран не даёт взаимодействовать с заявкой — только читает и переключает
    // таб; никакого POST/PATCH к серверу с этой страницы не уходит.
    assert.doesNotMatch(queuePage, /method: 'POST'|method: 'DELETE'|erpApiRequest\(/)
})

test('заявки в списке фильтруются активным табом, а не показываются все разом', () => {
    assert.match(queuePage, /queueStore\.rows\.filter\(row => row\.queueStatus === activeTab\.value\)/)
})
