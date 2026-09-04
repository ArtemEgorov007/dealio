<?php
declare(strict_types=1);

// ТЗ: «после создания этой категории, задать всем пользователям "Нет"».
// erp_permission_codes() — единственное место, где заводится код права; раз
// он не в erp_user_permissions по умолчанию для существующих строк,
// erp_user_access() обязана вернуть false без единой явной записи.

$root = dirname(__DIR__, 2);
require $root . '/public/api/src/Auth.php';

function expect_intake(bool $actual, string $message): void
{
    if (!$actual) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }
}

expect_intake(in_array('intake', erp_permission_codes(), true), 'Право intake не заведено в erp_permission_codes()');

$pdo = new PDO('sqlite::memory:');
$pdo->exec('CREATE TABLE erp_user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    permission_code TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, permission_code)
)');
// Сотрудник существует давно и держит другие права — новый код не должен
// появиться у него сам по себе.
$pdo->exec("INSERT INTO erp_user_permissions (user_id, permission_code, allowed) VALUES (1, 'badges', 1)");

$access = erp_user_access($pdo, 1);
expect_intake(array_key_exists('intake', $access), 'erp_user_access() не вернул ключ intake вовсе');
expect_intake($access['intake'] === false, 'Существующий сотрудник без явной строки должен получить intake=false, а не true');
expect_intake($access['badges'] === true, 'Другие права существующего сотрудника не должны были пострадать');

$pdo->exec("INSERT INTO erp_user_permissions (user_id, permission_code, allowed) VALUES (1, 'intake', 1)");
$granted = erp_user_access($pdo, 1);
expect_intake($granted['intake'] === true, 'Явно выданное право intake должно читаться как true');

echo "Intake authorization tests passed\n";
