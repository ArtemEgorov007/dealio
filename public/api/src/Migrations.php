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
    $alreadyApplied = $pdo->prepare(
        'SELECT 1 FROM erp_schema_migrations WHERE migration_name = :migration_name LIMIT 1'
    );
    $recordApplied = $pdo->prepare(
        'INSERT INTO erp_schema_migrations (migration_name) VALUES (:migration_name)'
    );
    $applied = 0;
    foreach (erp_migration_paths($directory) as $path) {
        $name = basename($path);
        $alreadyApplied->execute(['migration_name' => $name]);
        if ($alreadyApplied->fetchColumn()) {
            continue;
        }
        $sql = file_get_contents($path);
        if ($sql === false) {
            throw new RuntimeException('Migration file is unavailable: ' . basename($path));
        }
        foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
            $pdo->exec($statement);
        }
        $recordApplied->execute(['migration_name' => $name]);
        $applied++;
    }
    return $applied;
}
