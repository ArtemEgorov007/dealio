import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../public/api/migrations/014_erp_work_log.sql', import.meta.url), 'utf8')
const php = await readFile(new URL('../public/api/src/WorkLog.php', import.meta.url), 'utf8')
const handover = await readFile(new URL('../public/api/src/Handover.php', import.meta.url), 'utf8')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')
const sheets = await readFile(new URL('../app/utils/erp-sheets.ts', import.meta.url), 'utf8')
const scanHandover = await readFile(new URL('../app/pages/scan-handover.vue', import.meta.url), 'utf8')

test('журнал — одна таблица со всеми колонками ТЗ', () => {
    // Отдельная таблица под каждый вид работы превращала бы любой сводный
    // отчёт в объединение пяти разных схем.
    assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_work_log/i)
    for (const column of ['contract_internal_number', 'platform', 'performed_at', 'employee_fio', 'badge', 'tag', 'material']) {
        assert.match(migration, new RegExp(column), `нет колонки ${column}`)
    }
})

test('незаполняемые колонки остаются пустыми', () => {
    // Сценариев их получения ещё нет; колонки заведены сразу, чтобы записи не
    // пришлось переносить, когда источники появятся.
    assert.match(migration, /contract_internal_number VARCHAR\(64\) NULL/i)
    assert.match(migration, /material VARCHAR\(255\) NULL/i)
    assert.match(php, /VALUES\s*\n\s*\(NULL, NULL,/)
})

test('фактическая толщина хранится отдельной колонкой', () => {
    // Сценарий промера требует её записать, а класть замер в «Материал»
    // значило бы смешать разные величины в одной колонке.
    assert.match(migration, /thickness DECIMAL\(10,3\) NULL/i)
    assert.match(sheets, /tag: 'Промер'/)
    assert.match(sheets, /thickness: measured\.length/)
})

test('ФИО и площадка берутся из карточки сотрудника, а не от клиента', () => {
    // Журнал фиксирует, кто выполнил работу, а не что прислал браузер.
    assert.match(php, /'platform' => \(string\) \(\$actor\['platform'\] \?\? ''\)/)
    assert.match(php, /'employee_fio' => \(string\) \(\$actor\['fio'\] \?\? ''\)/)
})

test('повтор после потерянного ответа не задваивает работу', () => {
    assert.match(migration, /UNIQUE KEY erp_work_log_idempotency_unique \(idempotency_key\)/i)
    assert.match(php, /\$error->getCode\(\) === '23000'/)
    assert.match(sheets, /idempotencyKey: workLogKey\(\)/)
})

test('сдача пишет журнал в своей транзакции, а не отдельным запросом', () => {
    // Сдача уже на SQL; запись с клиента терялась бы при обрыве связи после
    // того, как сдача записана.
    const create = handover.slice(handover.indexOf('function erp_handover_create'))
    const record = create.indexOf('erp_work_log_record($pdo, $actor')
    const commit = create.indexOf('$pdo->commit()')
    assert.ok(record > -1, 'сдача не пишет журнал')
    assert.ok(record < commit, 'запись журнала должна быть внутри транзакции')
})

test('вид работы в сдаче обязателен', () => {
    // Одна бирка за смену проходит очистку, ОГЗ и финиш: без тега журнал не
    // отличит эти работы друг от друга.
    assert.match(php, /function erp_work_handover_tags/)
    assert.match(php, /\['Очистка', 'ОГЗ', 'Финиш'\]/)
    assert.match(handover, /in_array\(\$tag, erp_work_handover_tags\(\), true\)/)
    assert.match(scanHandover, /const HANDOVER_TAGS = \['Очистка', 'ОГЗ', 'Финиш'\]/)
    assert.match(scanHandover, /Сначала выберите вид работы/)
})

test('упаковка пишет две работы: упаковку и ИД', () => {
    // ТЗ: «Тег: Упаковка, ИД». Колонка тега одна, поэтому две строки.
    assert.match(php, /function erp_work_packing_tags/)
    assert.match(sheets, /for \(const tag of \['Упаковка', 'ИД'\]\)/)
})

test('ручка журнала закрыта правом по виду работы', () => {
    // Иначе журнал стал бы дырой, через которую любой вошедший пишет чужие
    // работы.
    assert.match(php, /\$tag === ERP_WORK_TAG_MEASUREMENT => 'measurements'/)
    assert.match(php, /erp_work_packing_tags\(\), true\) => 'packing'/)
    assert.match(php, /default => 'handover'/)
    assert.match(php, /erp_require_permission\(\$pdo, \$actor, \$permission, \$requestId\)/)
})

test('неизвестный тег не принимается', () => {
    assert.match(php, /in_array\(\$tag, erp_work_tags\(\), true\)/)
    assert.match(php, /Неизвестный тег работы/)
})

test('сбой записи журнала не отменяет выполненную работу', () => {
    // Сотрудник уже получил подтверждение: падать после него значило бы
    // врать про результат.
    const logWork = sheets.slice(sheets.indexOf('async function logWork'))
    assert.match(logWork.slice(0, 500), /catch \(error\)/)
    assert.match(logWork.slice(0, 500), /не попала в журнал работ/)
})

test('маршруты журнала объявлены', () => {
    assert.match(router, /'POST' && \$path === '\/work-log'/)
    assert.match(router, /'GET' && \$path === '\/work-log\/today'/)
})
