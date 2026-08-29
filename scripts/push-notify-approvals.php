<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$apiSrc = getenv('ERP_API_SRC') ?: ($root . '/public/api/src');
$migrationsDir = getenv('ERP_MIGRATIONS_DIR') ?: ($root . '/database/migrations');

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
