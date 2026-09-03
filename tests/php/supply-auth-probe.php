<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
require $root . '/tests/php/support/erp-test-http.php';
require $root . '/public/api/src/Auth.php';
require $root . '/public/api/src/Supply.php';

$scenario = $argv[1] ?? '';

$pdo = new PDO('sqlite::memory:');
$pdo->exec('CREATE TABLE erp_user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    permission_code TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, permission_code)
)');

$actor = ['id' => 1];

if ($scenario === 'orders-only') {
    $pdo->exec("INSERT INTO erp_user_permissions (user_id, permission_code, allowed) VALUES (1, 'orders', 1)");
    erp_supply_require_orders_or_supply($pdo, $actor, erp_request_id());
    echo "200\n";
    exit(0);
}

if ($scenario === 'supply-only') {
    $pdo->exec("INSERT INTO erp_user_permissions (user_id, permission_code, allowed) VALUES (1, 'supply', 1)");
    erp_supply_require_orders_or_supply($pdo, $actor, erp_request_id());
    echo "200\n";
    exit(0);
}

if ($scenario === 'neither') {
    erp_supply_require_orders_or_supply($pdo, $actor, erp_request_id());
    echo "200\n";
    exit(0);
}

fwrite(STDERR, "Unknown scenario: {$scenario}\n");
exit(2);
