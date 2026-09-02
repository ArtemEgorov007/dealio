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
const sections = await readFile(new URL('../app/utils/erp-sections.ts', import.meta.url), 'utf8')
const api = await readFile(new URL('../app/utils/erp-api.ts', import.meta.url), 'utf8')
const htaccess = await readFile(new URL('../public/api/.htaccess', import.meta.url), 'utf8')
const catalogPage = await readFile(new URL('../app/pages/supply-catalog.vue', import.meta.url), 'utf8')
const unitMigration = await readFile(new URL('../public/api/migrations/012_erp_warehouse_unit.sql', import.meta.url), 'utf8')

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
    // Считаем не «сколько их сейчас», а «у каждого ли есть проверка»: иначе
    // тест придётся править при каждой новой ручке, и однажды его поправят
    // не глядя вместе с забытой проверкой.
    //
    // Одно исключение: erp_supply_work_invoice_file пускает ещё и `approvals`
    // — согласующему нужно открыть PDF того счёта, который он решает, а не
    // только снабжению. У неё свой, двойной guard — проверяется отдельно.
    const handlers = (php.match(/^function (erp_supply_work_\w+)\(PDO /gm) ?? [])
        .filter(line => !line.includes('erp_supply_work_invoice_file'))
    const guards = php.match(/erp_require_permission\(\$pdo, \$actor, 'supply', \$requestId\)/g) ?? []
    assert.ok(handlers.length > 0, 'обработчики раздела не найдены')
    assert.equal(guards.length, handlers.length,
        `обработчиков ${handlers.length}, проверок права ${guards.length}`)

    const fileHandler = php.slice(
        php.indexOf('function erp_supply_work_invoice_file'),
        php.indexOf('function erp_supply_work_invoice_file') + 500,
    )
    assert.match(fileHandler, /empty\(\$access\['supply'\]\) && empty\(\$access\['approvals'\]\)/)
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
    // Руководство просило показывать их в блоке счёта. Ярлык «Отклонён», а не
    // «Отменён»: это ровно то, что происходит по сценарию согласования —
    // счёт не «отменяют», его решением отклоняет согласующий.
    assert.match(list, /Согласовано РО/)
    assert.match(list, /Согласовано ГД/)
    assert.match(list, /Отклонён/)
    // «Кем и когда» — приписка одной строкой, а не два отдельных факта.
    assert.match(list, /item\.approverFio \? `\$\{item\.approverFio\}, ` : ''/)
    assert.match(list, /item\.approvedGdFio \? `\$\{item\.approvedGdFio\}, ` : ''/)
    assert.match(list, /item\.rejectedByFio \? `\$\{item\.rejectedByFio\}, ` : ''/)
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
    assert.match(sections, /key: 'orders',\s*\n\s*to: '\/supply',/)
    assert.match(sections, /key: 'supply',\s*\n\s*to: '\/supply-work',/)
})

test('справочник ТМЦ показывает три колонки ТЗ', () => {
    assert.match(catalogPage, /Категория/)
    assert.match(catalogPage, /Наименование/)
    assert.match(catalogPage, /Ед\. изм\./)
})

