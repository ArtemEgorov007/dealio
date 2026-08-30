<?php
declare(strict_types=1);

// Путь к исходникам берём из общего помощника: он одинаково находит их и в
// репозитории, и на сервере, и уважает ERP_API_SRC. Раньше здесь считался
// собственный $root на уровень выше репозитория — дефолты были нерабочими и
// держались только на переменных окружения, которые подставляла
// python-обёртка.
require_once __DIR__ . '/erp-cli-paths.php';

$apiSrc = erp_cli_api_src();

require_once $apiSrc . '/Bootstrap.php';

try {
    $config = erp_load_config();
    $pdo = erp_database($config);
    $summary = erp_push_notify_pending_approvals($pdo, $config);
    fwrite(STDOUT, json_encode($summary, JSON_UNESCAPED_UNICODE) . PHP_EOL);
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
