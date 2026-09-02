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
// Сколько ждать подтверждений показа перед печатью отчёта. Ноль — не ждать.
$waitSeconds = max(0, min(120, (int) ($argv[4] ?? 25)));

if ($title === '' || $body === '') {
    fwrite(STDERR, "Использование: php push-broadcast.php \"Заголовок\" \"Текст\" [/путь] [секунд ожидания]\n");
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

    // Номер рассылки: по нему собирается отчёт о доставке, в том числе тот,
    // что придёт уже после завершения скрипта.
    $broadcastId = 'erp-broadcast-' . gmdate('Ymd-His');

    // Кто выпал из рассылки и почему.
    //
    // Человек исчезает из получателей молча: подписку отозвали, сотрудника
    // перевели в неработающие — счётчик просто становится меньше, и заметить
    // это можно, только помня прошлый прогон наизусть. Показываем выбывших
    // рядом с получателями, чтобы «Максима больше нет в списке» было видно
    // сразу, а не через две рассылки.
    $excluded = $pdo->query(
        "SELECT u.fio,
                CASE WHEN u.status <> 'Работает' THEN CONCAT('сотрудник: ', u.status)
                     ELSE 'подписка отозвана' END AS reason,
                COUNT(*) AS count
         FROM erp_push_subscriptions s
         JOIN erp_users u ON u.id = s.user_id
         WHERE s.revoked_at IS NOT NULL OR u.status <> 'Работает'
         GROUP BY u.fio, reason
         ORDER BY u.fio"
    )->fetchAll(PDO::FETCH_ASSOC);

    // Берём только живые подписки: у сотрудника их может быть несколько
    // (телефон и рабочий компьютер), отозванные пропускаем.
    $rows = $pdo->query(
        'SELECT s.user_id, s.endpoint, s.p256dh, s.auth, s.user_agent, s.created_at, u.fio
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
    $devices = [];
    foreach ($rows as $row) {
        $recipients[(int) $row['user_id']] = (string) $row['fio'];

        // Свой токен на каждую подписку: воркер вернёт именно его, и станет
        // видно не только «принято push-сервисом», но и «показано на экране».
        $token = erp_push_open_delivery(
            $pdo,
            $broadcastId,
            (int) $row['user_id'],
            (string) $row['endpoint'],
            (string) $row['user_agent'],
            $title,
        );

        // «Отправлено 5» ничего не говорит о том, на что именно отправлено:
        // push-сервис принимает сообщение и для устройства, где уведомления
        // потом выключили. Показываем, чьи это подписки, через какой сервис и
        // какой давности — по этому видно, есть ли у человека живая подписка
        // с телефона.
        $devices[] = [
            'fio' => (string) $row['fio'],
            'сервис' => parse_url((string) $row['endpoint'], PHP_URL_HOST) ?: '?',
            'устройство' => erp_push_device_label((string) $row['user_agent']),
            'подписке дней' => (int) ((time() - strtotime((string) $row['created_at'])) / 86400),
        ];

        $webPush->queueNotification(
            Minishlink\WebPush\Subscription::create([
                'endpoint' => (string) $row['endpoint'],
                'keys' => ['p256dh' => (string) $row['p256dh'], 'auth' => (string) $row['auth']],
            ]),
            json_encode([
                'title' => $title,
                'body' => $body,
                'url' => $url,
                'tag' => $broadcastId,
                'badgeCount' => 1,
                'deliveryToken' => $token,
            ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
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

    // Ждём подтверждений от устройств. Включённый телефон отстукивает за
    // секунды, спящий — когда проснётся, поэтому это не «сколько дошло
    // всего», а «сколько дошло сразу». Остальное досчитывается позже по
    // номеру рассылки: строки в erp_push_deliveries никуда не денутся.
    if ($waitSeconds > 0) {
        sleep($waitSeconds);
    }
    $delivery = erp_push_delivery_report($pdo, $broadcastId);

    fwrite(STDOUT, json_encode([
        'рассылка' => $broadcastId,
        'подписок' => count($rows),
        'сотрудников' => count($recipients),
        'принято сервисом' => $sent,
        'отказов' => count($failures),
        // Главное отличие от прежнего отчёта: «принято push-сервисом» — это
        // ещё не «показано человеку». Ждали столько-то секунд, вот сколько
        // устройств успело подтвердить показ.
        'показано за ' . $waitSeconds . ' с' => $delivery['показано'] . ' из ' . $delivery['всего'],
        'получатели' => array_values($recipients),
        // Выбывшие — рядом с получателями: иначе исчезновение человека из
        // рассылки видно только по уменьшившемуся счётчику.
        'не в рассылке' => array_map(static fn (array $r): string => sprintf(
            '%s — %s (%d)',
            $r['fio'],
            $r['reason'],
            (int) $r['count'],
        ), $excluded),
        'устройства' => $devices,
        'доставка' => $delivery['подробно'],
        'отказы' => $failures,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL);

    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
