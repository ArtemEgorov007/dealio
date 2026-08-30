<?php
declare(strict_types=1);

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * @return array{publicKey: string, privateKey: string, subject: string}
 */
function erp_push_config(array $config): array
{
    $push = $config['push'] ?? null;
    if (!is_array($push)) {
        throw new RuntimeException('push_unconfigured');
    }

    $publicKey = trim((string) ($push['vapid_public_key'] ?? ''));
    $privateKey = trim((string) ($push['vapid_private_key'] ?? ''));
    $subject = trim((string) ($push['vapid_subject'] ?? ''));

    if ($publicKey === '' || $privateKey === '' || $subject === '') {
        throw new RuntimeException('push_unconfigured');
    }

    return [
        'publicKey' => $publicKey,
        'privateKey' => $privateKey,
        'subject' => $subject,
    ];
}

function erp_push_autoload(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (!is_file($autoload)) {
        throw new RuntimeException('push_unavailable');
    }
    require_once $autoload;
    $loaded = true;
}

function erp_push_vapid_public(PDO $pdo, array $config, string $requestId): void
{
    try {
        $keys = erp_push_config($config);
        erp_json(200, ['ok' => true, 'data' => ['publicKey' => $keys['publicKey']]]);
    } catch (RuntimeException) {
        erp_json(503, erp_error_payload('push_unavailable', 'Push-уведомления временно недоступны', $requestId));
    }
}

/**
 * @return array{endpoint: string, p256dh: string, auth: string}
 */
function erp_push_subscription_input(array $input): array
{
    $endpoint = trim((string) ($input['endpoint'] ?? ''));
    $keys = $input['keys'] ?? null;
    if ($endpoint === '' || !is_array($keys)) {
        throw new RuntimeException('invalid_payload');
    }
    $p256dh = trim((string) ($keys['p256dh'] ?? ''));
    $auth = trim((string) ($keys['auth'] ?? ''));
    if ($p256dh === '' || $auth === '') {
        throw new RuntimeException('invalid_payload');
    }
    if (strlen($endpoint) > 512) {
        throw new RuntimeException('invalid_payload');
    }
    return ['endpoint' => $endpoint, 'p256dh' => $p256dh, 'auth' => $auth];
}

