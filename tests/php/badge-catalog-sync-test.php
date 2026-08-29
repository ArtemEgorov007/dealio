<?php
declare(strict_types=1);

$sync = dirname(__DIR__, 2) . '/public/api/src/BadgeCatalogSync.php';
if (!is_file($sync)) {
    fwrite(STDERR, "Badge catalog synchronizer is missing\n");
    exit(1);
}

require $sync;

function expect_sync(bool $actual, string $message): void {
    if (!$actual) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }
}

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('CREATE TABLE erp_workshop_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workshop_id TEXT NOT NULL,
    badge_hash TEXT NOT NULL,
    badge_content TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    archived_at TEXT NULL,
    UNIQUE (workshop_id, badge_hash)
)');
$pdo->exec('CREATE TABLE erp_catalog_sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT NULL,
    source_badges INTEGER NOT NULL DEFAULT 0,
    active_badges INTEGER NOT NULL DEFAULT 0,
    archived_badges INTEGER NOT NULL DEFAULT 0,
    error_code TEXT NULL
)');

$first = erp_reconcile_badge_catalog($pdo, ['kolpino' => [' A-1 ', 'B-2', 'B-2']]);
expect_sync($first['active_badges'] === 2, 'Initial sync must activate unique source badges');
expect_sync($first['archived_badges'] === 0, 'Initial sync must not archive badges');

$second = erp_reconcile_badge_catalog($pdo, ['kolpino' => ['B-2', 'C-3']]);
expect_sync($second['active_badges'] === 2, 'Second snapshot must leave two active badges');
expect_sync($second['archived_badges'] === 1, 'Missing source badge must be archived, not deleted');

$rows = $pdo->query('SELECT badge_content, is_active FROM erp_workshop_badges ORDER BY badge_content')->fetchAll(PDO::FETCH_KEY_PAIR);
expect_sync($rows === ['A-1' => 0, 'B-2' => 1, 'C-3' => 1], 'Reconcile must preserve archived history and activate current snapshot');

$status = (string) $pdo->query('SELECT status FROM erp_catalog_sync_runs ORDER BY id DESC LIMIT 1')->fetchColumn();
expect_sync($status === 'completed', 'Successful sync must leave an audit record');

$payload = erp_badge_catalog_from_gas_payload([
    'ok' => true,
    'badges' => ['A-1', 'B-2'],
]);
expect_sync($payload === ['A-1', 'B-2'], 'GAS payload must expose only its badge list');

$pdo->exec("CREATE TRIGGER reject_fail_badge BEFORE INSERT ON erp_workshop_badges
    WHEN NEW.badge_content = 'FAIL' BEGIN SELECT RAISE(ABORT, 'forced failure'); END");
$failed = false;
try {
    erp_reconcile_badge_catalog($pdo, ['kolpino' => ['FAIL']]);
} catch (Throwable) {
    $failed = true;
}
expect_sync($failed, 'Source write failure must fail the sync');
$activeAfterFailure = (int) $pdo->query('SELECT COUNT(*) FROM erp_workshop_badges WHERE is_active = 1')->fetchColumn();
expect_sync($activeAfterFailure === 2, 'Failed sync must preserve the prior active catalog');
$failureStatus = (string) $pdo->query('SELECT status FROM erp_catalog_sync_runs ORDER BY id DESC LIMIT 1')->fetchColumn();
expect_sync($failureStatus === 'failed', 'Failed sync must be auditable');

echo "Badge catalog sync tests passed\n";
