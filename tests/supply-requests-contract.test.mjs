import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../public/api/migrations/009_erp_supply_multiline.sql', import.meta.url), 'utf8')
const supplyPhp = await readFile(new URL('../public/api/src/Supply.php', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/supply.vue', import.meta.url), 'utf8')
const requestsPage = await readFile(new URL('../app/pages/supply-requests.vue', import.meta.url), 'utf8')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')
const middleware = await readFile(new URL('../app/middleware/erp-flow.global.ts', import.meta.url), 'utf8')

test('одна заявка может содержать несколько позиций', () => {
    // ТЗ: сколько строк создал сотрудник — столько строк в таблице, но код
    // заявки у них общий. UNIQUE на request_code это запрещал.
    assert.match(migration, /DROP INDEX erp_supply_requests_code_unique/i)
    assert.match(migration, /ADD KEY erp_supply_requests_code_idx \(request_code\)/i)
})

test('номер заявки выдаётся атомарным счётчиком, а не MAX+1', () => {
    // Два сотрудника одной площадки, нажавшие «Заказать» одновременно,
    // прочитали бы одинаковый максимум и получили один номер.
    assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_supply_request_counters/i)
    assert.match(supplyPhp, /INSERT INTO erp_supply_request_counters[\s\S]*ON DUPLICATE KEY UPDATE last_seq = last_seq \+ 1/i)
    assert.doesNotMatch(supplyPhp, /MAX\(\s*CAST/i, 'номер не должен вычисляться максимумом при создании заявки')
})

test('счётчик переносит уже существующие номера', () => {
    // Иначе первая заявка после импорта получила бы номер 1 и столкнулась
    // с уже существующей «Колпино-1».
    assert.match(migration, /INSERT INTO erp_supply_request_counters[\s\S]*SELECT platform, MAX/i)
    assert.match(migration, /GREATEST\(last_seq, VALUES\(last_seq\)\)/i)
})

test('код заявки склеивает площадку и номер', () => {
    assert.match(supplyPhp, /\$platform \. '-' \./)
})

test('заявка создаётся с полями из ТЗ', () => {
    assert.match(supplyPhp, /ERP_SUPPLY_STATUS_NEW = 'Ожидает счёт'/)
    assert.match(supplyPhp, /INSERT INTO erp_supply_requests/i)
    for (const column of ['request_code', 'requested_at', 'platform', 'employee_fio', 'department', 'item_name', 'quantity', 'category', 'status']) {
        assert.match(supplyPhp, new RegExp(column), `в INSERT нет колонки ${column}`)
    }
})

test('согласующий, дата и счёт при создании пустые', () => {
    const insert = supplyPhp.slice(supplyPhp.indexOf('INSERT INTO erp_supply_requests'))
    assert.match(insert.slice(0, 600), /approver_fio, approved_at, invoice/i)
    assert.match(insert.slice(0, 900), /NULL, NULL, NULL/, 'три поля должны заполняться NULL')
})

test('категория берётся из справочника, а не от клиента', () => {
    // Категория должна совпадать с номенклатурой, иначе заявки не сгруппировать.
    assert.match(supplyPhp, /SELECT category FROM erp_warehouse_items WHERE name = :name/i)
})

test('позиции пишутся одной транзакцией', () => {
    // Иначе часть строк заявки может остаться без остальных.
    assert.match(supplyPhp, /beginTransaction/)
    assert.match(supplyPhp, /rollBack/)
    assert.match(supplyPhp, /commit/)
})

test('новая заявка уведомляет инженеров снабжения', () => {
    assert.match(supplyPhp, /ERP_SUPPLY_ENGINEER_POSITION = 'Инженер снабжения'/)
    assert.match(supplyPhp, /function erp_supply_notify_engineers/)
    assert.match(supplyPhp, /WHERE position = :position AND status = :status/i)
    assert.match(supplyPhp, /erp_supply_notify_engineers\(\$pdo, \$config/)
})

test('смена статуса уведомляет автора заявки', () => {
    assert.match(supplyPhp, /function erp_supply_notify_author/)
    assert.match(supplyPhp, /author_user_id/)
    assert.match(migration, /author_user_id BIGINT UNSIGNED NULL/i)
})

test('сбой уведомления не отменяет заявку', () => {
    // Заявка уже в базе; непришедшее уведомление — повод посмотреть логи,
    // а не потерять заказ.
    const notify = supplyPhp.slice(
        supplyPhp.indexOf('function erp_supply_notify_engineers'),
        supplyPhp.indexOf('function erp_supply_notify_author'),
    )
    assert.match(notify, /catch \(Throwable\)/)
})

test('маршруты снабжения объявлены', () => {
    assert.match(router, /'POST' && \$path === '\/supply\/requests'/)
    assert.match(router, /'GET' && \$path === '\/supply\/my-requests'/)
    assert.match(router, /'GET' && \$path === '\/supply\/catalog'/)
})

test('экран заявки: строка номенклатуры, количество, плюс и кнопка «Заказать»', () => {
    assert.match(page, /placeholder="Номенклатура"/)
    assert.match(page, /placeholder="Кол-во"/)
    assert.match(page, /heroicons:plus/)
    assert.match(page, /Заказать/)
    assert.match(page, /#footer/, 'кнопка «Заказать» должна быть закреплена внизу')
})

test('в шапке есть переход в «Ваши заявки»', () => {
    assert.match(page, /Ваши заявки/)
    assert.match(page, /\/supply-requests/)
})

test('экран «Ваши заявки» показывает статус каждой заявки', () => {
    assert.match(requestsPage, /fetchMySupplyRequests/)
    assert.match(requestsPage, /request\.status/)
    assert.match(requestsPage, /requestCode/)
})

test('новый роут закрыт правом supply', () => {
    // Таб-бар прячет раздел без доступа, но прямой переход по URL раньше
    // не проверялся вовсе — поэтому роут обязан быть в обоих списках.
    assert.match(middleware, /'\/supply-requests',/)
    assert.match(middleware, /'\/supply-requests': 'supply'/)
})
