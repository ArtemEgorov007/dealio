<?php
declare(strict_types=1);

$scope = dirname(__DIR__, 2) . '/public/api/src/AccessScope.php';
if (!is_file($scope)) {
    fwrite(STDERR, "Access scope helper is missing\n");
    exit(1);
}

require $scope;

function expect_scope(bool $actual, string $message): void {
    if (!$actual) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }
}

expect_scope(erp_scope_user_id(['id' => 7, 'role' => 'Исполнитель']) === 7, 'Executor scope must be their own user id');
expect_scope(erp_scope_user_id(['id' => 7, 'role' => 'Менеджер']) === null, 'Manager scope must include all users');
expect_scope(erp_scope_user_id(['id' => 7, 'role' => 'Неизвестно']) === 7, 'Unknown roles must remain in personal scope');

$pdo = new PDO('sqlite::memory:');
$pdo->exec('CREATE TABLE erp_workshop_badges (workshop_id TEXT, badge_hash TEXT, is_active INTEGER)');
$hash = hash('sha256', 'B-42');
$pdo->prepare('INSERT INTO erp_workshop_badges VALUES (?, ?, 1)')->execute(['kolpino', $hash]);

expect_scope(erp_active_badge_exists($pdo, 'kolpino', 'B-42'), 'Existing active badge must be issuable');
expect_scope(!erp_active_badge_exists($pdo, 'kolpino', 'not-in-catalog'), 'Unknown badge must not be issuable');

echo "Badge authorization tests passed\n";
