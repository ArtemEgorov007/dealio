<?php
declare(strict_types=1);

// Рассылка уведомлений авторам заявок, у которых сменился статус.
// Запускается по расписанию: экрана обработки заявок ещё нет, статус меняет
// снабжение напрямую в базе, поэтому событие ловим по расхождению статуса
// с уже сообщённым (см. erp_supply_notify_status_changes).
require_once __DIR__ . '/erp-cli-paths.php';

require_once erp_cli_api_src() . '/Bootstrap.php';

try {
    $config = erp_load_config();
    $pdo = erp_database($config);
    $summary = erp_supply_notify_status_changes($pdo, $config);
    fwrite(STDOUT, json_encode($summary, JSON_UNESCAPED_UNICODE) . PHP_EOL);
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
