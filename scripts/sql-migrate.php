<?php
declare(strict_types=1);

require_once __DIR__ . '/erp-cli-paths.php';

$apiSrc = erp_cli_api_src();
require_once $apiSrc . '/Database.php';
require_once $apiSrc . '/Migrations.php';

// Миграции применяет само подключение (см. erp_database), поэтому скрипт не
// «выполняет» их, а служит явным шагом деплоя и проверкой результата: сколько
// миграций лежит в каталоге и сколько из них база считает применёнными.
$pdo = erp_database(erp_load_config());

$applied = (int) $pdo->query('SELECT COUNT(*) FROM erp_schema_migrations')->fetchColumn();
$total = count(erp_migration_paths(erp_cli_migrations_dir()));

echo "ERP migrations applied: {$applied}/{$total}\n";

if ($applied < $total) {
    fwrite(STDERR, "Не все миграции применены\n");
    exit(1);
}
