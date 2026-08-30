<?php
declare(strict_types=1);

$importer = dirname(__DIR__, 2) . '/scripts/sql-import-legacy-employees.php';
if (!is_file($importer)) {
    fwrite(STDERR, "Employee importer is missing\n");
    exit(1);
}

require $importer;

function expect_true(bool $actual, string $message): void {
    if (!$actual) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }
}

expect_true(erp_normalize_login(' Manager ') === 'manager', 'Login must normalize trim and case');
expect_true(erp_normalize_login('') === '', 'Empty login stays empty');

$prepared = erp_prepare_legacy_employee([
    'ID' => 42,
    'ФИО' => 'Тестовый Сотрудник',
    'Логин' => 'Test.User',
    'Пароль' => 'Abc123Xyz9',
    'Статус' => 'Работает',
]);

expect_true($prepared['login'] === 'test.user', 'Prepared login must be normalized');
expect_true(password_verify('Abc123Xyz9', $prepared['password_hash']), 'Legacy password must be hashed');
expect_true(!array_key_exists('password', $prepared), 'Prepared record must not keep open password');

$invalid = false;
try {
    erp_prepare_legacy_employee([
        'ID' => 43,
        'ФИО' => 'Без логина',
        'Логин' => '',
        'Пароль' => '',
    ]);
} catch (InvalidArgumentException) {
    $invalid = true;
}

expect_true($invalid, 'Rows without credentials must be rejected before import');

echo "Schema importer tests passed\n";
