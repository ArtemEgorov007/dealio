import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

// Проверяем решения из docs/superpowers/specs/2026-08-30-warehouse-supply-sql-design.md.
// Каждое из них принято по фактическим данным выгрузки, и молчаливый откат
// любого возвращает конкретный дефект — он назван в сообщении assert'а.

const warehouse = await readFile(new URL('../public/api/migrations/007_erp_warehouse.sql', import.meta.url), 'utf8')
const supply = await readFile(new URL('../public/api/migrations/008_erp_supply_approvals.sql', import.meta.url), 'utf8')

test('складские таблицы созданы под своими именами', () => {
    assert.match(warehouse, /CREATE TABLE IF NOT EXISTS erp_warehouse_items/i)
    assert.match(warehouse, /CREATE TABLE IF NOT EXISTS erp_warehouse_stock/i)
    assert.match(warehouse, /CREATE TABLE IF NOT EXISTS erp_warehouse_log/i)
})

test('остаток не хранится полем, а считается представлением', () => {
    // Два независимых источника одного числа расходятся. В выгрузке это уже
    // видно: «Поступление»/«Выдача» нулевые во всех строках, а «Остаток» — нет.
    const stockTable = warehouse.slice(
        warehouse.indexOf('CREATE TABLE IF NOT EXISTS erp_warehouse_stock'),
        warehouse.indexOf('CREATE TABLE IF NOT EXISTS erp_warehouse_log'),
    )

    assert.doesNotMatch(stockTable, /^\s*balance\s+DECIMAL/im, 'остаток не должен храниться в erp_warehouse_stock')
    assert.doesNotMatch(stockTable, /total_received|total_issued/i, 'приход и расход не должны храниться полями')
    assert.match(stockTable, /opening_balance\s+DECIMAL/i, 'нужен начальный остаток: текущие остатки в лог не писались')
    assert.match(warehouse, /CREATE OR REPLACE VIEW erp_warehouse_balance/i)
})

test('представление считает остаток от начального плюс движения', () => {
    const view = warehouse.slice(warehouse.indexOf('CREATE OR REPLACE VIEW erp_warehouse_balance'))

    assert.match(view, /opening_balance/i)
    assert.match(view, /action\s*=\s*'receipt'/i)
    assert.match(view, /action\s*=\s*'issue'/i)
    assert.match(view, /LEFT JOIN erp_warehouse_log/i, 'позиция без движений обязана остаться в выдаче')
})

test('лог защищён от повторной записи по ключу идемпотентности', () => {
    // Ответ GAS терялся на клиенте уже после записи, и повтор задваивал приём.
    // Колонка «ID» из листа на эту роль не годится: там ключ позиции, он
    // повторяется (274 строки, 272 уникальных значения).
    assert.match(warehouse, /request_id\s+VARCHAR\(64\)\s+NULL/i, 'NULL нужен для строк первичного импорта')
    assert.match(warehouse, /UNIQUE KEY erp_warehouse_log_request_id_unique \(request_id\)/i)
})

test('лог хранит количество без знака, направление задаёт действие', () => {
    assert.match(warehouse, /action ENUM\('receipt', 'issue', 'transfer'\)/i)
    assert.match(warehouse, /quantity DECIMAL\(15,3\) NOT NULL/i)
})

test('заявки и согласования созданы', () => {
    assert.match(supply, /CREATE TABLE IF NOT EXISTS erp_supply_requests/i)
    assert.match(supply, /CREATE TABLE IF NOT EXISTS erp_approvals/i)
})

test('номер счёта не первичный ключ и не уникален', () => {
    // В выгрузке счёт 308/1 встречается дважды с разными суммами.
    assert.match(supply, /invoice VARCHAR\(64\) NOT NULL/i)
    assert.match(supply, /KEY erp_approvals_invoice_idx \(invoice\)/i)
    assert.doesNotMatch(supply, /UNIQUE KEY \w*invoice\w*_unique/i, 'номер счёта в источнике не уникален')
})

test('готовые формулировки статусов в базе не дублируются', () => {
    // «Ожидает РО», «Согласован» и т.п. в листе — многострочный текст для
    // показа, вычисляемый из статуса, суммы и дат. Хранить его рядом
    // с исходными полями значит гарантировать расхождение.
    for (const derived of ['ozhidaet', 'waiting_ro_text', 'approved_text', 'cancelled_text']) {
        assert.doesNotMatch(supply, new RegExp(derived, 'i'), `${derived} — производный текст, его не хранят`)
    }
    assert.match(supply, /status VARCHAR\(64\)/i)
    assert.match(supply, /approved_ro_at DATE NULL/i)
    assert.match(supply, /approved_gd_at DATE NULL/i)
    assert.match(supply, /cancelled_at DATE NULL/i)
})

test('сумма счёта — число, а не форматированная строка', () => {
    // В источнике «40 000,00 ₽»: по такой строке не посчитать и не отсортировать.
    assert.match(supply, /amount DECIMAL\(15,2\)/i)
})

test('уведомления о согласованиях связаны с записью, а не со строкой листа', () => {
    assert.match(supply, /ALTER TABLE erp_approval_notifications/i)
    assert.match(supply, /approval_id BIGINT UNSIGNED NULL/i)
    assert.match(supply, /FOREIGN KEY \(approval_id\) REFERENCES erp_approvals \(id\)/i)
})

test('миграции трогают только таблицы с префиксом erp_', () => {
    // Имена достаём разбором, а не отрицательным просмотром: необязательная
    // группа «IF NOT EXISTS» при откате цепляется за само слово IF и даёт
    // ложное срабатывание.
    const names = []
    for (const sql of [warehouse, supply]) {
        for (const m of sql.matchAll(/(?:CREATE|ALTER|DROP)\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+|IF\s+EXISTS\s+)?([A-Za-z_][\w]*)/gi)) {
            names.push(m[1])
        }
    }

    assert.ok(names.length > 0, 'ни одной таблицы не разобрано — проверь регулярное выражение')
    for (const name of names) {
        assert.ok(name.startsWith('erp_'), `таблица ${name} без префикса erp_: миграция выходит за пределы своей области`)
    }
})
