import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migration = (await readFile(new URL('../public/api/migrations/013_erp_contracts.sql', import.meta.url), 'utf8'))
    + (await readFile(new URL('../public/api/migrations/015_erp_contract_rates_defaults.sql', import.meta.url), 'utf8'))
const php = await readFile(new URL('../public/api/src/Contracts.php', import.meta.url), 'utf8')
const auth = await readFile(new URL('../public/api/src/Auth.php', import.meta.url), 'utf8')
const personnel = await readFile(new URL('../public/api/src/Personnel.php', import.meta.url), 'utf8')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')
const types = await readFile(new URL('../types/erp.types.ts', import.meta.url), 'utf8')
const middleware = await readFile(new URL('../app/middleware/erp-flow.global.ts', import.meta.url), 'utf8')
const newForm = await readFile(new URL('../app/pages/contract-new.vue', import.meta.url), 'utf8')
const card = await readFile(new URL('../app/pages/contract.vue', import.meta.url), 'utf8')
const ratesPage = await readFile(new URL('../app/pages/contract-rates.vue', import.meta.url), 'utf8')

test('право «Работа с договорами» заведено во всех местах', () => {
    // Список кодов, метка для «Кадров» и флаги доступа на клиенте: пропуск
    // любого из трёх означает право, которое нельзя ни выдать, ни увидеть.
    assert.match(auth, /'personnel', 'contracts'\]/)
    assert.match(personnel, /'contracts' => 'Работа с договорами'/)
    assert.match(types, /contracts: boolean/)
    assert.match(types, /contracts: false,/)
})

test('право выдаётся по должностям, а не наугад', () => {
    // «Руководитель ПТО» в справочнике должностей отсутствует — есть «Ведущий
    // инженер ПТО», «Инженер ПТО» и «Руководитель отдела». Наугад не выдаём.
    assert.match(migration, /INSERT INTO erp_user_permissions/i)
    assert.match(migration, /'Главный экономист', 'Генеральный директор', 'Коммерческий директор'/)
    assert.match(migration, /ON DUPLICATE KEY UPDATE allowed = 1/i)
    assert.doesNotMatch(migration, /'Руководитель ПТО'/, 'такой должности в системе нет')
})

test('расценка не может сослаться на несуществующий договор', () => {
    assert.match(migration, /UNIQUE KEY erp_contracts_internal_unique \(internal_number\)/i)
    assert.match(migration, /FOREIGN KEY \(internal_number\) REFERENCES erp_contracts \(internal_number\)/i)
    assert.match(migration, /ON DELETE CASCADE ON UPDATE CASCADE/i)
})

test('в таблице договоров все поля ТЗ', () => {
    for (const column of ['internal_number', 'contract_number', 'customer', 'subject', 'limit_amount']) {
        assert.match(migration, new RegExp(column), `нет колонки ${column}`)
    }
})

test('в таблице расценок все поля ТЗ', () => {
    for (const column of ['param1', 'param2', 'param3', 'param4', 'price_m2', 'price_ton']) {
        assert.match(migration, new RegExp(column), `нет колонки ${column}`)
    }
})

test('договор не создать с неполными данными', () => {
    assert.match(php, /\$missing\[\] = 'внутренний номер'/)
    assert.match(php, /\$missing\[\] = 'номер договора'/)
    assert.match(php, /\$missing\[\] = 'заказчик'/)
    assert.match(php, /\$missing\[\] = 'предмет договора'/)
    assert.match(php, /\$missing\[\] = 'предельная сумма'/)
    assert.match(php, /'Заполните: ' \. implode\(', ', \$missing\)/)
})

test('повторный внутренний номер отклоняется', () => {
    assert.match(php, /уже заведён/)
})

test('Аванс, СМР, ИД и КС — нули до появления своих источников', () => {
    // Строки должны существовать: иначе не видно, что данные ещё не заведены.
    const summary = php.slice(php.indexOf('function erp_contract_summary'))
    assert.match(summary.slice(0, 500), /'advance' => 0\.0/)
    assert.match(summary.slice(0, 500), /'construction' => 0\.0/)
    assert.match(summary.slice(0, 500), /'executiveDocs' => 0\.0/)
    assert.match(summary.slice(0, 500), /'acts' => 0\.0/)
    assert.match(card, /Аванс/)
    assert.match(card, /СМР/)
    assert.match(card, /ИД/)
    assert.match(card, /КС/)
})

