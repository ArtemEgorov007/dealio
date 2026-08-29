<?php
declare(strict_types=1);

function erp_approvals_position(mixed $position): string
{
    $normalized = preg_replace('/[\s\x{00A0}]+/u', ' ', trim((string) $position)) ?? '';
    $lower = function_exists('mb_strtolower') ? mb_strtolower($normalized, 'UTF-8') : strtolower($normalized);
    $director = 'генеральный директор';
    return $lower === $director ? 'Генеральный директор' : $normalized;
}

function erp_approvals_actor(array $actor): array
{
    return [
        'fio' => trim((string) ($actor['fio'] ?? '')),
        'position' => erp_approvals_position($actor['position'] ?? ''),
    ];
}

function erp_approvals_action(array $input): string
{
    $action = $input['action'] ?? null;
    if (!is_string($action) || !in_array($action, ['approve', 'reject'], true)) {
        throw new RuntimeException('invalid_action');
    }
    return $action;
}

function erp_approvals_row_number(array $input): int
{
    $value = $input['rowNumber'] ?? null;
    if (is_int($value)) {
        $rowNumber = $value;
    } elseif (is_string($value) && ctype_digit($value)) {
        $rowNumber = (int) $value;
    } else {
        throw new RuntimeException('invalid_row');
    }
    if ($rowNumber <= 1) {
        throw new RuntimeException('invalid_row');
    }
    return $rowNumber;
}

function erp_approvals_decision_status(array $payload): string
{
    $status = $payload['status'] ?? null;
    if (!is_string($status) || !in_array($status, ['approved', 'rejected', 'already_processed'], true)) {
        throw new RuntimeException('bridge_invalid_payload');
    }
    return $status;
}

function erp_approvals_payload(array $payload): array
{
    if (empty($payload['ok'])) {
        $error = $payload['error'] ?? '';
        $allowed = ['forbidden', 'conflict', 'not_available', 'row_not_found', 'malformed_row'];
        throw new RuntimeException(in_array($error, $allowed, true) ? 'bridge_' . $error : 'bridge_unavailable');
    }
    return $payload;
}

function erp_approvals_bridge_config(array $config): array
{
    $approvals = $config['approvals'] ?? null;
    $url = is_array($approvals) ? trim((string) ($approvals['bridge_url'] ?? '')) : '';
    $token = is_array($approvals) ? (string) ($approvals['bridge_token'] ?? '') : '';
    if ($url === '' || $token === '') {
        throw new RuntimeException('bridge_unavailable');
    }
    return [$url, $token];
}

function erp_approvals_decode_bridge(string $body): array
{
    try {
        $payload = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new RuntimeException('bridge_unavailable', 0, $error);
    }
    if (!is_array($payload)) {
        throw new RuntimeException('bridge_unavailable');
    }
    return erp_approvals_payload($payload);
}

/**
 * @return array{rows: array, pendingCount: int}
 */
function erp_approvals_queue_response(array $payload): array
{
    if (!is_array($payload['rows'] ?? null)) {
        throw new RuntimeException('bridge_invalid_payload');
    }

    $rows = $payload['rows'];
    return ['rows' => $rows, 'pendingCount' => count($rows)];
}

function erp_approvals_bridge(array $config, string $operation, array $data): array
{
    [$url, $token] = erp_approvals_bridge_config($config);
    $curl = curl_init();
    if ($curl === false) {
        throw new RuntimeException('bridge_unavailable');
    }

    if ($operation === 'queue') {
        $separator = str_contains($url, '?') ? '&' : '?';
        $actor = $data['actor'] ?? [];
        $requestUrl = $url . $separator . http_build_query([
            'action' => 'queue',
            'token' => $token,
            'fio' => (string) ($actor['fio'] ?? ''),
            'position' => (string) ($actor['position'] ?? ''),
        ], '', '&', PHP_QUERY_RFC3986);
        curl_setopt_array($curl, [
            CURLOPT_URL => $requestUrl,
            CURLOPT_HTTPGET => true,
        ]);
    } elseif ($operation === 'decide') {
        $requestBody = json_encode([
            'action' => 'decide',
            'decision' => $data['action'] ?? '',
            'rowNumber' => $data['rowNumber'] ?? 0,
            'actor' => $data['actor'] ?? [],
            'token' => $token,
        ], JSON_THROW_ON_ERROR);
        curl_setopt_array($curl, [
            CURLOPT_URL => $url,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $requestBody,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        ]);
    } else {
        curl_close($curl);
        throw new RuntimeException('bridge_unavailable');
    }

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => $operation === 'queue' ? ['Accept: application/json'] : ['Content-Type: application/json', 'Accept: application/json'],
    ]);
    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    if (!is_string($body) || $status !== 200) {
        throw new RuntimeException('bridge_unavailable');
    }
    return erp_approvals_decode_bridge($body);
}

function erp_approvals_failure(RuntimeException $error, string $requestId): void
{
    $code = $error->getMessage();
    if (in_array($code, ['invalid_action', 'invalid_row', 'invalid_payload'], true)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }
    if (in_array($code, ['bridge_conflict', 'bridge_not_available', 'bridge_row_not_found', 'bridge_malformed_row'], true)) {
        erp_json(409, erp_error_payload('conflict', 'Строка изменилась — обновите список и попробуйте снова', $requestId));
    }
    erp_json(503, erp_error_payload('approvals_unavailable', 'Источник согласований временно недоступен. Повторите попытку.', $requestId));
}

function erp_approvals_current(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'approvals', $requestId);
    try {
        $payload = erp_approvals_bridge($config, 'queue', ['actor' => erp_approvals_actor($actor)]);
        erp_json(200, ['ok' => true, 'data' => erp_approvals_queue_response($payload)]);
    } catch (RuntimeException $error) {
        erp_approvals_failure($error, $requestId);
    }
}

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
        $payload = erp_approvals_bridge($config, 'decide', [
            'actor' => erp_approvals_actor($actor),
            'rowNumber' => erp_approvals_row_number($input),
            'action' => erp_approvals_action($input),
        ]);
        erp_json(200, ['ok' => true, 'data' => ['status' => erp_approvals_decision_status($payload)]]);
    } catch (RuntimeException $error) {
        erp_approvals_failure($error, $requestId);
    }
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
    erp_apply_migrations($pdo, __DIR__ . '/../migrations');

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
    erp_apply_migrations($pdo, __DIR__ . '/../migrations');

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
