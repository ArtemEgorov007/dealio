<?php
declare(strict_types=1);

function erp_cli_api_src(): string
{
    $configured = getenv('ERP_API_SRC');
    $candidates = [
        is_string($configured) ? $configured : '',
        dirname(__DIR__) . '/public/api/src',
        dirname(__DIR__) . '/api/src',
    ];

    foreach ($candidates as $candidate) {
        if (is_file($candidate . '/Database.php')) {
            return $candidate;
        }
    }

    throw new RuntimeException('ERP API source directory is unavailable. Set ERP_API_SRC for an operations deployment.');
}

function erp_cli_migrations_dir(): string
{
    // Единственный канонический каталог — тот, что рядом с исходниками API:
    // его читает рантайм и только его заливает деплой.
    //
    // Раньше в списке стоял ещё и '<каталог скриптов>/../migrations'. На
    // сервере это отдельная копия в erp-ops, которая жила своей жизнью и
    // отстала на пять миграций: скрипт отчитывался по ней, а применялись
    // совсем другие файлы. Копию удалили, кандидат убран.
    $configured = getenv('ERP_MIGRATIONS_DIR');
    $candidates = [
        is_string($configured) ? $configured : '',
        dirname(erp_cli_api_src()) . '/migrations',
        dirname(__DIR__) . '/public/api/migrations',
    ];

    foreach ($candidates as $candidate) {
        if (is_dir($candidate)) {
            return $candidate;
        }
    }

    throw new RuntimeException('ERP migrations directory is unavailable. Set ERP_MIGRATIONS_DIR for an operations deployment.');
}
