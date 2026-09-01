<?php
declare(strict_types=1);

function erp_handover_moscow_today_bounds(): array
{
    $tz = new DateTimeZone('Europe/Moscow');
    $start = new DateTimeImmutable('today', $tz);
    $end = $start->modify('+1 day');
    return [
        $start->format('Y-m-d H:i:s'),
        $end->format('Y-m-d H:i:s'),
        $tz,
    ];
}

function erp_handover_format_time(string $handedAt, DateTimeZone $tz): string
{
    $dt = date_create_immutable($handedAt, $tz);
    if ($dt === false) {
        return '';
    }
    return $dt->format('H:i');
}

function erp_handover_entry_payload(array $row, DateTimeZone $tz): array
{
    return [
        'id' => (int) $row['id'],
        'row' => (int) $row['id'],
        'badge' => (string) $row['badge_content'],
        'time' => erp_handover_format_time((string) $row['handed_at'], $tz),
    ];
}

function erp_handover_create(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'handover', $requestId);

    $raw = file_get_contents('php://input') ?: '';
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $badgeContent = trim((string) ($payload['badgeContent'] ?? ''));
    if ($badgeContent === '') {
        erp_json(400, erp_error_payload('bad_request', 'Укажите бирку', $requestId));
    }

    $badgeHash = hash('sha256', $badgeContent);
    $idempotencyKey = trim((string) ($payload['idempotencyKey'] ?? ''));
    if ($idempotencyKey !== '' && strlen($idempotencyKey) > 64) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный ключ идемпотентности', $requestId));
    }
    if ($idempotencyKey === '') {
        $idempotencyKey = null;
    }

    [, , $tz] = erp_handover_moscow_today_bounds();

    if ($idempotencyKey !== null) {
        $existing = $pdo->prepare(
            'SELECT id, badge_content, handed_at
             FROM erp_handover_entries
             WHERE idempotency_key = :key AND deleted_at IS NULL
             LIMIT 1'
        );
        $existing->execute(['key' => $idempotencyKey]);
        $row = $existing->fetch();
        if ($row) {
            erp_json(200, [
                'ok' => true,
                'data' => [
                    'entry' => erp_handover_entry_payload($row, $tz),
                    'replayed' => true,
                ],
            ]);
        }
    }

    // Тег выбирает сотрудник под сканером: одна и та же бирка проходит очистку,
    // ОГЗ и финиш, и без тега журнал не отличит эти работы друг от друга.
    $tag = trim((string) ($payload['tag'] ?? ''));
    if (!in_array($tag, erp_work_handover_tags(), true)) {
        erp_json(422, erp_error_payload(
            'invalid_input',
            'Выберите вид работы: ' . implode(', ', erp_work_handover_tags()),
            $requestId
        ));
    }

    $dup = $pdo->prepare(
        'SELECT id FROM erp_handover_entries
         WHERE badge_hash = :badge_hash AND deleted_at IS NULL
         LIMIT 1'
    );
    $dup->execute(['badge_hash' => $badgeHash]);
    if ($dup->fetch()) {
        erp_json(409, erp_error_payload('conflict', 'Бирка уже записана', $requestId));
    }

    $pdo->beginTransaction();
    try {
        $insert = $pdo->prepare(
            'INSERT INTO erp_handover_entries (user_id, badge_content, badge_hash, idempotency_key)
             VALUES (:user_id, :badge_content, :badge_hash, :idempotency_key)'
        );
        $insert->execute([
            'user_id' => (int) $actor['id'],
            'badge_content' => $badgeContent,
            'badge_hash' => $badgeHash,
            'idempotency_key' => $idempotencyKey,
        ]);
        $entryId = (int) $pdo->lastInsertId();

        $event = $pdo->prepare(
            'INSERT INTO erp_shift_events (user_id, event_type, platform, business_key)
             VALUES (:user_id, :event_type, :platform, :business_key)'
        );
        $event->execute([
            'user_id' => (int) $actor['id'],
            'event_type' => 'handover',
            'platform' => (string) $actor['platform'],
            'business_key' => 'handover:' . $entryId,
        ]);

        // Журнал работ пишем здесь же: сдача уже на SQL, и запись отдельным
        // запросом с клиента терялась бы при обрыве связи после сдачи.
        erp_work_log_record($pdo, $actor, [
            'tag' => $tag,
            'badge' => $badgeContent,
            'idempotencyKey' => $idempotencyKey === null ? null : 'handover:' . $idempotencyKey,
        ]);

        $pdo->commit();
    } catch (PDOException $error) {
        $pdo->rollBack();
        if ($idempotencyKey !== null && (int) ($error->errorInfo[1] ?? 0) === 1062) {
            $existing = $pdo->prepare(
                'SELECT id, badge_content, handed_at
                 FROM erp_handover_entries
                 WHERE idempotency_key = :key AND deleted_at IS NULL
                 LIMIT 1'
            );
            $existing->execute(['key' => $idempotencyKey]);
            $row = $existing->fetch();
            if ($row) {
                erp_json(200, [
                    'ok' => true,
                    'data' => [
                        'entry' => erp_handover_entry_payload($row, $tz),
                        'replayed' => true,
                    ],
                ]);
            }
        }
        throw $error;
    }

    $handed = $pdo->prepare('SELECT id, badge_content, handed_at FROM erp_handover_entries WHERE id = :id LIMIT 1');
    $handed->execute(['id' => $entryId]);
    $row = $handed->fetch();

    erp_json(200, [
        'ok' => true,
        'data' => [
            'entry' => erp_handover_entry_payload($row, $tz),
            'replayed' => false,
        ],
    ]);
}

