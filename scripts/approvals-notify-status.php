<?php
declare(strict_types=1);

// Рассылка уведомлений авторам счетов, у которых статус согласования
// разошёлся с уже сообщённым. Подстраховка на случай, если мгновенная
// отправка сразу после решения (erp_approvals_decide/erp_supply_work_create_invoice)
// не удалась — см. erp_approvals_notify_status_changes.
require_once __DIR__ . '/erp-cli-paths.php';

require_once erp_cli_api_src() . '/Bootstrap.php';

try {
    $config = erp_load_config();
    $pdo = erp_database($config);
    $summary = erp_approvals_notify_status_changes($pdo, $config);
    fwrite(STDOUT, json_encode($summary, JSON_UNESCAPED_UNICODE) . PHP_EOL);
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
