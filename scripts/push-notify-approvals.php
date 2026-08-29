<?php
declare(strict_types=1);

// Пути берём из общего помощника: он одинаково находит исходники и миграции
// и в репозитории, и на сервере, и уважает ERP_API_SRC / ERP_MIGRATIONS_DIR.
// Раньше здесь считался собственный $root на уровень выше репозитория —
// дефолты были нерабочими и держались только на переменных окружения,
// которые подставляла python-обёртка.
require_once __DIR__ . '/erp-cli-paths.php';

$apiSrc = erp_cli_api_src();
$migrationsDir = erp_cli_migrations_dir();

require_once $apiSrc . '/Bootstrap.php';

try {
    $config = erp_load_config();
    $pdo = erp_database($config);
    erp_apply_migrations($pdo, $migrationsDir);
    $summary = erp_push_notify_pending_approvals($pdo, $config);
    fwrite(STDOUT, json_encode($summary, JSON_UNESCAPED_UNICODE) . PHP_EOL);
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
