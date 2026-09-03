<?php
declare(strict_types=1);

function erp_badges_workshop_ids(): array
{
    return ['kolpino', 'volkhonka'];
}

function erp_badges_normalize_workshop(string $workshop, string $requestId): string
{
    $workshop = trim($workshop);
    if (!in_array($workshop, erp_badges_workshop_ids(), true)) {
        erp_json(400, erp_error_payload('bad_request', 'Укажите цех', $requestId));
    }
    return $workshop;
}

function erp_badges_moscow_today_bounds(): array
{
    // Host MySQL session is Europe/Moscow; store and filter wall-clock Moscow time.
    $tz = new DateTimeZone('Europe/Moscow');
    $start = new DateTimeImmutable('today', $tz);
    $end = $start->modify('+1 day');
    return [
        $start->format('Y-m-d H:i:s'),
        $end->format('Y-m-d H:i:s'),
        $tz,
    ];
}

function erp_badges_format_time(string $issuedAt, DateTimeZone $tz): string
{
    $dt = date_create_immutable($issuedAt, $tz);
    if ($dt === false) {
        return '';
    }
    return $dt->format('H:i');
}

function erp_badges_list(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'badges', $requestId);

    $workshop = erp_badges_normalize_workshop((string) ($_GET['workshop'] ?? ''), $requestId);

    $stmt = $pdo->prepare(
        'SELECT badge_content
         FROM erp_workshop_badges
         WHERE workshop_id = :workshop_id
         ORDER BY sort_order ASC, id ASC'
    );
    $stmt->execute(['workshop_id' => $workshop]);
    $badges = array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN));

    erp_json(200, ['ok' => true, 'data' => ['badges' => $badges]]);
}

function erp_badges_issue(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'badges', $requestId);

    $raw = file_get_contents('php://input') ?: '';
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $workshop = erp_badges_normalize_workshop((string) ($payload['workshop'] ?? ''), $requestId);
    $badgeContent = trim((string) ($payload['badgeContent'] ?? ''));
    if ($badgeContent === '') {
        erp_json(400, erp_error_payload('bad_request', 'Укажите бирку', $requestId));
    }

    $idempotencyKey = trim((string) ($payload['idempotencyKey'] ?? ''));
    if ($idempotencyKey !== '' && strlen($idempotencyKey) > 64) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный ключ идемпотентности', $requestId));
    }
    if ($idempotencyKey === '') {
        $idempotencyKey = null;
    }

    if ($idempotencyKey !== null) {
        $existing = $pdo->prepare(
            'SELECT id, badge_content, issued_at
             FROM erp_badge_issues
             WHERE idempotency_key = :key AND deleted_at IS NULL
             LIMIT 1'
        );
        $existing->execute(['key' => $idempotencyKey]);
        $row = $existing->fetch();
        if ($row) {
            [, , $tz] = erp_badges_moscow_today_bounds();
            erp_json(200, [
                'ok' => true,
                'data' => [
                    'entry' => [
                        'id' => (int) $row['id'],
                        'row' => (int) $row['id'],
                        'badge' => (string) $row['badge_content'],
                        'time' => erp_badges_format_time((string) $row['issued_at'], $tz),
                    ],
                    'replayed' => true,
                ],
            ]);
        }
    }

    if (!erp_active_badge_exists($pdo, $workshop, $badgeContent)) {
        erp_json(409, erp_error_payload('conflict', 'Бирка отсутствует в актуальном каталоге', $requestId));
    }

    $pdo->beginTransaction();
    try {
        $insert = $pdo->prepare(
            'INSERT INTO erp_badge_issues (user_id, workshop_id, badge_content, idempotency_key)
             VALUES (:user_id, :workshop_id, :badge_content, :idempotency_key)'
        );
        $insert->execute([
            'user_id' => (int) $actor['id'],
            'workshop_id' => $workshop,
            'badge_content' => $badgeContent,
            'idempotency_key' => $idempotencyKey,
        ]);
        $issueId = (int) $pdo->lastInsertId();

        $event = $pdo->prepare(
            'INSERT INTO erp_shift_events (user_id, event_type, platform, business_key)
             VALUES (:user_id, :event_type, :platform, :business_key)'
        );
        $event->execute([
            'user_id' => (int) $actor['id'],
            'event_type' => 'badge_issue',
            'platform' => (string) $actor['platform'],
            'business_key' => 'badge_issue:' . $issueId,
        ]);

        // Журнал работ пишем здесь же: выдача уже на SQL, и запись отдельным
        // запросом с клиента терялась бы при обрыве связи после выдачи. Тот
        // же приём, что уже в Handover.php.
        [$title, $workObject] = erp_badge_title_lines($badgeContent);
        erp_work_log_record($pdo, $actor, [
            'tag' => ERP_WORK_TAG_BADGE,
            'badge' => $badgeContent,
            'title' => $title,
            'workObject' => $workObject,
            'idempotencyKey' => $idempotencyKey === null ? null : 'badge:' . $idempotencyKey,
        ]);

        $pdo->commit();
    } catch (PDOException $error) {
        $pdo->rollBack();
        if ($idempotencyKey !== null && (int) ($error->errorInfo[1] ?? 0) === 1062) {
            $existing = $pdo->prepare(
                'SELECT id, badge_content, issued_at
                 FROM erp_badge_issues
                 WHERE idempotency_key = :key AND deleted_at IS NULL
                 LIMIT 1'
            );
            $existing->execute(['key' => $idempotencyKey]);
            $row = $existing->fetch();
            if ($row) {
                [, , $tz] = erp_badges_moscow_today_bounds();
                erp_json(200, [
                    'ok' => true,
                    'data' => [
                        'entry' => [
                            'id' => (int) $row['id'],
                            'row' => (int) $row['id'],
                            'badge' => (string) $row['badge_content'],
                            'time' => erp_badges_format_time((string) $row['issued_at'], $tz),
                        ],
                        'replayed' => true,
                    ],
                ]);
            }
        }
        throw $error;
    }

    $issued = $pdo->prepare('SELECT issued_at FROM erp_badge_issues WHERE id = :id LIMIT 1');
    $issued->execute(['id' => $issueId]);
    $issuedAt = (string) $issued->fetchColumn();
    [, , $tz] = erp_badges_moscow_today_bounds();

    erp_json(200, [
        'ok' => true,
        'data' => [
            'entry' => [
                'id' => $issueId,
                'row' => $issueId,
                'badge' => $badgeContent,
                'time' => erp_badges_format_time($issuedAt, $tz),
            ],
            'replayed' => false,
        ],
    ]);
}

