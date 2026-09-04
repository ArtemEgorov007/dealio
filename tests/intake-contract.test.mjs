import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../public/api/migrations/021_erp_intake.sql', import.meta.url), 'utf8')
const php = await readFile(new URL('../public/api/src/Intake.php', import.meta.url), 'utf8')
const workLogPhp = await readFile(new URL('../public/api/src/WorkLog.php', import.meta.url), 'utf8')
const auth = await readFile(new URL('../public/api/src/Auth.php', import.meta.url), 'utf8')
const personnel = await readFile(new URL('../public/api/src/Personnel.php', import.meta.url), 'utf8')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')
const indexPhp = await readFile(new URL('../public/api/index.php', import.meta.url), 'utf8')
const bootstrap = await readFile(new URL('../public/api/src/Bootstrap.php', import.meta.url), 'utf8')
const types = await readFile(new URL('../types/erp.types.ts', import.meta.url), 'utf8')
const sections = await readFile(new URL('../app/utils/erp-sections.ts', import.meta.url), 'utf8')
const middleware = await readFile(new URL('../app/middleware/erp-flow.global.ts', import.meta.url), 'utf8')
const api = await readFile(new URL('../app/utils/erp-intake.ts', import.meta.url), 'utf8')
const entryPage = await readFile(new URL('../app/pages/intake.vue', import.meta.url), 'utf8')
const objectsPage = await readFile(new URL('../app/pages/intake-objects.vue', import.meta.url), 'utf8')
const unmatchedPage = await readFile(new URL('../app/pages/intake-unmatched.vue', import.meta.url), 'utf8')

// function erp_intake_complete_matched(...) — единственная функция такого
// имени в файле, до следующего function-обработчика.
const matchedStart = php.indexOf('function erp_intake_complete_matched')
const matchedEnd = php.indexOf('function erp_intake_complete_unmatched')
const matchedBody = php.slice(matchedStart, matchedEnd)
const unmatchedBody = php.slice(matchedEnd)

test('право «Доступ к приходу» заведено во всех местах', () => {
    // Список кодов, метка для «Кадров», флаги доступа на клиенте, раздел и
    // маршруты — пропуск любого означает право, которое нельзя ни выдать, ни
    // увидеть, ни попасть в раздел напрямую по ссылке.
    assert.match(auth, /'contracts', 'intake'\]/)
    assert.match(personnel, /'intake' => 'Доступ к приходу'/)
    assert.match(types, /intake: boolean/)
    assert.match(types, /intake: false,/)
    assert.match(sections, /key: 'intake',/)
    assert.match(middleware, /'\/intake': 'intake'/)
    assert.match(bootstrap, /require_once __DIR__ \. '\/Intake\.php'/)
})

test('маршруты приёма объявлены в роутере и в диспетчере', () => {
    assert.match(router, /\$path === '\/intake\/form'/)
    assert.match(router, /\$path === '\/intake\/deliveries'/)
    assert.match(router, /\$path === '\/intake\/objects'/)
    assert.match(router, /preg_match\('#\^\/intake\/deliveries\/\(\\d\+\)\/objects\$#'/)
    assert.match(router, /preg_match\('#\^\/intake\/deliveries\/\(\\d\+\)\/unmatched\$#'/)
    assert.match(indexPhp, /erp_intake_form\(\$pdo, \$config, \$requestId\)/)
    assert.match(indexPhp, /erp_intake_create_delivery\(\$pdo, \$config, \$requestId\)/)
    assert.match(indexPhp, /erp_intake_objects_options\(\$pdo, \$config, \$requestId\)/)
    assert.match(indexPhp, /erp_intake_complete_matched\(\$pdo, \$config, \$requestId, \(int\) \(\$route\[1\] \?\? 0\)\)/)
    assert.match(indexPhp, /erp_intake_complete_unmatched\(\$pdo, \$config, \$requestId, \(int\) \(\$route\[1\] \?\? 0\)\)/)
})

test('все пять обработчиков закрыты правом intake', () => {
    for (const handler of [
        'erp_intake_form',
        'erp_intake_create_delivery',
        'erp_intake_objects_options',
        'erp_intake_complete_matched',
        'erp_intake_complete_unmatched',
    ]) {
        const start = php.indexOf(`function ${handler}(`)
        assert.ok(start > -1, `${handler} не найден`)
        const body = php.slice(start, php.indexOf('\n}\n', start) + 3)
        assert.match(body, /erp_require_permission\(\$pdo, \$actor, 'intake', \$requestId\)/, `${handler} не проверяет право intake`)
    }
})

test('таблицы поставки и фото заведены с нужными полями', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_intake_deliveries/i)
    for (const column of ['title VARCHAR(128) NULL', 'waybill_number', 'weight_tons', 'platform', 'status', 'pto_user_id', 'pto_fio', 'notified_at']) {
        assert.match(migration, new RegExp(column.replace(/[()]/g, '\\$&')), `нет ${column}`)
    }
    assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_intake_delivery_files/i)
    assert.match(migration, /content LONGBLOB NOT NULL/)
    assert.match(migration, /UNIQUE KEY erp_intake_delivery_files_delivery_unique \(delivery_id\)/)
    assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_intake_delivery_objects/i)
    assert.match(migration, /UNIQUE KEY erp_intake_delivery_objects_unique \(delivery_id, work_object_id\)/)
})

