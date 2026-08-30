<?php
declare(strict_types=1);

$migrations = dirname(__DIR__, 2) . '/public/api/src/Migrations.php';
if (!is_file($migrations)) {
    fwrite(STDERR, "Migration runner helper is missing\n");
    exit(1);
}

require $migrations;

function expect_migration(bool $actual, string $message): void {
    if (!$actual) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }
}

$paths = erp_migration_paths(dirname(__DIR__, 2) . '/public/api/migrations');
$names = array_map('basename', $paths);

expect_migration($names === [
    '001_erp_identity.sql',
    '002_erp_badges.sql',
    '003_erp_handover.sql',
    '004_erp_catalog_sync.sql',
    '005_erp_push.sql',
    '006_erp_approval_notifications.sql',
    '007_erp_warehouse.sql',
    '008_erp_supply_approvals.sql',
], 'All ERP migrations must run once in numeric order');

foreach ($paths as $path) {
    expect_migration(is_readable($path), 'Every discovered migration must be readable');
}

echo "Migration runner tests passed\n";
