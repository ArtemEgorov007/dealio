import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
    new URL('../public/api/migrations/019_erp_approvals_sql_native.sql', import.meta.url),
    'utf8',
)
const approvals = await readFile(new URL('../public/api/src/Approvals.php', import.meta.url), 'utf8')
const push = await readFile(new URL('../public/api/src/Push.php', import.meta.url), 'utf8')
const supply = await readFile(new URL('../public/api/src/Supply.php', import.meta.url), 'utf8')
const supplyWork = await readFile(new URL('../public/api/src/SupplyWork.php', import.meta.url), 'utf8')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')
const index = await readFile(new URL('../public/api/index.php', import.meta.url), 'utf8')
const cronScript = await readFile(new URL('../scripts/approvals-notify-status.php', import.meta.url), 'utf8')

test('согласования больше не ходят в Apps Script', () => {
    // Мост убран полностью — раньше erp_approvals_current/decide были
    // curl-прокси к листу «Согласования». Если хоть одно упоминание моста
    // осталось, значит переезд неполный.
    assert.doesNotMatch(approvals, /erp_approvals_bridge/)
    assert.doesNotMatch(approvals, /curl_init/)
    // erp_push_baseline_user_queue (вызывается при подписке на push) раньше
    // тоже ходила в мост за очередью — теперь читает erp_approvals напрямую,
    // тем же запросом, что erp_approvals_current.
    assert.doesNotMatch(push, /erp_approvals_bridge/)
    const baseline = push.slice(push.indexOf('function erp_push_baseline_user_queue'))
    assert.match(baseline, /erp_approvals_is_director\(/)
    assert.match(baseline, /FROM erp_approvals WHERE status = :status/)
})

test('миграция 019 добавляет автора счёта и аудит ГД, не трогая таблицы уведомлений', () => {
    assert.match(migration, /ADD COLUMN created_by BIGINT UNSIGNED NULL/)
    assert.match(migration, /ADD COLUMN author_fio VARCHAR\(255\) NOT NULL DEFAULT ''/)
    assert.match(migration, /ADD COLUMN approved_gd_fio VARCHAR\(255\) NULL/)
    assert.match(migration, /ADD COLUMN rejected_by_fio VARCHAR\(255\) NULL/)
    assert.match(migration, /ADD COLUMN notified_status VARCHAR\(64\) NOT NULL DEFAULT ''/)
    assert.match(migration, /FOREIGN KEY \(created_by\) REFERENCES erp_users \(id\) ON DELETE SET NULL/)

    // erp_approvals_notify_all_with_access переиспользует эту колонку с
    // синтетическим отрицательным номером — FK на неё сломал бы рассылку.
    // Упоминание в комментарии — объяснение решения, а не ALTER; проверяем
    // именно отсутствие структурной правки этих таблиц.
    assert.doesNotMatch(migration, /ALTER TABLE erp_approval_notifications/)
    assert.doesNotMatch(migration, /ALTER TABLE erp_push_sent/)
    assert.doesNotMatch(migration, /FOREIGN KEY \(approval_id\)/)
})

test('видимость очереди: директор по должности, остальные по совпадению ФИО', () => {
    const current = approvals.slice(approvals.indexOf('function erp_approvals_current'))
    assert.match(current, /erp_approvals_is_director\(/)
    assert.match(current, /WHERE status = :status\s*\n\s*ORDER BY created_at'/)
    assert.match(current, /ERP_INVOICE_STATUS_PENDING_GD/)
    assert.match(current, /WHERE status = :status AND approver_fio = :fio/)
    assert.match(current, /ERP_INVOICE_STATUS_NEW/)
})

test('решение — SELECT ... FOR UPDATE внутри транзакции, не read-then-write снаружи', () => {
    const decide = approvals.slice(
        approvals.indexOf('function erp_approvals_decide'),
        approvals.indexOf('function erp_approvals_users_with_access'),
    )
    assert.match(decide, /beginTransaction\(\)/)
    assert.match(decide, /SELECT \* FROM erp_approvals WHERE id = :id FOR UPDATE/)

    // Личность (тот РО или директор вообще) проверяется раньше состояния
    // счёта — это «вам сюда не положено», а не «изменилось».
    const identityCheckPos = decide.indexOf("erp_error_payload('forbidden', 'Решение по этому счёту вам не назначено'")
    const stageComparePos = decide.indexOf('if ($status !== $myStage)')
    assert.ok(identityCheckPos > -1 && stageComparePos > -1 && identityCheckPos < stageComparePos,
        'проверка личности должна идти раньше сравнения текущего этапа')

    // Идемпотентный повтор своего решения — не ошибка.
    assert.match(decide, /'status' => 'already_processed'/)
    // Оба решения возможны на любом этапе — реджект не заблокирован
    // задним числом всей историей одобрений, как было в старом листе
    // (там reject проверял ЛЮБУЮ из дат РО/ГД, из-за чего ГД не мог
    // отклонить уже согласованный РО счёт). Здесь блокировка — по текущему
    // статусу конкретного этапа actor'а, а не по всей истории строки.
    assert.match(decide, /ERP_INVOICE_STATUS_REJECTED/)
    assert.match(decide, /ERP_INVOICE_STATUS_APPROVED/)
    assert.match(decide, /rejected_by_fio = :fio/)
    assert.match(decide, /approved_gd_fio = :fio/)
})

test('решение мгновенно уведомляет, не дожидаясь крона', () => {
    const decide = approvals.slice(
        approvals.indexOf('function erp_approvals_decide'),
        approvals.indexOf('function erp_approvals_users_with_access'),
    )
    assert.match(decide, /erp_approvals_notify_responsible\(\$pdo, \$config, \$id\)/)
    assert.match(decide, /erp_approvals_notify_status_changes\(\$pdo, \$config\)/)
    // Решение уже записано (commit прошёл) до вызова уведомлений — сбой
    // пуша не должен откатывать или проваливать сам ответ API.
    assert.ok(decide.indexOf('$pdo->commit();') < decide.indexOf('erp_approvals_notify_responsible'))
})

test('пуш назначенному РО при создании и всем директорам после решения РО', () => {
    const notify = approvals.slice(approvals.indexOf('function erp_approvals_notify_responsible'))
    assert.match(notify, /status === ERP_INVOICE_STATUS_NEW/)
    assert.match(notify, /status === ERP_INVOICE_STATUS_PENDING_GD/)
    assert.match(notify, /erp_approvals_is_director\(\(string\) \$user\['position'\]\)/)
    assert.match(notify, /erp_push_send_to_users\(/)

    // Создание счёта дёргает уведомление сразу же.
    assert.match(supplyWork, /erp_approvals_notify_responsible\(\$pdo, \$config, \$approvalId\)/)
})

test('автор счёта уведомляется на каждую смену статуса тем же diff-приёмом, что и заявки снабжения', () => {
    const notify = approvals.slice(approvals.indexOf('function erp_approvals_notify_status_changes'))
    assert.match(notify, /WHERE created_by IS NOT NULL AND status <> COALESCE\(notified_status, ''\)/)
    // Отметка ставится и при сбое доставки — иначе крон повторял бы одну и
    // ту же неудачную рассылку бесконечно (тот же приём, что в Supply.php).
    assert.match(notify, /catch \(Throwable\) \{/)
    assert.match(notify, /UPDATE erp_approvals SET notified_status = :notified WHERE id = :id AND status = :status/)

    assert.match(approvals, /function erp_approvals_notify_status_cron/)
    assert.match(approvals, /erp_require_cron_token\(\$config, \$requestId\)/)
})

test('крон-роут и CLI-обёртка объявлены', () => {
    assert.match(router, /'\/internal\/approvals-notify-status'/)
    assert.match(router, /approvals_notify_status_cron/)
    assert.match(index, /approvals_notify_status_cron/)
    assert.match(cronScript, /erp_approvals_notify_status_changes\(\$pdo, \$config\)/)
    assert.match(cronScript, /erp_cli_api_src\(\)/)
})

test('erp_push_send_to_users живёт в Push.php, а не в Supply.php под чужим именем', () => {
    // Была erp_supply_push: механизм всегда был общий (свободные
    // заголовок/текст, рассылка по подпискам), имя — случайным. Approvals.php
    // нужен тот же механизм под своим доменом, поэтому переехала.
    assert.match(push, /function erp_push_send_to_users\(/)
    assert.doesNotMatch(supply, /function erp_supply_push/)
    assert.doesNotMatch(supply, /erp_supply_push\(/)
    assert.match(supply, /erp_push_send_to_users\(\$pdo, \$config, \$engineers/)
    assert.match(supply, /erp_push_send_to_users\(\$pdo, \$config, \$authors/)
})

test('крон-напоминание читает erp_approvals напрямую, а не цикл по мосту', () => {
    const reminder = push.slice(
        push.indexOf('function erp_push_notify_pending_approvals'),
        push.indexOf('function erp_approvals_notify_all_with_access'),
    )
    assert.doesNotMatch(reminder, /erp_approvals_bridge/)
    assert.match(reminder, /erp_approvals_is_director\(/)
    assert.match(reminder, /FROM erp_approvals WHERE status = :status/)
})