test('площадка нигде не выбирается пользователем — только из карточки сотрудника', () => {
    const create = php.slice(php.indexOf('function erp_intake_create_delivery'), php.indexOf('function erp_intake_objects_options'))
    assert.match(create, /'platform' => \(string\) \(\$actor\['platform'\] \?\? ''\)/)
    assert.doesNotMatch(create, /\$_POST\['platform'\]/)
})

test('фото проверяется по сигнатуре байт, а не по расширению', () => {
    assert.match(php, /str_starts_with\(\$content, "\\xFF\\xD8\\xFF"\)/)
    assert.match(php, /str_starts_with\(\$content, "\\x89PNG\\r\\n\\x1a\\n"\)/)
})

test('накладная валидируется на границы: титул/номер по длине, вес по разумному потолку', () => {
    const create = php.slice(php.indexOf('function erp_intake_create_delivery'), php.indexOf('function erp_intake_objects_options'))
    assert.match(create, /mb_strlen\(\$title\) > 128/)
    assert.match(create, /mb_strlen\(\$waybillNumber\) > 64/)
    assert.match(create, /\$weightTons > 999999\.999/)
})

test('повтор создания поставки с тем же ключом идемпотентности не задваивает запись', () => {
    const create = php.slice(php.indexOf('function erp_intake_create_delivery'), php.indexOf('function erp_intake_objects_options'))
    assert.match(create, /SELECT id, title, status FROM erp_intake_deliveries WHERE idempotency_key = :key/)
    assert.match(create, /\(int\) \(\$error->errorInfo\[1\] \?\? 0\) === 1062/)
})

test('титулы и объекты для выпадающих списков фильтруются по пустой площадке', () => {
    assert.match(php, /SELECT DISTINCT title FROM erp_work_objects WHERE platform = ''/)
    assert.match(php, /WHERE title = :title AND platform = ''/)
})

test('сотрудники ПТО ищутся по отделу ИЛИ должности, не только по одному полю', () => {
    // department — свободный текст без справочника: если карточка завела
    // отдел иначе, а должность содержит «ПТО» — список не должен молча
    // остаться пустым.
    assert.match(php, /\(department = 'ПТО' OR position LIKE '%ПТО%'\) AND status = 'Работает'/)
    assert.match(unmatchedBody, /WHERE fio = :fio AND \(department = 'ПТО' OR position LIKE '%ПТО%'\) AND status = :status/)
})

test('строка поставки блокируется SELECT...FOR UPDATE внутри транзакции до проверки статуса', () => {
    // Отдельный SELECT-затем-UPDATE позволил бы сценарию 1 и сценарию 2
    // одновременно пройти проверку status='pending' на одну и ту же поставку.
    const beginPos = matchedBody.indexOf('beginTransaction')
    const lockPos = matchedBody.indexOf("FROM erp_intake_deliveries WHERE id = :id LIMIT 1 FOR UPDATE")
    const statusCheckPos = matchedBody.indexOf('if ($status === ERP_INTAKE_STATUS_MATCHED)')
    assert.ok(beginPos > -1 && lockPos > beginPos, 'строка поставки блокируется вне транзакции')
    assert.ok(statusCheckPos > lockPos, 'статус проверяется до блокировки строки')
})

