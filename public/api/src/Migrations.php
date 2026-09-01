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
        foreach (erp_migration_statements($sql) as $index => $statement) {
            try {
                $pdo->exec($statement);
            } catch (Throwable $error) {
                // DDL в MySQL коммитится неявно, откатить середину миграции
                // нельзя. Значит цена ошибки — база в промежуточном состоянии,
                // и единственное, что мы можем дать человеку, это точное место.
                throw new RuntimeException(sprintf(
                    'Migration %s failed on statement #%d: %s',
                    basename($path),
                    $index + 1,
                    $error->getMessage()
                ), 0, $error);
            }
        }
        $recordApplied->execute(['migration_name' => basename($path)]);
        $count++;
    }

    return $count;
}

/**
 * Разбор файла миграции на отдельные выражения.
 *
 * Наивный explode(';') разрывал файл по точке с запятой внутри комментария:
 * первая половина миграции применялась, вторая падала, миграция не
 * записывалась как применённая — и повторный запуск спотыкался уже об
 * «Duplicate column name». База оставалась в состоянии, из которого не
 * выбраться без ручной правки.
 *
 * Поэтому идём по тексту и разделяем только те «;», что лежат вне строк,
 * кавычек и комментариев.
 *
 * @return list<string>
 */
function erp_migration_statements(string $sql): array
{
    $statements = [];
    $current = '';
    $length = strlen($sql);
    $quote = null;

    for ($i = 0; $i < $length; $i++) {
        $char = $sql[$i];

        if ($quote !== null) {
            $current .= $char;
            // Экранирование внутри строки: \' не закрывает её.
            if ($char === '\\' && $i + 1 < $length) {
                $current .= $sql[++$i];
                continue;
            }
            if ($char === $quote) {
                $quote = null;
            }
            continue;
        }

        if ($char === "'" || $char === '"' || $char === '`') {
            $quote = $char;
            $current .= $char;
            continue;
        }

        // Строчный комментарий: -- до конца строки.
        if ($char === '-' && ($sql[$i + 1] ?? '') === '-') {
            $newline = strpos($sql, "\n", $i);
            if ($newline === false) {
                break;
            }
            $current .= "\n";
            $i = $newline;
            continue;
        }

        // Блочный комментарий.
        if ($char === '/' && ($sql[$i + 1] ?? '') === '*') {
            $end = strpos($sql, '*/', $i + 2);
            if ($end === false) {
                break;
            }
            $i = $end + 1;
            continue;
        }

        if ($char === ';') {
            $statement = trim($current);
            if ($statement !== '') {
                $statements[] = $statement;
            }
            $current = '';
            continue;
        }

        $current .= $char;
    }

    $tail = trim($current);
    if ($tail !== '') {
        $statements[] = $tail;
    }

    return $statements;
}
