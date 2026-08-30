import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../public/api/migrations/009_erp_supply_multiline.sql', import.meta.url), 'utf8')
const supplyPhp = await readFile(new URL('../public/api/src/Supply.php', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/supply.vue', import.meta.url), 'utf8')
const requestsPage = await readFile(new URL('../app/pages/supply-requests.vue', import.meta.url), 'utf8')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')
const middleware = await readFile(new URL('../app/middleware/erp-flow.global.ts', import.meta.url), 'utf8')
const statusMigration = await readFile(new URL('../public/api/migrations/010_erp_supply_status_notifications.sql', import.meta.url), 'utf8')
const pushPhp = await readFile(new URL('../public/api/src/Push.php', import.meta.url), 'utf8')
const hub = await readFile(new URL('../app/pages/register.vue', import.meta.url), 'utf8')

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

test('смену статуса ловим по расхождению, а не по вызову из обработчика', () => {
    // Экрана обработки заявок нет: статус меняет снабжение напрямую в базе,
    // а позже — функционал счетов. Привязка к одному обработчику потеряла бы
    // все остальные источники.
    assert.match(statusMigration, /ADD COLUMN notified_status VARCHAR\(64\) NULL/i)
    assert.match(supplyPhp, /status <> COALESCE\(notified_status, ''\)/)
    assert.match(supplyPhp, /function erp_supply_notify_status_changes/)
})

test('старая история не рассылается при первом прогоне', () => {
    assert.match(statusMigration, /UPDATE erp_supply_requests SET notified_status = status/i)
})

test('уведомление — одно на заявку, а не на позицию', () => {
    const watcher = supplyPhp.slice(supplyPhp.indexOf('function erp_supply_notify_status_changes'))
    assert.match(watcher, /GROUP BY request_code, status/)
})

test('сбой доставки не зацикливает рассылку', () => {
    // Без отметки после попытки крон повторял бы одну неудачу каждую минуту.
    const watcher = supplyPhp.slice(supplyPhp.indexOf('function erp_supply_notify_status_changes'))
    const notify = watcher.indexOf('erp_supply_notify_author(')
    const mark = watcher.indexOf('$markNotified->execute(')
    assert.ok(notify > -1 && mark > notify, 'отметка должна ставиться после попытки доставки')
})

test('уведомление ведёт на экран заявок автора', () => {
    assert.match(supplyPhp, /'Статус: ' \. \$status, '\/supply-requests'/)
})

test('крон-маршрут закрыт токеном', () => {
    assert.match(router, /'POST' && \$path === '\/internal\/supply-notify-status'/)
    const handler = supplyPhp.slice(supplyPhp.indexOf('function erp_supply_notify_status_cron'))
    assert.match(handler.slice(0, 300), /erp_require_cron_token\(\$config, \$requestId\)/)
})

test('проверка cron-токена не размножена по копиям', () => {
    // Копии расходятся молча, а расходится здесь право дёрнуть рассылку
    // без входа в систему.
    const guards = pushPhp.match(/HTTP_X_CRON_TOKEN/g) ?? []
    assert.equal(guards.length, 1, 'проверка токена должна быть в одном месте')
    assert.match(pushPhp, /function erp_require_cron_token/)
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

test('количество из поля разбирается и числом, и строкой', () => {
    // <input type="number"> отдаёт через v-model число, и вызов .replace на
    // нём ронял весь экран заявки — поймано только живым кликом.
    assert.match(page, /const parseQuantity = \(value: string \| number\): number =>/)
    assert.match(page, /typeof value === 'number' \? value : Number\(String\(value\)\.replace\(',', '\.'\)\)/)
    assert.doesNotMatch(page, /row\.quantity\.replace/, 'у количества нельзя звать строковые методы напрямую')
})

test('заявки сортируются по времени, а не по строке кода', () => {
    // request_code — строка: сортировка по нему ставит «Колпино-9» выше
    // «Колпино-18», то есть свежая заявка проваливается в середину списка.
    const my = supplyPhp.slice(supplyPhp.indexOf('function erp_supply_my_requests'))
    assert.doesNotMatch(my.slice(0, 900), /ORDER BY[^']*request_code DESC/)
    assert.match(my, /ORDER BY id'/)
    assert.match(my, /array_reverse\(array_values\(\$requests\)\)/)
})

test('раздел больше не помечен заглушкой', () => {
    assert.doesNotMatch(hub, /label: 'Снабжение', caption: 'В разработке'/)
    assert.match(hub, /label: 'Снабжение', caption: 'Заявка на материалы'/)
})

test('всю номенклатуру можно посмотреть списком', () => {
    // Сотрудник не обязан угадывать формулировку, чтобы увидеть, что бывает
    // на складе: пустое поле показывает весь справочник.
    assert.match(page, /const suggestionsFor = \(row: FormRow\): ErpSupplyCatalogItem\[\] =>\s*\n\s*rankByQuery\(catalog\.value, row\.name, item => item\.name\)/)
    assert.doesNotMatch(page, /if \(!row\.name\.trim\(\)\) return \[\]/, 'пустой ввод не должен давать пустой список')
    assert.doesNotMatch(page, /\.slice\(0, 8\)/, 'список не обрезаем — он прокручивается')
    assert.match(page, /max-height: 260px/)
    assert.match(page, /overflow-y: auto/)
})

test('список открывается кнопкой, а не только вводом', () => {
    assert.match(page, /Показать всю номенклатуру/)
    assert.match(page, /toggleSuggestions\(row\)/)
})

test('набранное подставляется из номенклатуры', () => {
    // Заявка принимается только с позицией из справочника, поэтому «каска»
    // нужно превратить в «Каска защитная» самим, а не отбивать ошибкой.
    assert.match(page, /resolveSingleMatch\(catalog\.value, row\.name, item => item\.name\)/)
    assert.match(page, /@blur="closeSuggestions\(row\)"/)
})

test('нераспознанная строка видна до отправки', () => {
    // Иначе сотрудник узнаёт о проблеме только из ошибки сервера после
    // нажатия «Заказать».
    assert.match(page, /Выберите позицию из номенклатуры/)
    assert.match(page, /unresolvedRows/)
    assert.match(page, /unresolvedRows\.value\.length === 0/)
})

test('пустой результат поиска не тупик', () => {
    assert.match(page, /Ничего не нашлось\. Очистите поле, чтобы увидеть всю номенклатуру\./)
})

test('поле количества не растёт после выбора позиции', () => {
    // Сетка по умолчанию растягивает ячейки на высоту строки: когда под
    // номенклатурой появлялась подпись категории, поле количества
    // вытягивалось с 46 до 65px (замерено на стенде).
    const fields = page.slice(page.indexOf('.supply-row__fields'), page.indexOf('.supply-row__name'))
    assert.match(fields, /align-items: start/)
})

test('уменьшен плейсхолдер, а не само поле', () => {
    // iOS Safari зумирует страницу при фокусе на поле с font-size < 16px,
    // поэтому инпуту размер занижать нельзя — только плейсхолдеру.
    const placeholder = page.slice(page.indexOf('&::placeholder'))
    assert.match(placeholder.slice(0, 400), /font-size: 13px/)

    // Комментарии выкидываем: проверяем объявления, а не текст рядом с ними.
    const declarations = page.slice(page.indexOf('.supply-input\n'), page.indexOf('&::placeholder'))
        .split('\n')
        .filter(line => !line.trim().startsWith('//'))
        .join('\n')
    assert.doesNotMatch(declarations, /font-size: 1[0-5]px/, 'сам инпут не опускаем ниже 16px')
})