test('единицу измерения можно проставить из приложения', () => {
    // В исходной таблице этих данных нет вовсе — заполняют снабженцы.
    assert.match(unitMigration, /ADD COLUMN unit VARCHAR\(32\) NOT NULL DEFAULT ''/i)
    assert.match(php, /UPDATE erp_warehouse_items SET name = :name, category = :category, unit = :unit/)
    assert.match(catalogPage, /updateCatalogItem\(item\.id/)
})

test('правится по одной позиции, а не все сразу', () => {
    // 300 открытых форм на экране — это и тормоза, и промахи пальцем.
    assert.match(catalogPage, /const editingId = ref<number \| null>\(null\)/)
    assert.match(catalogPage, /editingId === item\.id/)
})

test('правка справочника прячется за режимом «Изменить»', () => {
    // В просмотре нажатие на позицию показывает остатки, в правке — форму:
    // два разных смысла одного жеста нельзя держать одновременно.
    assert.match(catalogPage, /const isEditing = ref\(false\)/)
    assert.match(catalogPage, /isEditing \? 'Готово' : 'Изменить'/)
    assert.match(catalogPage, /if \(isEditing\.value\) \{/)
    assert.match(catalogPage, /v-if="isEditing"[\s\S]{0,200}Удалить позицию/)
    // «Добавить» живёт над таб-баром, но уходит, пока открыта любая форма:
    // иначе он перекрывает собой её «Сохранить».
    assert.match(catalogPage, /v-if="isEditing && !isAdding && editingId === null" #footer/)
})

test('поля форм справочника подписаны', () => {
    // Заполненные «СИЗ» и «Перчатки х/б» без подписи выглядят одинаково:
    // в форме переименования не видно, где категория, а где наименование.
    for (const label of ['Категория', 'Наименование', 'Ед. изм.']) {
        const labels = catalogPage.match(
            new RegExp(`<span class="tmc-field__label">${label}</span>`, 'g'),
        )
        // По одной подписи в форме правки и в форме новой позиции.
        assert.equal(labels?.length, 2, `подпись «${label}» должна стоять в обеих формах`)
    }
})

test('позицию можно добавить и удалить', () => {
    assert.match(php, /function erp_supply_work_create_item/)
    assert.match(php, /function erp_supply_work_delete_item/)
    assert.match(router, /'POST' && \$path === '\/supply-work\/items'/)
    assert.ok(router.includes("'DELETE' && preg_match('#^/supply-work/items/(\\d+)$#'"), 'нет маршрута удаления')
    assert.match(catalogPage, /createCatalogItem\(/)
    assert.match(catalogPage, /deleteCatalogItem\(item\.id\)/)
})

test('двух позиций с одним названием не завести', () => {
    // Номенклатура связывается со складом по наименованию: тёзка увёл бы
    // остатки не туда.
    assert.match(php, /уже есть в справочнике/)

    // Проверка «уже есть» не спасает от гонки: имя закрыто уникальным
    // индексом, и одновременные добавления доходят до вставки. Нарушение
    // уникальности должно вернуть тот же 409, а не 500 «ERP недоступна».
    const create = php.slice(
        php.indexOf('function erp_supply_work_create_item'),
        php.indexOf('function erp_supply_work_update_item'),
    )
    assert.match(create, /catch \(PDOException \$error\)/)
    assert.match(create, /getCode\(\) !== '23000'/)
})

test('удаление смотрит на остаток, а не на наличие складской строки', () => {
    // У списанной позиции строка остаётся навсегда — с нулём и историей.
    // Запрет по самой строке означал бы «спишите остатки» тому, кто уже всё
    // списал: позицию стало бы не убрать никогда.
    const remove = php.slice(php.indexOf('function erp_supply_work_delete_item'))
    assert.match(remove, /FROM erp_warehouse_balance WHERE item_name = :name AND balance <> 0/)
    assert.doesNotMatch(
        remove.slice(0, remove.indexOf('DELETE FROM erp_warehouse_items')),
        /FROM erp_warehouse_stock WHERE item_name/,
        'запрет должен считать остаток, а не строки склада',
    )
})

test('переименование переносится на складские строки', () => {
    // Остаток хранится с составным ключом, куда входит наименование, а лог
    // движений ссылается на тот же ключ. На стенде остатки есть у 271 позиции
    // из 301 — оставить их со старым именем значило бы оторвать почти всё.
    const update = php.slice(php.indexOf('function erp_supply_work_update_item'))
    assert.match(update, /SELECT id, stock_key, platform, cell, item_type FROM erp_warehouse_stock WHERE item_name = :name/)
    assert.match(update, /erp_warehouse_stock_key\(/)
    // Строку лога переписываем целиком: половинчатая правка оставила бы
    // запись, где ключ от одного товара, а наименование от другого.
    assert.match(
        update,
        /UPDATE erp_warehouse_log\s+SET stock_key = :new_key, item_name = :name, category = :category, unit = :unit\s+WHERE stock_key = :old_key/,
    )
    assert.match(update, /beginTransaction/)
    assert.match(update, /rollBack/)
    // Гонка двух переименований в одно имя — конфликт, а не 500.
    assert.match(update, /\$error instanceof PDOException && \$error->getCode\(\) === '23000'/)
})

test('переименование не сливает две складские позиции молча', () => {
    assert.match(php, /переименование объединило бы остатки/)
})

test('позицию с остатками не удалить', () => {
    // На складе физически лежит товар: убирать его из справочника — почти
    // наверняка ошибка. Чистить мусор это не мешает, у него остатков нет.
    const remove = php.slice(php.indexOf('function erp_supply_work_delete_item'))
    assert.match(remove, /сначала спишите остатки/)
})

test('остатки показываются по площадкам', () => {
    // Считаются представлением из начального плюс движения лога: хранить
    // остаток отдельным полем значило бы завести второй источник правды.
    assert.match(php, /FROM erp_warehouse_balance\s*\n\s*WHERE item_name = :name/)
    assert.match(catalogPage, /fetchItemStock\(item\.id\)/)
    assert.match(catalogPage, /stockId === item\.id/)
    assert.match(catalogPage, /На складах не числится/)
})

test('заведение счёта переводит заявку в «Ожидает РО» и уведомляет автора', () => {
    assert.match(php, /UPDATE erp_supply_requests SET status = :status WHERE request_code = :code/)
    assert.match(php, /erp_supply_notify_status_changes\(\$pdo, \$config\)/)
})

test('договор в счёте связывается по внутреннему номеру', () => {
    // Подсказки берутся из справочника договоров, а не из ранее введённых
    // строк: иначе поле плодило бы ссылки в никуда.
    assert.match(php, /SELECT internal_number, customer FROM erp_contracts/i)
    assert.doesNotMatch(php, /SELECT DISTINCT contract FROM erp_approvals/i)
    assert.match(form, /\{value: item\.internalNumber, hint: item\.customer\}/)
})

test('несуществующий договор в счёт не проходит', () => {
    assert.match(php, /SELECT 1 FROM erp_contracts WHERE internal_number = :number/)
    assert.match(php, /нет в справочнике/)
    assert.match(form, /isContractKnown/)
})

test('договор остаётся необязательным', () => {
    // Счета заводятся и до появления договора в справочнике.
    assert.match(php, /if \(\$contract !== ''\) \{/)
    assert.match(form, /contract\.value\.trim\(\) === '' \|\| selectedContract\.value !== null/)
})

test('жёсткой связи в базе нет — её сломал бы импорт', () => {
    // scripts/sql-import-warehouse.php пишет в то же поле свободный текст из
    // исходной таблицы; внешний ключ уронил бы импорт исторических счетов.
    const contractsMigration = migration
    assert.doesNotMatch(contractsMigration, /erp_approvals[\s\S]*FOREIGN KEY \(contract\)/i)
})

test('в списке счетов виден заказчик по договору', () => {
    assert.match(php, /LEFT JOIN erp_contracts c ON c\.internal_number = a\.contract/i)
    assert.match(list, /item\.customer/)
})
