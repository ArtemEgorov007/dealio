<?php
declare(strict_types=1);

require_once __DIR__ . '/erp-cli-paths.php';

$apiSrc = erp_cli_api_src();
require_once $apiSrc . '/Database.php';
require_once $apiSrc . '/Migrations.php';

$pdo = erp_database(erp_load_config());
$count = erp_apply_migrations($pdo, erp_cli_migrations_dir());
echo "ERP migrations completed: {$count}\n";
