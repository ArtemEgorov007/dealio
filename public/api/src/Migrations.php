<?php
declare(strict_types=1);

/**
 * @return list<string>
 */
function erp_migration_paths(string $directory): array
{
    $paths = glob(rtrim($directory, '/') . '/[0-9][0-9][0-9]_*.sql') ?: [];
    sort($paths, SORT_STRING);
    return array_values($paths);
}

function erp_apply_migrations(PDO $pdo, string $directory): int
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS erp_schema_migrations (
            migration_name VARCHAR(191) NOT NULL,
            applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            PRIMARY KEY (migration_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    // Применённые читаем одним запросом, а не по SELECT на каждый файл:
    // проверка идёт на каждом обращении к базе, а миграции меняются раз в
    // релиз, поэтому обычный путь — «ничего не применилось».
    $applied = $pdo->query('SELECT migration_name FROM erp_schema_migrations')->fetchAll(PDO::FETCH_COLUMN);
    $applied = array_flip(array_map('strval', $applied));

    $pending = array_filter(
        erp_migration_paths($directory),
        static fn (string $path): bool => !isset($applied[basename($path)]),
    );
    if ($pending === []) {
        return 0;
    }

    $recordApplied = $pdo->prepare(
        'INSERT INTO erp_schema_migrations (migration_name) VALUES (:migration_name)'
    );

    $count = 0;
    foreach ($pending as $path) {
        $sql = file_get_contents($path);
        if ($sql === false) {
            throw new RuntimeException('Migration file is unavailable: ' . basename($path));
        }
        foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
            $pdo->exec($statement);
        }
        $recordApplied->execute(['migration_name' => basename($path)]);
        $count++;
    }

    return $count;
}
