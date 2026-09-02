<?php
declare(strict_types=1);

/**
 * Согласования счетов — целиком на SQL.
 *
 * Раньше эта очередь читалась и решалась через мост в Apps Script (curl к
 * листу «Согласования»); erp_approvals уже писалась при создании счёта
 * (SupplyWork.php), но экран согласующего её не видел вовсе. Правила
 * видимости и ответственности ниже перенесены из старого моста один в один —
 * это рабочие правила бизнеса, а не техническая деталь реализации.
 */

function erp_approvals_position(mixed $position): string
{
    $normalized = preg_replace('/[\s\x{00A0}]+/u', ' ', trim((string) $position)) ?? '';
    $lower = function_exists('mb_strtolower') ? mb_strtolower($normalized, 'UTF-8') : strtolower($normalized);
    $director = 'генеральный директор';
    return $lower === $director ? 'Генеральный директор' : $normalized;
}

/** По должности, а не по привязке к конкретному человеку — так было и в старой логике. */
function erp_approvals_is_director(string $position): bool
{
    return erp_approvals_position($position) === 'Генеральный директор';
}

function erp_approvals_action(array $input): string
{
    $action = $input['action'] ?? null;
    if (!is_string($action) || !in_array($action, ['approve', 'reject'], true)) {
        throw new RuntimeException('invalid_action');
    }
    return $action;
}

function erp_approvals_id(array $input): int
{
    $value = $input['id'] ?? null;
    if (is_int($value)) {
        $id = $value;
    } elseif (is_string($value) && ctype_digit($value)) {
        $id = (int) $value;
    } else {
        throw new RuntimeException('invalid_id');
    }
    if ($id <= 0) {
        throw new RuntimeException('invalid_id');
    }
    return $id;
}

/**
 * DTO для клиента. Ссылки на PDF здесь нет: клиент строит её сам из `id`
 * через invoiceFileUrl() (app/utils/erp-supply.ts) — тем же способом, что и
 * на экране «Все счета». Сервер не знает, под каким baseURL развёрнут
 * конкретный клиент, а два источника одной и той же ссылки расходятся рано
 * или поздно.
 */
function erp_approvals_row(array $row, string $stage): array
{
    $parts = array_values(array_filter(
        [(string) $row['department'], (string) $row['category']],
        static fn (string $value): bool => $value !== '',
    ));

    return [
        'id' => (int) $row['id'],
        'stage' => $stage,
        'site' => (string) $row['platform'],
        'departmentType' => implode(' ', $parts),
        'invoice' => (string) $row['invoice'],
        'amount' => (float) $row['amount'],
    ];
}

/** Очередь счетов, ожидающих решения вошедшего сотрудника. */
function erp_approvals_current(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'approvals', $requestId);

    $position = erp_approvals_position($actor['position'] ?? '');

    if (erp_approvals_is_director($position)) {
        $statement = $pdo->prepare(
            'SELECT id, platform, department, category, invoice, amount
             FROM erp_approvals
             WHERE status = :status
             ORDER BY created_at'
        );
        $statement->execute(['status' => ERP_INVOICE_STATUS_PENDING_GD]);
        $stage = 'director';
    } else {
        $fio = trim((string) ($actor['fio'] ?? ''));
        $statement = $pdo->prepare(
            'SELECT id, platform, department, category, invoice, amount
             FROM erp_approvals
             WHERE status = :status AND approver_fio = :fio
             ORDER BY created_at'
        );
        $statement->execute(['status' => ERP_INVOICE_STATUS_NEW, 'fio' => $fio]);
        $stage = 'manager';
    }

    $rows = array_map(
        static fn (array $row): array => erp_approvals_row($row, $stage),
        $statement->fetchAll(PDO::FETCH_ASSOC),
    );

    erp_json(200, ['ok' => true, 'data' => ['rows' => $rows, 'pendingCount' => count($rows)]]);
}

/**
 * Решение по счёту.
 *
 * Пять исходов, а не «успех либо 409»:
 *   1. счёт сейчас на этапе этого actor'а — решение проходит;
 *   2. тот же actor уже поставил решение на своём этапе (двойной тап) —
 *      already_processed, не ошибка;
 *   3. actor вообще не имеет отношения к этому счёту (не тот РО, не
 *      директор) — 403 ещё до чтения строки состояния;
 *   4. actor имеет отношение (директор, либо назначенный РО), но счёт сейчас
 *      не на его этапе и решение не его — счёт успел измениться, 409;
 *   5. — совпадает с исходом 2, отдельного случая не остаётся.
 *
 * Строка читается через SELECT ... FOR UPDATE внутри транзакции: решение
 * двух человек одновременно должно сериализоваться, а не гоняться за
 * состоянием снаружи транзакции.
 */