function erp_handover_today(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'handover', $requestId);

    $scopeUserId = erp_scope_user_id($actor);
    [$start, $end, $tz] = erp_handover_moscow_today_bounds();

    $sql = 'SELECT h.id, h.badge_content, h.handed_at
            FROM erp_handover_entries h
            INNER JOIN erp_users u ON u.id = h.user_id
            WHERE h.deleted_at IS NULL
              AND h.handed_at >= :start_at
              AND h.handed_at < :end_at';
    $params = ['start_at' => $start, 'end_at' => $end];
    if ($scopeUserId !== null) {
        $sql .= ' AND h.user_id = :user_id';
        $params['user_id'] = $scopeUserId;
    }
    $sql .= ' ORDER BY h.handed_at DESC, h.id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $entries = [];
    foreach ($stmt->fetchAll() as $row) {
        $entries[] = erp_handover_entry_payload($row, $tz);
    }

    erp_json(200, ['ok' => true, 'data' => ['entries' => $entries]]);
}

function erp_handover_undo(PDO $pdo, array $config, string $requestId, int $entryId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'handover', $requestId);

    if ($entryId <= 0) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $raw = file_get_contents('php://input') ?: '';
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        $payload = [];
    }

    $fio = trim((string) ($payload['fio'] ?? ''));
    $badgeContent = trim((string) ($payload['badgeContent'] ?? ''));
    if ($fio === '' || $badgeContent === '') {
        erp_json(400, erp_error_payload('bad_request', 'Обновите список и попробуйте снова', $requestId));
    }

    $stmt = $pdo->prepare(
        'SELECT h.id, h.user_id, h.badge_content, u.fio
         FROM erp_handover_entries h
         INNER JOIN erp_users u ON u.id = h.user_id
         WHERE h.id = :id AND h.deleted_at IS NULL
         LIMIT 1'
    );
    $stmt->execute(['id' => $entryId]);
    $row = $stmt->fetch();
    if (!$row) {
        erp_json(404, erp_error_payload('not_found', 'Строка не найдена — обновите список и попробуйте снова', $requestId));
    }

    if ((string) $row['fio'] !== $fio || (string) $row['badge_content'] !== $badgeContent) {
        erp_json(409, erp_error_payload('conflict', 'Строка изменилась — обновите список и попробуйте снова', $requestId));
    }

    if ((int) $row['user_id'] !== (int) $actor['id']) {
        erp_json(403, erp_error_payload('forbidden', 'Недостаточно прав', $requestId));
    }

    $pdo->beginTransaction();
    try {
        $del = $pdo->prepare(
            'UPDATE erp_handover_entries
             SET deleted_at = NOW(6)
             WHERE id = :id AND deleted_at IS NULL'
        );
        $del->execute(['id' => $entryId]);

        $revoke = $pdo->prepare(
            'DELETE FROM erp_shift_events
             WHERE event_type = :event_type AND business_key = :business_key'
        );
        $revoke->execute([
            'event_type' => 'handover',
            'business_key' => 'handover:' . $entryId,
        ]);

        // Журнал работ пишем здесь же: сдача уже на SQL, и запись отдельным
        // запросом с клиента терялась бы при обрыве связи после сдачи.
        erp_work_log_record($pdo, $actor, [
            'tag' => $tag,
            'badge' => $badgeContent,
            'idempotencyKey' => $idempotencyKey === null ? null : 'handover:' . $idempotencyKey,
        ]);

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    erp_json(200, ['ok' => true, 'data' => null]);
}
