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
    // Единственный канонический каталог — public/api/migrations: его же читает
    // рантайм (Approvals.php / Push.php) и только его заливает деплой API.
    // Вариант '/migrations' — это тот же каталог, но уже на сервере, где корень
    // приложения совпадает с public/api.
    $configured = getenv('ERP_MIGRATIONS_DIR');
    $candidates = [
        is_string($configured) ? $configured : '',
        dirname(__DIR__) . '/public/api/migrations',
        dirname(__DIR__) . '/migrations',
    ];

    foreach ($candidates as $candidate) {
        if (is_dir($candidate)) {
            return $candidate;
        }
    }

    throw new RuntimeException('ERP migrations directory is unavailable. Set ERP_MIGRATIONS_DIR for an operations deployment.');
}