function erp_approvals_decide(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'approvals', $requestId);

    $raw = file_get_contents('php://input') ?: '';
    $input = json_decode($raw, true);
    if (!is_array($input)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    try {
        $id = erp_approvals_id($input);
        $action = erp_approvals_action($input);
    } catch (RuntimeException) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $fio = trim((string) ($actor['fio'] ?? ''));
    $isDirector = erp_approvals_is_director($actor['position'] ?? '');

    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT * FROM erp_approvals WHERE id = :id FOR UPDATE');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            $pdo->rollBack();
            erp_json(404, erp_error_payload('not_found', 'Счёт не найден', $requestId));
        }

        $approverFio = trim((string) $row['approver_fio']);
        // Не тот человек вообще: не директор и не тот, на кого назначен РО.
        // Проверяется раньше состояния счёта — это не «изменилось», а «вам
        // сюда не положено» с самого начала.
        if (!$isDirector && (!$approverFio || $approverFio !== $fio)) {
            $pdo->rollBack();
            erp_json(403, erp_error_payload('forbidden', 'Решение по этому счёту вам не назначено', $requestId));
        }

        $myStage = $isDirector ? ERP_INVOICE_STATUS_PENDING_GD : ERP_INVOICE_STATUS_NEW;
        $status = (string) $row['status'];

        if ($status !== $myStage) {
            // Не мой текущий этап. Идемпотентный повтор своего же решения —
            // не ошибка; всё остальное значит, что счёт успел измениться
            // (кто-то решил раньше, или мой этап ещё не наступил).
            $decidedByMe = ($isDirector && $row['approved_gd_at'] !== null)
                || (!$isDirector && $row['approved_ro_at'] !== null)
                || ($row['cancelled_at'] !== null && (string) ($row['rejected_by_fio'] ?? '') === $fio);

            $pdo->rollBack();
            if ($decidedByMe) {
                erp_json(200, ['ok' => true, 'data' => ['status' => 'already_processed']]);
            }
            erp_json(409, erp_error_payload('conflict', 'Строка изменилась — обновите список и попробуйте снова', $requestId));
        }

        if ($action === 'reject') {
            $pdo->prepare(
                'UPDATE erp_approvals SET status = :status, cancelled_at = CURDATE(), rejected_by_fio = :fio WHERE id = :id'
            )->execute(['status' => ERP_INVOICE_STATUS_REJECTED, 'fio' => $fio, 'id' => $id]);
        } elseif ($isDirector) {
            $pdo->prepare(
                'UPDATE erp_approvals SET status = :status, approved_gd_at = CURDATE(), approved_gd_fio = :fio WHERE id = :id'
            )->execute(['status' => ERP_INVOICE_STATUS_APPROVED, 'fio' => $fio, 'id' => $id]);
        } else {
            $pdo->prepare(
                'UPDATE erp_approvals SET status = :status, approved_ro_at = CURDATE() WHERE id = :id'
            )->execute(['status' => ERP_INVOICE_STATUS_PENDING_GD, 'id' => $id]);
        }

        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    $resultStatus = $action === 'reject' ? 'rejected' : 'approved';

    // Мгновенно, не через 5-минутный крон — тот же приём, что уже в
    // erp_supply_work_create_invoice.
    try {
        erp_approvals_notify_responsible($pdo, $config, $id);
        erp_approvals_notify_status_changes($pdo, $config);
    } catch (Throwable) {
        // Решение уже записано: непришедшее уведомление — повод посмотреть логи.
    }

    erp_json(200, ['ok' => true, 'data' => ['status' => $resultStatus]]);
}

/**
 * @return array<int, array{user_id: int, fio: string, position: string}>
 */
function erp_approvals_users_with_access(PDO $pdo): array
{
    $stmt = $pdo->query(
        'SELECT u.id AS user_id, u.fio, u.position
         FROM erp_users u
         INNER JOIN erp_user_permissions p ON p.user_id = u.id
         WHERE p.permission_code = \'approvals\'
           AND p.allowed = 1
           AND u.status = \'Работает\''
    );
    return $stmt ? $stmt->fetchAll() : [];
}

/**
 * Пуш тому, кто отвечает за счёт ПРЯМО СЕЙЧАС — вызывается сразу после
 * создания счёта (назначенный РО) и сразу после решения РО (все директора).
 * После решения ГД пушить некому: цепочка ответственных закончилась.
 */
