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

$directory = dirname(__DIR__, 2) . '/public/api/migrations';
$paths = erp_migration_paths($directory);
$names = array_map('basename', $paths);

// Список не хардкодим: раньше он устаревал при каждой новой миграции и тест
// падал на корректном изменении. Проверяем сами инварианты выполнения.
$onDisk = array_map('basename', glob($directory . '/*.sql') ?: []);
sort($onDisk, SORT_STRING);

expect_migration($onDisk !== [], 'Migrations directory must not be empty');
expect_migration(count($names) === count(array_unique($names)), 'No migration may run twice');

$discovered = $names;
sort($discovered, SORT_STRING);
expect_migration($discovered === $onDisk, 'Every migration file on disk must be discovered by the runner');

$expectedOrder = $names;
usort($expectedOrder, static fn (string $a, string $b): int => strcmp($a, $b));
expect_migration($names === $expectedOrder, 'All ERP migrations must run once in numeric order');

// Номера идут подряд от 001: пропуск обычно значит потерянный при переносе
// файл, а дубликат — две миграции, одна из которых молча не применится.
$numbers = [];
foreach ($names as $name) {
    expect_migration((bool) preg_match('/^(\d{3})_[a-z0-9_]+\.sql$/', $name, $match), "Migration {$name} must be named NNN_lower_snake.sql");
    $numbers[] = (int) $match[1];
}
expect_migration($numbers === range(1, count($numbers)), 'Migration numbers must be contiguous starting at 001');

foreach ($paths as $path) {
    expect_migration(is_readable($path), 'Every discovered migration must be readable');
}

echo "Migration runner tests passed\n";
