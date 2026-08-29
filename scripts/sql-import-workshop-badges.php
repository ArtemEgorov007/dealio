<?php
declare(strict_types=1);

require_once __DIR__ . '/erp-cli-paths.php';

$apiSrc = erp_cli_api_src();
require_once $apiSrc . '/BadgeCatalogSync.php';
require_once $apiSrc . '/Database.php';

/**
 * CLI/helper wrapper — production import uses public/api/src/BadgeImport.php.
 *
 * @param array{kolpino?: string[], volkhonka?: string[]} $catalog
 * @return array{imported:int, skipped:int, workshops:array<string,int>}
 */
function erp_import_workshop_badges_cli(PDO $pdo, array $catalog): array
{
    return erp_reconcile_badge_catalog($pdo, $catalog);
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $config = erp_load_config();
    $result = erp_import_workshop_badges_cli(erp_database($config), erp_fetch_badge_catalog_from_gas($config));
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
}