function erp_approvals_notify_responsible(PDO $pdo, array $config, int $id): void
{
    $statement = $pdo->prepare('SELECT status, invoice, approver_fio FROM erp_approvals WHERE id = :id');
    $statement->execute(['id' => $id]);
    $row = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return;
    }

    $status = (string) $row['status'];
    $invoice = (string) $row['invoice'];

    if ($status === ERP_INVOICE_STATUS_NEW) {
        $approver = $pdo->prepare(
            "SELECT id FROM erp_users WHERE fio = :fio AND status = 'Работает' LIMIT 1"
        );
        $approver->execute(['fio' => trim((string) $row['approver_fio'])]);
        $userId = $approver->fetchColumn();
        if ($userId !== false) {
            erp_push_send_to_users(
                $pdo, $config, [(int) $userId],
                'Счёт на согласование', "Счёт {$invoice} ждёт вашего решения", '/approvals',
            );
        }
        return;
    }

    if ($status === ERP_INVOICE_STATUS_PENDING_GD) {
        $directors = array_map(
            static fn (array $user): int => (int) $user['user_id'],
            array_filter(
                erp_approvals_users_with_access($pdo),
                static fn (array $user): bool => erp_approvals_is_director((string) $user['position']),
            ),
        );
        if ($directors !== []) {
            erp_push_send_to_users(
                $pdo, $config, $directors,
                'Счёт на согласование', "Счёт {$invoice} ждёт согласования директором", '/approvals',
            );
        }
    }
}

/**
 * Уведомление автора счёта на каждую смену статуса — тот же diff-приём, что
 * уже проверен на erp_supply_requests (erp_supply_notify_status_changes):
 * событием считается расхождение status <> notified_status, а не вызов из
 * конкретного места. Отметка ставится и при сбое доставки — иначе крон
 * повторял бы одну и ту же неудачную рассылку бесконечно.
 *
 * @return array{invoices: int, notified: int}
 */
function erp_approvals_notify_status_changes(PDO $pdo, array $config): array
{
    $changed = $pdo->query(
        "SELECT id, invoice, status, created_by
         FROM erp_approvals
         WHERE created_by IS NOT NULL AND status <> COALESCE(notified_status, '')"
    )->fetchAll(PDO::FETCH_ASSOC);

    $markNotified = $pdo->prepare(
        'UPDATE erp_approvals SET notified_status = :notified WHERE id = :id AND status = :status'
    );

    $notified = 0;
    foreach ($changed as $row) {
        $id = (int) $row['id'];
        $status = (string) $row['status'];

        try {
            erp_push_send_to_users(
                $pdo, $config, [(int) $row['created_by']],
                'Счёт ' . $row['invoice'], 'Статус: ' . $status, '/invoices',
            );
        } catch (Throwable) {
            // Смена статуса важнее уведомления.
        }

        $markNotified->execute(['id' => $id, 'status' => $status, 'notified' => $status]);
        $notified++;
    }

    return ['invoices' => count($changed), 'notified' => $notified];
}

function erp_approvals_notify_status_cron(PDO $pdo, array $config, string $requestId): void
{
    erp_require_cron_token($config, $requestId);
    erp_json(200, ['ok' => true, 'data' => erp_approvals_notify_status_changes($pdo, $config)]);
}

function erp_approval_notification_create(PDO $pdo, int $userId, int $rowNumber, string $invoice): bool
{
    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO erp_approval_notifications (user_id, approval_row_number, invoice)
         VALUES (:user_id, :approval_row_number, :invoice)'
    );
    $stmt->execute([
        'user_id' => $userId,
        'approval_row_number' => $rowNumber,
        'invoice' => $invoice,
    ]);
    return $stmt->rowCount() === 1;
}

function erp_approvals_notifications_current(PDO $pdo, array $config, string $requestId): void
{
    $user = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $user, 'approvals', $requestId);

    $stmt = $pdo->prepare(
        'SELECT approval_row_number AS rowNumber, invoice
         FROM erp_approval_notifications
         WHERE user_id = :user_id AND read_at IS NULL
         ORDER BY created_at ASC'
    );
    $stmt->execute(['user_id' => (int) $user['id']]);
    $rows = $stmt->fetchAll() ?: [];

    erp_json(200, ['ok' => true, 'data' => ['notifications' => $rows]]);
}

function erp_approvals_notifications_mark_read(PDO $pdo, array $config, string $requestId): void
{
    $user = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $user, 'approvals', $requestId);

    $raw = file_get_contents('php://input') ?: '';
    $input = json_decode($raw, true);
    if (!is_array($input)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $rowNumbers = $input['rowNumbers'] ?? null;
    if (!is_array($rowNumbers) || $rowNumbers === []) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $normalized = [];
    foreach ($rowNumbers as $rowNumber) {
        if (is_int($rowNumber)) {
            $normalized[] = $rowNumber;
        } elseif (is_string($rowNumber) && ctype_digit($rowNumber)) {
            $normalized[] = (int) $rowNumber;
        }
    }
    if ($normalized === []) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $placeholders = implode(', ', array_fill(0, count($normalized), '?'));
    $stmt = $pdo->prepare(
        'UPDATE erp_approval_notifications
         SET read_at = NOW(6)
         WHERE user_id = ? AND approval_row_number IN (' . $placeholders . ') AND read_at IS NULL'
    );
    $stmt->execute(array_merge([(int) $user['id']], $normalized));

    erp_json(200, ['ok' => true, 'data' => ['marked' => $stmt->rowCount()]]);
}
