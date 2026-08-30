<?php
declare(strict_types=1);

// Разовая рассылка системного уведомления всем сотрудникам с активной
// подпиской. Нужна на выкатке обновления: остальные рассылки привязаны к
// событию (согласование, смена статуса заявки), а объявление — нет.
//
// Запуск на сервере:
//   php scripts/push-broadcast.php "Заголовок" "Текст" [/путь-в-приложении]
require_once __DIR__ . '/erp-cli-paths.php';

require_once erp_cli_api_src() . '/Bootstrap.php';

$title = trim((string) ($argv[1] ?? ''));
$body = trim((string) ($argv[2] ?? ''));
$url = trim((string) ($argv[3] ?? '/register'));

if ($title === '' || $body === '') {
    fwrite(STDERR, "Использование: php push-broadcast.php \"Заголовок\" \"Текст\" [/путь]\n");
    exit(2);
}

try {
    $config = erp_load_config();
    $pdo = erp_database($config);

    erp_push_autoload();
    $keys = erp_push_config($config);

    $webPush = new Minishlink\WebPush\WebPush([
        'VAPID' => [
            'subject' => $keys['subject'],
            'publicKey' => $keys['publicKey'],
            'privateKey' => $keys['privateKey'],
        ],
    ]);

    $payload = json_encode([
        'title' => $title,
        'body' => $body,
        'url' => $url,
        'tag' => 'erp-broadcast-' . gmdate('Ymd-His'),
        'badgeCount' => 1,
    ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

    // Берём только живые подписки: у сотрудника их может быть несколько
    // (телефон и рабочий компьютер), отозванные пропускаем.
    $rows = $pdo->query(
        'SELECT s.user_id, s.endpoint, s.p256dh, s.auth, u.fio
         FROM erp_push_subscriptions s
         JOIN erp_users u ON u.id = s.user_id
         WHERE s.revoked_at IS NULL AND u.status = \'Работает\'
         ORDER BY u.fio'
    )->fetchAll(PDO::FETCH_ASSOC);

    if ($rows === []) {
        fwrite(STDOUT, json_encode(
            ['queued' => 0, 'note' => 'нет активных подписок'],
            JSON_UNESCAPED_UNICODE
        ) . PHP_EOL);
        exit(0);
    }

    $recipients = [];
    foreach ($rows as $row) {
        $recipients[(int) $row['user_id']] = (string) $row['fio'];
        $webPush->queueNotification(
            Minishlink\WebPush\Subscription::create([
                'endpoint' => (string) $row['endpoint'],
                'keys' => ['p256dh' => (string) $row['p256dh'], 'auth' => (string) $row['auth']],
            ]),
            $payload,
            ['TTL' => 86400, 'urgency' => 'normal'],
        );
    }

    $sent = 0;
    $failures = [];
    foreach ($webPush->flush() as $report) {
        if ($report->isSuccess()) {
            $sent++;
            continue;
        }
        $failures[] = ['endpoint' => substr($report->getEndpoint(), 0, 60), 'reason' => $report->getReason()];
    }

    fwrite(STDOUT, json_encode([
        'subscriptions' => count($rows),
        'employees' => count($recipients),
        'sent' => $sent,
        'failed' => count($failures),
        'recipients' => array_values($recipients),
        'failures' => $failures,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL);

    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
