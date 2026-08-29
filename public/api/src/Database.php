<?php
declare(strict_types=1);

function erp_load_config(): array
{
    // public/api/src -> site root -> /www -> /www/erp-api-private (outside any site docroot)
    $configPath = dirname(__DIR__, 2) . '/../erp-api-private/erp-api-config.php';
    $configPath = realpath(dirname($configPath)) !== false
        ? (rtrim(str_replace('\\', '/', realpath(dirname($configPath))), '/') . '/erp-api-config.php')
        : $configPath;

    if (!is_file($configPath)) {
        // Fallback absolute path used on reg.ru shared hosting.
        $configPath = '/www/erp-api-private/erp-api-config.php';
    }

    if (!is_file($configPath)) {
        throw new RuntimeException('ERP API configuration is unavailable.');
    }

    $config = require $configPath;
    if (!is_array($config) || !isset($config['db']['dsn'], $config['db']['user'], $config['db']['password'])) {
        throw new RuntimeException('ERP API configuration is invalid.');
    }

    return $config;
}

function erp_database(array $config): PDO
{
    return new PDO($config['db']['dsn'], $config['db']['user'], $config['db']['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}