function erp_badges_issues_today(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'badges', $requestId);

    $workshopRaw = trim((string) ($_GET['workshop'] ?? ''));
    $workshop = $workshopRaw !== ''
        ? erp_badges_normalize_workshop($workshopRaw, $requestId)
        : null;

    $scopeUserId = erp_scope_user_id($actor);
    [$startUtc, $endUtc, $tz] = erp_badges_moscow_today_bounds();

    $sql = 'SELECT i.id, i.badge_content, i.issued_at
            FROM erp_badge_issues i
            INNER JOIN erp_users u ON u.id = i.user_id
            WHERE i.deleted_at IS NULL
              AND i.issued_at >= :start_utc
              AND i.issued_at < :end_utc';
    $params = [
        'start_utc' => $startUtc,
        'end_utc' => $endUtc,
    ];

    if ($workshop !== null) {
        $sql .= ' AND i.workshop_id = :workshop_id';
        $params['workshop_id'] = $workshop;
    }
    if ($scopeUserId !== null) {
        $sql .= ' AND i.user_id = :user_id';
        $params['user_id'] = $scopeUserId;
    }

    $sql .= ' ORDER BY i.issued_at DESC, i.id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $entries = [];
    foreach ($stmt->fetchAll() as $row) {
        $entries[] = [
            'id' => (int) $row['id'],
            'row' => (int) $row['id'],
            'badge' => (string) $row['badge_content'],
            'time' => erp_badges_format_time((string) $row['issued_at'], $tz),
        ];
    }

    erp_json(200, ['ok' => true, 'data' => ['entries' => $entries]]);
}

function erp_badges_delete_issue(PDO $pdo, array $config, string $requestId, int $issueId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'badges', $requestId);

    if ($issueId <= 0) {
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
        'SELECT i.id, i.user_id, i.badge_content, u.fio
         FROM erp_badge_issues i
         INNER JOIN erp_users u ON u.id = i.user_id
         WHERE i.id = :id AND i.deleted_at IS NULL
         LIMIT 1'
    );
    $stmt->execute(['id' => $issueId]);
    $row = $stmt->fetch();
    if (!$row) {
        erp_json(404, erp_error_payload('not_found', 'Строка не найдена — обновите список и попробуйте снова', $requestId));
    }

    if ((string) $row['fio'] !== $fio || (string) $row['badge_content'] !== $badgeContent) {
        erp_json(409, erp_error_payload('conflict', 'Строка изменилась — обновите список и попробуйте снова', $requestId));
    }

    // Same rule as GAS: only the issuing engineer can delete their row.
    if ((int) $row['user_id'] !== (int) $actor['id']) {
        erp_json(403, erp_error_payload('forbidden', 'Недостаточно прав', $requestId));
    }

    $pdo->beginTransaction();
    try {
        $del = $pdo->prepare(
            'UPDATE erp_badge_issues
             SET deleted_at = NOW(6)
             WHERE id = :id AND deleted_at IS NULL'
        );
        $del->execute(['id' => $issueId]);

        $revoke = $pdo->prepare(
            'DELETE FROM erp_shift_events
             WHERE event_type = :event_type AND business_key = :business_key'
        );
        $revoke->execute([
            'event_type' => 'badge_issue',
            'business_key' => 'badge_issue:' . $issueId,
        ]);

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    erp_json(200, ['ok' => true, 'data' => null]);
}
