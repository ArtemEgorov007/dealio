import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../public/api/migrations/014_erp_work_log.sql', import.meta.url), 'utf8')
const titleMigration = await readFile(
    new URL('../public/api/migrations/020_erp_work_log_badge_title.sql', import.meta.url),
    'utf8',
)
const php = await readFile(new URL('../public/api/src/WorkLog.php', import.meta.url), 'utf8')
const handover = await readFile(new URL('../public/api/src/Handover.php', import.meta.url), 'utf8')
const badges = await readFile(new URL('../public/api/src/Badges.php', import.meta.url), 'utf8')
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

test('материал остаётся пустым, внутренний номер договора теперь заполняется Приходом', () => {
    // «Материал» — сценариев его получения по-прежнему нет, колонка заведена
    // впрок. «Внутренний номер договора» ждал первого источника с 014 — им
    // стал Приход (erp_intake_complete_matched передаёт его по строке
    // erp_work_objects, которую приняли).
    assert.match(migration, /contract_internal_number VARCHAR\(64\) NULL/i)
    assert.match(migration, /material VARCHAR\(255\) NULL/i)
    assert.match(php, /VALUES\s*\n\s*\(:contract_internal_number, NULL,/)
    assert.match(php, /'contract_internal_number' => \$contract === null \|\| \$contract === '' \? null : mb_substr\(\$contract, 0, 64\)/)
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

test('титул и объект работы — отдельные колонки под строки бирки', () => {
    // Бирка — обычный текст каталога, а не гарантированно многострочный
    // формат: колонки NULL-able, а не NOT NULL DEFAULT ''.
    assert.match(titleMigration, /ADD COLUMN title VARCHAR\(512\) NULL/)
    assert.match(titleMigration, /ADD COLUMN work_object VARCHAR\(512\) NULL/)
})

test('титул и объект работы разбираются из первой и второй строки бирки', () => {
    assert.match(php, /function erp_badge_title_lines\(string \$badgeContent\): array/)
    // Перевод строки любого вида: \r\n, \r, \n — источник бирки не гарантирует конкретный.
    assert.match(php, /preg_split\('\/\\r\\n\|\\r\|\\n\/', trim\(\$badgeContent\)\)/)
    // Второй строки может не быть вовсе — это не ошибка разбора.
    assert.match(php, /trim\(\$lines\[1\] \?\? ''\)/)

    assert.match(php, /const ERP_WORK_TAG_BADGE = 'Бирка';/)
    assert.match(php, /\[ERP_WORK_TAG_MEASUREMENT, ERP_WORK_TAG_BADGE, ERP_WORK_TAG_INTAKE\]/)
})

// function erp_badges_issue(…) — единственная функция выдачи в файле, до
// следующего function-обработчика (erp_badges_issues_today).
const issueStart = badges.indexOf('function erp_badges_issue(PDO')
const issueEnd = badges.indexOf('function erp_badges_issues_today')
const issueBody = badges.slice(issueStart, issueEnd)

test('выдача бирки пишет журнал работ в своей транзакции', () => {
    // Тот же приём, что уже в Handover.php: выдача уже на SQL, запись
    // отдельным запросом с клиента терялась бы при обрыве связи.
    assert.ok(issueStart > -1, 'обработчик выдачи не найден')
    const record = issueBody.indexOf('erp_work_log_record($pdo, $actor')
    const commit = issueBody.indexOf('$pdo->commit()')
    assert.ok(record > -1, 'выдача бирки не пишет журнал')
    assert.ok(record < commit, 'запись журнала должна быть внутри транзакции')

    assert.match(issueBody, /erp_badge_title_lines\(\$badgeContent\)/)
    assert.match(issueBody, /'tag' => ERP_WORK_TAG_BADGE/)
    assert.match(issueBody, /'badge' => \$badgeContent/)
    // Пространство ключей идемпотентности своё — не совпадает с ключом самой
    // выдачи, иначе одна и та же строка успела бы столкнуться в другой таблице.
    assert.match(issueBody, /'badge:' \. \$idempotencyKey/)
})

test('незаполняемые по ТЗ столбцы строки «Бирка» остаются пустыми', () => {
    // П.3 ТЗ: «Все остальные столбцы оставляем пустыми» — договор, материал,
    // толщина не передаются вовсе, они и так NULL по умолчанию у INSERT.
    const record = issueBody.slice(
        issueBody.indexOf('erp_work_log_record($pdo, $actor'),
        issueBody.indexOf('$pdo->commit()'),
    )
    assert.doesNotMatch(record, /'thickness'/)
    assert.doesNotMatch(record, /'contractInternalNumber'|'material'/)
})
