import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../public/api/migrations/011_erp_invoice_files.sql', import.meta.url), 'utf8')
const php = await readFile(new URL('../public/api/src/SupplyWork.php', import.meta.url), 'utf8')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')
const form = await readFile(new URL('../app/pages/invoice-new.vue', import.meta.url), 'utf8')
const hubPage = await readFile(new URL('../app/pages/supply-work.vue', import.meta.url), 'utf8')
const list = await readFile(new URL('../app/pages/invoices.vue', import.meta.url), 'utf8')
const middleware = await readFile(new URL('../app/middleware/erp-flow.global.ts', import.meta.url), 'utf8')
const register = await readFile(new URL('../app/pages/register.vue', import.meta.url), 'utf8')
const api = await readFile(new URL('../app/utils/erp-api.ts', import.meta.url), 'utf8')
const htaccess = await readFile(new URL('../public/api/.htaccess', import.meta.url), 'utf8')

test('счёт привязан к заявке', () => {
    assert.match(migration, /ALTER TABLE erp_approvals\s*\n\s*ADD COLUMN request_code VARCHAR\(64\) NULL/i)
    assert.match(php, /'request_code' => \$requestCode/)
})

test('площадка, отдел и категория берутся из заявки, а не от клиента', () => {
    // Иначе счёт и заявка разъедутся, и согласующий увидит чужую площадку.
    assert.match(php, /SELECT MIN\(platform\) AS platform, MIN\(department\) AS department, MIN\(category\) AS category\s*\n\s*FROM erp_supply_requests WHERE request_code = :code/i)
    assert.match(php, /'department' => \(string\) \$row\['department'\]/)
    assert.match(php, /'platform' => \(string\) \$row\['platform'\]/)
    assert.match(php, /'category' => \(string\) \$row\['category'\]/)
})

test('новый счёт заводится со статусом «Ожидает РО» и пустыми датами', () => {
    assert.match(php, /ERP_INVOICE_STATUS_NEW = 'Ожидает РО'/)
    const insert = php.slice(php.indexOf('INSERT INTO erp_approvals'))
    assert.match(insert.slice(0, 500), /approved_ro_at, approved_gd_at, cancelled_at/)
    assert.match(insert.slice(0, 700), /NULL, NULL, NULL/)
})

test('согласующий — только сотрудник с правом согласования', () => {
    assert.match(php, /permission_code = 'approvals' AND p\.allowed = 1/)
    assert.match(php, /нет права согласования/)
})

test('несуществующая заявка отклоняется', () => {
    assert.match(php, /нет в системе/)
})

test('файл лежит в базе, а не под webroot', () => {
    // Всё под public/ отдаётся по HTTP — мы уже ловили утечку схемы базы
    // именно так. Файл в базе недостижим без авторизованного обработчика.
    assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_invoice_files/i)
    assert.match(migration, /content LONGBLOB NOT NULL/i)
    assert.match(migration, /UNIQUE KEY erp_invoice_files_approval_unique \(approval_id\)/i)
    assert.match(migration, /ON DELETE CASCADE/i)
})

test('список счетов не тянет содержимое файлов', () => {
    // LONGBLOB в выборке списка положил бы память на трёх сотнях счетов.
    const invoices = php.slice(php.indexOf('function erp_supply_work_invoices'))
    assert.doesNotMatch(invoices.slice(0, 1200), /f\.content/)
    assert.match(invoices, /f\.id AS file_id/)
})

test('принимается только настоящий PDF', () => {
    // Расширению и Content-Type верить нельзя — их задаёт клиент.
    assert.match(php, /str_starts_with\(\$content, '%PDF-'\)/)
    assert.match(php, /Это не PDF-файл/)
})

test('превышение post_max_size объясняется человеку', () => {
    // PHP отбрасывает тело до нас, и пользователь видел бы «прикрепите файл»
    // на файле, который только что прикрепил.
    assert.match(php, /\$_POST === \[\] && \$_FILES === \[\] && \(int\) \(\$_SERVER\['CONTENT_LENGTH'\] \?\? 0\) > 0/)
    assert.match(php, /file_too_large/)
})