test('пустых значений в расценке не бывает', () => {
    // Параметры участвуют в подборе расценки для журнала работ: пустая строка
    // совпала бы с чужой расценкой. NULL в цене выпадает из любых сравнений.
    assert.match(php, /function erp_contract_param/)
    assert.match(php, /\$value === '' \? '-' :/)
    assert.match(php, /function erp_contract_price/)
    assert.match(php, /\$value === '' \? 0\.0 :/)
    assert.match(migration, /param1 VARCHAR\(255\) NOT NULL DEFAULT '-'/i)
    assert.match(migration, /price_m2 DECIMAL\(15,2\) NOT NULL DEFAULT 0/i)
})

test('прежние пустые значения переписаны, а не оставлены', () => {
    // Иначе NOT NULL не применился бы к строкам, заведённым до правила.
    assert.match(migration, /UPDATE erp_contract_rates SET param1 = '-' WHERE param1 = ''/i)
    assert.match(migration, /UPDATE erp_contract_rates SET price_m2 = 0 WHERE price_m2 IS NULL/i)
})

test('расценка правится на месте и сохраняет свой id', () => {
    // Прежняя реализация стирала набор и записывала заново: id менялись на
    // каждом сохранении, и сослаться на расценку было не из чего.
    const save = php.slice(php.indexOf('function erp_contract_save_rates'))
    assert.match(save, /UPDATE erp_contract_rates/)
    assert.doesNotMatch(save, /DELETE FROM erp_contract_rates WHERE internal_number/, 'набор больше не стирается целиком')
    assert.match(save, /DELETE FROM erp_contract_rates WHERE id IN/)
})

test('чужую расценку через id не поправить', () => {
    assert.match(php, /!in_array\(\$id, \$existingIds, true\)/)
    assert.match(php, /не принадлежит этому договору/)
})

test('расценку можно открыть из карточки договора', () => {
    assert.match(card, /const openRate = \(rateId: number\)/)
    assert.match(card, /query: \{id: contractId\.value, rate: rateId\}/)
    assert.match(card, /Нажмите на расценку, чтобы изменить или удалить/)
})

test('удалить можно любую расценку, включая единственную', () => {
    // Раньше кнопка пряталась на последней строке, и последнюю расценку
    // удалить было нечем.
    assert.doesNotMatch(ratesPage, /v-if="rows\.length > 1"/, 'кнопка удаления должна быть у каждой строки')
    assert.match(ratesPage, /rows\.value = \[emptyRow\(\)\]/)
})

test('набор расценок сохраняется одной транзакцией', () => {
    // Правки, добавления и удаления должны быть неделимы, иначе сбой
    // посередине оставит договор с половиной расценок.
    const save = php.slice(php.indexOf('function erp_contract_save_rates'))
    assert.match(save, /beginTransaction/)
    assert.match(save, /rollBack/)
    assert.match(save, /commit/)
})

test('весь раздел закрыт правом contracts', () => {
    const handlers = php.match(/^function (erp_contracts?_\w+)\(PDO /gm) ?? []
    const guards = php.match(/erp_require_permission\(\$pdo, \$actor, 'contracts', \$requestId\)/g) ?? []
    assert.ok(handlers.length > 0)
    assert.equal(guards.length, handlers.length, `обработчиков ${handlers.length}, проверок ${guards.length}`)
})

test('маршруты договоров объявлены', () => {
    assert.match(router, /'GET' && \$path === '\/contracts'/)
    assert.match(router, /'POST' && \$path === '\/contracts'/)
    assert.ok(router.includes("^/contracts/(\\d+)$"), 'нет маршрута карточки')
    assert.ok(router.includes("^/contracts/(\\d+)/rates$"), 'нет маршрута расценок')
})

test('экраны договоров закрыты правом', () => {
    for (const route of ['/contracts', '/contract-new', '/contract', '/contract-rates']) {
        assert.match(middleware, new RegExp(`'${route}': 'contracts'`), `роут ${route} не закрыт`)
    }
})

test('форма договора требует все поля', () => {
    assert.match(newForm, /internalNumber\.value\.trim\(\) !== ''/)
    assert.match(newForm, /contractNumber\.value\.trim\(\) !== ''/)
    assert.match(newForm, /customer\.value\.trim\(\) !== ''/)
    assert.match(newForm, /subject\.value\.trim\(\) !== ''/)
    assert.match(newForm, /parsedLimit\.value > 0/)
})

test('расценки добавляются кнопкой и убираются по одной', () => {
    assert.match(ratesPage, /const addRow = /)
    assert.match(ratesPage, /if \(rows\.value\.length <= 1\) \{/, 'последняя строка заменяется пустой, а не исчезает')
    assert.match(ratesPage, /Параметр 1/)
    assert.match(ratesPage, /Параметр 4/)
    assert.match(ratesPage, /Цена за м²/)
    assert.match(ratesPage, /Цена за тн/)
})