test('владелец поставки проверяется в обоих завершающих обработчиках (защита от IDOR)', () => {
    assert.match(matchedBody, /\(int\) \(\$deliveryRow\['created_by'\] \?\? 0\) !== \(int\) \(\$actor\['id'\] \?\? 0\)/)
    assert.match(matchedBody, /erp_json\(403, erp_error_payload\('forbidden'/)
    assert.match(unmatchedBody, /WHERE id = :id AND created_by = :actor_id AND status = :pending/)
})

test('пустой титул поставки (сценарий 2 не довели до конца) не проваливается в ложный конфликт', () => {
    assert.match(matchedBody, /\$title = \$deliveryRow\['title'\] !== null \? \(string\) \$deliveryRow\['title'\] : '';/)
    assert.match(matchedBody, /if \(\$title === ''\) \{\s*\n\s*\$pdo->rollBack\(\);\s*\n\s*erp_json\(422/)
})

test('повтор на уже закрытой поставке — всегда честный skippedIds, не 409', () => {
    // Первая версия сравнивала objectIds с уже привязанными и отдавала 409
    // при любом расхождении — но частичный приём (см. skippedIds выше) сам
    // закрывает поставку, и потерянный на телефоне ответ после ЧАСТИЧНОГО
    // приёма пришёл бы снова с тем же набором id, включая уже пропущенные.
    // 409 в этом случае забирал бы у пользователя список пропущенных марок
    // безвозвратно — тот самый список, ради которого сделан skippedIds.
    assert.match(matchedBody, /SELECT work_object_id FROM erp_intake_delivery_objects WHERE delivery_id = :id/)
    assert.match(matchedBody, /'matched' => count\(array_intersect\(\$objectIds, \$linkedIds\)\),/)
    assert.match(matchedBody, /'skippedIds' => array_values\(array_diff\(\$objectIds, \$linkedIds\)\),/)
    assert.doesNotMatch(
        matchedBody.slice(matchedBody.indexOf('ERP_INTAKE_STATUS_MATCHED'), matchedBody.indexOf('ERP_INTAKE_STATUS_PENDING')),
        /erp_json\(409/,
        'закрытая поставка не должна отвечать 409 — только честным skippedIds',
    )
})

test('приём марки блокирует строку и не отдаёт её второй раз', () => {
    assert.match(matchedBody, /AND platform = ''\s*\n\s*FOR UPDATE"/)
    assert.match(matchedBody, /if \(\$status !== ERP_INTAKE_STATUS_PENDING\)/)
})

test('частичный приём возвращает пропущенные марки, а не молчит о них', () => {
    assert.match(matchedBody, /\$skippedIds = array_values\(array_diff\(\$objectIds, \$claimedIds\)\);/)
    assert.match(matchedBody, /'matched' => count\(\$claimed\), 'skippedIds' => \$skippedIds/)
})

test('дедлок при одновременном приёме по одному титулу отдаёт понятный 409, а не падает 500', () => {
    assert.match(matchedBody, /\(int\) \(\$error->errorInfo\[1\] \?\? 0\) === 1213/)
    assert.match(matchedBody, /erp_json\(409, erp_error_payload\('conflict', 'Одновременная попытка/)
})

test('приём марки пишет журнал работ внутри транзакции с тегом «Приход»', () => {
    const begin = matchedBody.indexOf('beginTransaction')
    const record = matchedBody.indexOf('erp_work_log_record($pdo, $actor')
    // Первый $pdo->commit() в файле принадлежит ветке идемпотентного повтора
    // (раньше по тексту, но не имеет отношения к самой записи) — ищем
    // коммит после самой записи в журнал, а не первый попавшийся.
    const commit = matchedBody.indexOf('$pdo->commit()', record)
    assert.ok(begin > -1 && record > begin && record < commit, 'запись журнала должна быть внутри транзакции')
    assert.match(matchedBody, /'tag' => ERP_WORK_TAG_INTAKE/)
    assert.match(matchedBody, /'contractInternalNumber' => \(string\) \$row\['contract_internal_number'\]/)
    // Пространство ключей идемпотентности своё, привязано к паре
    // поставка+марка — иначе повтор всей ручки после потери ответа не нашёл
    // бы, какие строки уже записаны, и задвоил бы часть журнала.
    assert.match(matchedBody, /'idempotencyKey' => 'intake:' \. \$deliveryId \. ':' \. \$row\['id'\]/)
})

test('тег «Приход» заведён в журнале работ и принимается валидатором', () => {
    assert.match(workLogPhp, /const ERP_WORK_TAG_INTAKE = 'Приход';/)
    assert.match(workLogPhp, /\[ERP_WORK_TAG_MEASUREMENT, ERP_WORK_TAG_BADGE, ERP_WORK_TAG_INTAKE\]/)
})

test('сценарий 2: атомарный UPDATE закрывает гонку статуса и IDOR разом, повтор с тем же титулом И тем же ПТО — идемпотентный успех', () => {
    assert.match(unmatchedBody, /status = :status, pto_user_id = :pto_user_id, pto_fio = :pto_fio, notified_at = CURRENT_TIMESTAMP\(6\)/)
    assert.match(unmatchedBody, /if \(\$update->rowCount\(\) === 0\)/)
    assert.match(unmatchedBody, /SELECT title, pto_fio, status FROM erp_intake_deliveries/)
    // Тот же титул с ДРУГИМ ФИО — не повтор, а попытка переназначить
    // ответственного: уведомление уже ушло первому, молча отвечать 200 без
    // проверки pto_fio означало бы «переназначил», хотя второй уведомление
    // не получит.
    assert.match(unmatchedBody, /\(string\) \$existingRow\['status'\] === ERP_INTAKE_STATUS_UNMATCHED\s*\n\s*&& \(string\) \$existingRow\['title'\] === \$title\s*\n\s*&& \(string\) \$existingRow\['pto_fio'\] === \$ptoFio/)
    assert.match(unmatchedBody, /erp_push_send_to_users\(/)
    assert.match(unmatchedBody, /catch \(Throwable\) \{/)
})

test('клиент: типы и фетчеры очереди приёма объявлены', () => {
    assert.match(api, /export async function fetchIntakeForm\(\): Promise<ErpIntakeFormData>/)
    assert.match(api, /export async function createIntakeDelivery/)
    assert.match(api, /export async function fetchIntakeObjects\(title: string\): Promise<ErpIntakeObjectOption\[\]>/)
    assert.match(api, /export async function completeIntakeMatched\(\s*\n\s*deliveryId: number,\s*\n\s*objectIds: number\[\],\s*\n\s*\): Promise<\{matched: number; skippedIds: number\[\]\}>/)
    assert.match(api, /export async function completeIntakeUnmatched\(/)
})

test('экран накладной: фото с камеры, кнопка «Внести элементы» требует известный титул', () => {
    assert.match(entryPage, /accept="image\/\*"/)
    assert.match(entryPage, /capture="environment"/)
    assert.match(entryPage, /canSubmitMatched = computed\(\(\) => baseFieldsFilled\.value && isTitleKnown\.value/)
    assert.match(entryPage, /canSubmitUnmatched = computed\(\(\) => baseFieldsFilled\.value && !isSubmitting\.value\)/)
})

test('экран объектов: марки вносятся по одной из списка, без поля количества, пропущенные показываются пользователю', () => {
    assert.match(objectsPage, /completeIntakeMatched/)
    assert.match(objectsPage, /unresolvedRows/)
    assert.doesNotMatch(objectsPage, /type="number"/)
    assert.match(objectsPage, /result\.skippedIds\.length > 0/)
})

test('экран «нет данных»: титул вводится вручную, сотрудник ПТО — только из списка', () => {
    assert.match(unmatchedPage, /completeIntakeUnmatched/)
    assert.match(unmatchedPage, /isPtoKnown/)
    assert.match(unmatchedPage, /canSubmit = computed\(\(\) =>\s*\n\s*title\.value\.trim\(\) !== '' && isPtoKnown\.value/)
})