function erp_push_subscribe(PDO $pdo, array $config, string $requestId): void
{
    $user = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $user, 'approvals', $requestId);

    $raw = file_get_contents('php://input') ?: '';
    $input = json_decode($raw, true);
    if (!is_array($input)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    try {
        erp_push_config($config);
        $subscription = erp_push_subscription_input($input);
    } catch (RuntimeException $error) {
        if ($error->getMessage() === 'push_unconfigured') {
            erp_json(503, erp_error_payload('push_unavailable', 'Push-уведомления временно недоступны', $requestId));
        }
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $userAgent = substr(trim((string) ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 255);
    $stmt = $pdo->prepare(
        'INSERT INTO erp_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, revoked_at)
         VALUES (:user_id, :endpoint, :p256dh, :auth, :user_agent, NULL)
         ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            p256dh = VALUES(p256dh),
            auth = VALUES(auth),
            user_agent = VALUES(user_agent),
            revoked_at = NULL'
    );
    $stmt->execute([
        'user_id' => (int) $user['id'],
        'endpoint' => $subscription['endpoint'],
        'p256dh' => $subscription['p256dh'],
        'auth' => $subscription['auth'],
        'user_agent' => $userAgent,
    ]);

    erp_push_baseline_user_queue($pdo, $config, $user);

    erp_json(200, ['ok' => true, 'data' => ['subscribed' => true]]);
}

function erp_push_unsubscribe(PDO $pdo, array $config, string $requestId): void
{
    $user = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $user, 'approvals', $requestId);

    $raw = file_get_contents('php://input') ?: '';
    $input = json_decode($raw, true);
    if (!is_array($input)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $endpoint = trim((string) ($input['endpoint'] ?? ''));
    if ($endpoint === '') {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $stmt = $pdo->prepare(
        'UPDATE erp_push_subscriptions
         SET revoked_at = NOW(6)
         WHERE user_id = :user_id AND endpoint = :endpoint AND revoked_at IS NULL'
    );
    $stmt->execute([
        'user_id' => (int) $user['id'],
        'endpoint' => $endpoint,
    ]);

    erp_json(200, ['ok' => true, 'data' => ['subscribed' => false]]);
}

function erp_push_revoke_user_subscriptions(PDO $pdo, int $userId): void
{
    $stmt = $pdo->prepare(
        'UPDATE erp_push_subscriptions SET revoked_at = NOW(6) WHERE user_id = :user_id AND revoked_at IS NULL'
    );
    $stmt->execute(['user_id' => $userId]);
}

/**
 * @return array<int, array<string, mixed>>
 */
function erp_push_active_subscriptions(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        'SELECT endpoint, p256dh, auth
         FROM erp_push_subscriptions
         WHERE user_id = :user_id AND revoked_at IS NULL'
    );
    $stmt->execute(['user_id' => $userId]);
    return $stmt->fetchAll() ?: [];
}

function erp_push_mark_sent(PDO $pdo, int $userId, int $rowNumber, string $invoice): bool
{
    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO erp_push_sent (user_id, approval_row_number, invoice) VALUES (:user_id, :approval_row_number, :invoice)'
    );
    $stmt->execute([
        'user_id' => $userId,
        'approval_row_number' => $rowNumber,
        'invoice' => $invoice,
    ]);
    return $stmt->rowCount() === 1;
}

function erp_push_baseline_user_queue(PDO $pdo, array $config, array $user): void
{
    try {
        $payload = erp_approvals_bridge($config, 'queue', [
            'actor' => erp_approvals_actor([
                'fio' => (string) $user['fio'],
                'position' => (string) $user['position'],
            ]),
        ]);
    } catch (RuntimeException) {
        return;
    }

    $rows = is_array($payload['rows'] ?? null) ? $payload['rows'] : [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $rowNumber = (int) ($row['rowNumber'] ?? 0);
        $invoice = trim((string) ($row['invoice'] ?? ''));
        if ($rowNumber <= 1 || $invoice === '') {
            continue;
        }
        $stmt = $pdo->prepare(
            'INSERT IGNORE INTO erp_push_sent (user_id, approval_row_number, invoice) VALUES (:user_id, :approval_row_number, :invoice)'
        );
        $stmt->execute([
            'user_id' => (int) $user['id'],
            'approval_row_number' => $rowNumber,
            'invoice' => $invoice,
        ]);
    }
}

function erp_push_revoke_subscription(PDO $pdo, string $endpoint): void
{
    $stmt = $pdo->prepare(
        'UPDATE erp_push_subscriptions SET revoked_at = NOW(6) WHERE endpoint = :endpoint AND revoked_at IS NULL'
    );
    $stmt->execute(['endpoint' => $endpoint]);
}

/**
 * @param array<int, array<string, mixed>> $subscriptions
 * @return array{sent: int, expired: int, failed: int}
 */
function erp_push_send_approval(array $config, array $subscriptions, string $invoice, int $badgeCount = 1): array
{
    if ($subscriptions === []) {
        return ['sent' => 0, 'expired' => 0, 'failed' => 0];
    }

    erp_push_autoload();
    $keys = erp_push_config($config);
    $webPush = new WebPush([
        'VAPID' => [
            'subject' => $keys['subject'],
            'publicKey' => $keys['publicKey'],
            'privateKey' => $keys['privateKey'],
        ],
    ]);

    $payload = json_encode([
        'title' => 'Новое согласование',
        'body' => 'Счёт ' . $invoice,
        'url' => '/approvals',
        'tag' => 'approval-' . $invoice,
        'badgeCount' => max(1, $badgeCount),
    ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

    foreach ($subscriptions as $row) {
        $webPush->queueNotification(
            Subscription::create([
                'endpoint' => (string) $row['endpoint'],
                'keys' => [
                    'p256dh' => (string) $row['p256dh'],
                    'auth' => (string) $row['auth'],
                ],
            ]),
            $payload,
            ['TTL' => 86400, 'urgency' => 'high'],
        );
    }

    $sent = 0;
    $expired = 0;
    $failed = 0;

    foreach ($webPush->flush() as $report) {
        if ($report->isSuccess()) {
            $sent += 1;
            continue;
        }
        $status = (int) ($report->getResponse()?->getStatusCode() ?? 0);
        if ($status === 404 || $status === 410) {
            $expired += 1;
        } else {
            $failed += 1;
        }
    }

    return ['sent' => $sent, 'expired' => $expired, 'failed' => $failed];
}

function erp_push_notify_cron(PDO $pdo, array $config, string $requestId): void
{
    $push = $config['push'] ?? null;
    $expected = is_array($push) ? trim((string) ($push['cron_token'] ?? '')) : '';
    $provided = trim((string) ($_SERVER['HTTP_X_CRON_TOKEN'] ?? ''));
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        erp_json(403, erp_error_payload('forbidden', 'Недостаточно прав', $requestId));
    }

    $summary = erp_push_notify_pending_approvals($pdo, $config);
    erp_json(200, ['ok' => true, 'data' => $summary]);
}

/**
 * @return array{users: int, rowsChecked: int, inboxCreated: int, notifications: int, expired: int, failed: int}
 */
function erp_push_notify_pending_approvals(PDO $pdo, array $config): array
{
    $summary = [
        'users' => 0,
        'rowsChecked' => 0,
        'inboxCreated' => 0,
        'notifications' => 0,
        'expired' => 0,
        'failed' => 0,
    ];

    try {
        erp_push_config($config);
    } catch (RuntimeException) {
        return $summary;
    }

    $users = erp_approvals_users_with_access($pdo);
    if ($users === []) {
        return $summary;
    }

    foreach ($users as $user) {
        $userId = (int) $user['user_id'];
        $summary['users'] += 1;

        try {
            $payload = erp_approvals_bridge($config, 'queue', [
                'actor' => erp_approvals_actor([
                    'fio' => (string) $user['fio'],
                    'position' => (string) $user['position'],
                ]),
            ]);
        } catch (RuntimeException) {
            continue;
        }

        $rows = is_array($payload['rows'] ?? null) ? $payload['rows'] : [];
        $subscriptions = erp_push_active_subscriptions($pdo, $userId);

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $rowNumber = (int) ($row['rowNumber'] ?? 0);
            $invoice = trim((string) ($row['invoice'] ?? ''));
            if ($rowNumber <= 1 || $invoice === '') {
                continue;
            }
            $summary['rowsChecked'] += 1;
            if (!erp_push_mark_sent($pdo, $userId, $rowNumber, $invoice)) {
                continue;
            }

            if (erp_approval_notification_create($pdo, $userId, $rowNumber, $invoice)) {
                $summary['inboxCreated'] += 1;
            }

            if ($subscriptions === []) {
                continue;
            }

            $result = erp_push_send_approval($config, $subscriptions, $invoice, count($rows));
            $summary['notifications'] += $result['sent'];
            $summary['expired'] += $result['expired'];
            $summary['failed'] += $result['failed'];

            if ($result['expired'] > 0) {
                foreach ($subscriptions as $subscription) {
                    erp_push_revoke_subscription($pdo, (string) $subscription['endpoint']);
                }
                $subscriptions = erp_push_active_subscriptions($pdo, $userId);
            }
        }
    }

    return $summary;
}

/**
 * @return array{users: int, inboxCreated: int, notifications: int, expired: int, failed: int}
 */
function erp_approvals_notify_all_with_access(PDO $pdo, array $config): array
{
    $summary = [
        'users' => 0,
        'inboxCreated' => 0,
        'notifications' => 0,
        'expired' => 0,
        'failed' => 0,
    ];

    $users = erp_approvals_users_with_access($pdo);
    if ($users === []) {
        return $summary;
    }

    $suffix = gmdate('Ymd-His');
    $broadcastInvoice = 'ERP-BROADCAST-' . $suffix;
    $broadcastStamp = time() % 86400;

    try {
        erp_push_config($config);
        $pushAvailable = true;
    } catch (RuntimeException) {
        $pushAvailable = false;
    }

    foreach ($users as $user) {
        $userId = (int) $user['user_id'];
        $summary['users'] += 1;
        $rowNumber = -1 * ($userId * 10000 + $broadcastStamp);

        if (!erp_approval_notification_create($pdo, $userId, $rowNumber, $broadcastInvoice)) {
            continue;
        }
        $summary['inboxCreated'] += 1;

        if (!$pushAvailable) {
            continue;
        }

        $subscriptions = erp_push_active_subscriptions($pdo, $userId);
        if ($subscriptions === []) {
            continue;
        }

        erp_push_autoload();
        $keys = erp_push_config($config);
        $webPush = new WebPush([
            'VAPID' => [
                'subject' => $keys['subject'],
                'publicKey' => $keys['publicKey'],
                'privateKey' => $keys['privateKey'],
            ],
        ]);
        $payload = json_encode([
            'title' => 'Тест уведомлений ERP',
            'body' => 'Это проверка push. Реальные счета появляются только в «Согласования».',
            'url' => '/approvals',
            'tag' => 'erp-broadcast-' . $suffix,
            'badgeCount' => 1,
            'broadcast' => true,
        ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

        foreach ($subscriptions as $subscription) {
            $webPush->queueNotification(
                Subscription::create([
                    'endpoint' => (string) $subscription['endpoint'],
                    'keys' => [
                        'p256dh' => (string) $subscription['p256dh'],
                        'auth' => (string) $subscription['auth'],
                    ],
                ]),
                $payload,
                ['TTL' => 86400, 'urgency' => 'high'],
            );
        }

        foreach ($webPush->flush() as $report) {
            if ($report->isSuccess()) {
                $summary['notifications'] += 1;
                continue;
            }
            $status = (int) ($report->getResponse()?->getStatusCode() ?? 0);
            if ($status === 404 || $status === 410) {
                $summary['expired'] += 1;
                erp_push_revoke_subscription($pdo, (string) $report->getEndpoint());
            } else {
                $summary['failed'] += 1;
            }
        }
    }

    return $summary;
}

function erp_approvals_notify_all_cron(PDO $pdo, array $config, string $requestId): void
{
    $push = $config['push'] ?? null;
    $expected = is_array($push) ? trim((string) ($push['cron_token'] ?? '')) : '';
    $provided = trim((string) ($_SERVER['HTTP_X_CRON_TOKEN'] ?? ''));
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        erp_json(403, erp_error_payload('forbidden', 'Недостаточно прав', $requestId));
    }

    $summary = erp_approvals_notify_all_with_access($pdo, $config);
    erp_json(200, ['ok' => true, 'data' => $summary]);
}