test('лимит файла считается по настройкам сервера', () => {
    // На хостинге upload_max_filesize = 2M — ниже нашей границы. Клиент
    // должен знать настоящий предел, иначе минута загрузки уйдёт впустую.
    assert.match(php, /function erp_invoice_upload_limit/)
    assert.match(php, /ini_get\('upload_max_filesize'\)/)
    assert.match(php, /ini_get\('post_max_size'\)/)
    assert.match(php, /'maxFileBytes' => erp_invoice_upload_limit\(\)/)
    assert.match(form, /picked\.size > limit/)
})

test('настройки PHP не отдаются по HTTP', () => {
    // Apache сам прячет только .ht*, а .user.ini — нет.
    assert.match(htaccess, /RewriteRule \^\\\.user\\\.ini\$ - \[R=404,L\]/)
})

test('весь раздел закрыт правом supply', () => {
    const handlers = php.match(/erp_require_permission\(\$pdo, \$actor, 'supply', \$requestId\)/g) ?? []
    assert.equal(handlers.length, 4, 'все четыре обработчика раздела')
})

test('маршруты раздела объявлены', () => {
    assert.match(router, /'GET' && \$path === '\/supply-work\/form'/)
    assert.match(router, /'POST' && \$path === '\/supply-work\/invoices'/)
    assert.match(router, /'GET' && \$path === '\/supply-work\/invoices'/)
    assert.ok(router.includes("^/supply-work/invoices/(\\d+)/file$"), 'нет маршрута к файлу счёта')
})

test('multipart не ломается подставленным JSON-заголовком', () => {
    // FormData сам несёт Content-Type с boundary; application/json поверх него
    // означает, что файл до сервера не доедет вовсе.
    assert.match(api, /const isMultipart = init\.body instanceof FormData/)
    assert.match(api, /\.\.\.\(isMultipart \? \{\} : \{'Content-Type': 'application\/json'\}\)/)
})

test('у загрузки свой таймаут', () => {
    // 8 МБ по мобильной связи в общий таймаут в 12 секунд не влезают.
    assert.match(api, /init\.timeoutMs \?\? ERP_API_TIMEOUT_MS/)
})

test('раздел — это две кнопки и «Все счета» в шапке', () => {
    assert.match(hubPage, /label: 'Завести счёт'/)
    assert.match(hubPage, /label: 'Справочник'/)
    assert.match(hubPage, /label: 'Все счета'/)
})

test('форма собирает все поля ТЗ', () => {
    for (const label of ['Номер счёта', 'Номер заявки', 'Договор', 'Сумма счёта', 'На согласование', 'Файл счёта']) {
        assert.ok(form.includes(label), `в форме нет поля «${label}»`)
    }
    assert.match(form, /Направить/)
})

test('счёт не отправить с неполными данными', () => {
    assert.match(form, /invoice\.value\.trim\(\) !== ''/)
    assert.match(form, /isRequestKnown\.value/)
    assert.match(form, /parsedAmount\.value > 0/)
    assert.match(form, /isApproverKnown\.value/)
    assert.match(form, /file\.value !== null/)
})

test('в списке счетов видны даты согласования', () => {
    // Руководство просило показывать их в блоке счёта.
    assert.match(list, /Согласовано РО/)
    assert.match(list, /Согласовано ГД/)
    assert.match(list, /Отменён/)
})

test('заявку создаёт право «Заказ снабжения», счета — «Работа со снабжением»', () => {
    // Метки прав это и задают: orders — «Заказ снабжения» (36 сотрудников из
    // 43), supply — «Работа со снабжением» (6 снабженцев). Экран заявок стоял
    // на supply, и его не видели те, для кого он сделан.
    assert.match(middleware, /'\/supply': 'orders'/)
    assert.match(middleware, /'\/supply-requests': 'orders'/)
    assert.match(middleware, /'\/supply-work': 'supply'/)
    assert.match(middleware, /'\/invoice-new': 'supply'/)
    assert.match(middleware, /'\/invoices': 'supply'/)
    assert.match(middleware, /'\/supply-catalog': 'supply'/)
    assert.match(register, /key: 'orders', to: '\/supply'/)
    assert.match(register, /key: 'supply', to: '\/supply-work'/)
})
