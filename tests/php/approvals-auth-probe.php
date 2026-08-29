<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
require $root . '/tests/php/support/erp-test-http.php';
require $root . '/public/api/src/Session.php';
require $root . '/public/api/src/Auth.php';

$scenario = $argv[1] ?? '';
$config = ['session' => ['cookie_name' => 'erp_session', 'ttl_seconds' => 3600]];

$pdo = new PDO('sqlite::memory:');
$pdo->exec('CREATE TABLE erp_users (
    id INTEGER PRIMARY KEY,
    fio TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT "",
    department TEXT NOT NULL DEFAULT "",
    position TEXT NOT NULL DEFAULT "",
    status TEXT NOT NULL
)');
$pdo->exec('CREATE TABLE erp_user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    permission_code TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, permission_code)
)');

$pdo->exec("INSERT INTO erp_users VALUES (1, 'Тестов Тест', 'qa.approvals', 'hash', 'Менеджер', 'Офис', 'ПТО', 'Руководитель', 'Работает')");
$pdo->exec("INSERT INTO erp_user_permissions (user_id, permission_code, allowed) VALUES (1, 'badges', 1)");
$pdo->exec("INSERT INTO erp_user_permissions (user_id, permission_code, allowed) VALUES (1, 'approvals', 0)");

$user = $pdo->query('SELECT * FROM erp_users WHERE id = 1')->fetch(PDO::FETCH_ASSOC);

if ($scenario === 'require-user-no-session') {
    $_COOKIE = [];
    erp_require_user($pdo, $config, erp_request_id());
}

if ($scenario === 'require-permission-denied') {
    erp_require_permission($pdo, $user, 'approvals', erp_request_id());
}

fwrite(STDERR, "Unknown scenario: {$scenario}\n");
exit(2);
