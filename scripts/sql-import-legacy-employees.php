<?php
declare(strict_types=1);

function erp_normalize_login(mixed $login): string
{
    $value = trim((string) $login);
    return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
}

function erp_prepare_legacy_employee(array $row): array
{
    $login = erp_normalize_login($row['Логин'] ?? '');
    $password = (string) ($row['Пароль'] ?? '');
    if ($login === '' || $password === '') {
        throw new InvalidArgumentException('Legacy employee requires login and password.');
    }

    return [
        'legacy_employee_id' => (int) ($row['ID'] ?? 0),
        'fio' => trim((string) ($row['ФИО'] ?? '')),
        'login' => $login,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'role' => trim((string) ($row['Роль'] ?? 'Исполнитель')),
        'platform' => trim((string) ($row['Площадка'] ?? '')),
        'department' => trim((string) ($row['Отдел'] ?? '')),
        'position' => trim((string) ($row['Должность'] ?? '')),
        'status' => trim((string) ($row['Статус'] ?? 'Работает')),
    ];
}

function erp_permission_map(): array
{
    return [
        'Доступ к биркам' => 'badges',
        'Доступ к промерам' => 'measurements',
        'Доступ к упаковкам' => 'packing',
        'Доступ к отчетам' => 'reports',
        'Право согласования' => 'approvals',
        'Заказ снабжения' => 'orders',
        'Работа со снабжением' => 'supply',
        'Доступ к складу' => 'warehouse',
        'Доступ к сдаче' => 'handover',
        'Управление кадрами' => 'personnel',
    ];
}

function erp_import_legacy_employees(PDO $pdo, bool $dryRun): array
{
    $legacyTable = chr(96) . 'Сотрудники' . chr(96);
    $rows = $pdo->query('SELECT * FROM ' . $legacyTable)->fetchAll(PDO::FETCH_ASSOC);
    $seen = [];
    $duplicateCount = 0;
    $invalidCount = 0;
    $prepared = [];

    foreach ($rows as $row) {
        try {
            $employee = erp_prepare_legacy_employee($row);
        } catch (InvalidArgumentException) {
            $invalidCount++;
            continue;
        }
        if (isset($seen[$employee['login']])) {
            $duplicateCount++;
            continue;
        }
        $seen[$employee['login']] = true;
        $prepared[] = [$employee, $row];
    }

    if ($dryRun) {
        return [
            'source' => count($rows),
            'eligible' => count($prepared),
            'invalid' => $invalidCount,
            'duplicate_count' => $duplicateCount,
        ];
    }

    $pdo->beginTransaction();
    try {
        $existing = $pdo->query('SELECT legacy_employee_id FROM erp_users WHERE legacy_employee_id IS NOT NULL')->fetchAll(PDO::FETCH_COLUMN);
        $existingIds = array_fill_keys(array_map('strval', $existing), true);
        $existingLogins = array_fill_keys(
            array_map('strval', $pdo->query('SELECT login FROM erp_users')->fetchAll(PDO::FETCH_COLUMN)),
            true
        );
        $insertUser = $pdo->prepare('INSERT INTO erp_users (legacy_employee_id, fio, login, password_hash, role, platform, department, position, status) VALUES (:legacy_employee_id, :fio, :login, :password_hash, :role, :platform, :department, :position, :status)');
        $insertPermission = $pdo->prepare('INSERT INTO erp_user_permissions (user_id, permission_code, allowed) VALUES (:user_id, :permission_code, :allowed)');
        $imported = 0;
        $skipped = 0;

        foreach ($prepared as [$employee, $source]) {
            $legacyId = (string) $employee['legacy_employee_id'];
            if ($employee['legacy_employee_id'] <= 0 || isset($existingIds[$legacyId]) || isset($existingLogins[$employee['login']])) {
                $skipped++;
                continue;
            }
            $insertUser->execute($employee);
            $userId = (int) $pdo->lastInsertId();
            $existingIds[$legacyId] = true;
            $existingLogins[$employee['login']] = true;
            foreach (erp_permission_map() as $column => $code) {
                $insertPermission->execute([
                    'user_id' => $userId,
                    'permission_code' => $code,
                    'allowed' => trim((string) ($source[$column] ?? '')) === 'Да' ? 1 : 0,
                ]);
            }
            $imported++;
        }

        if ($imported + $skipped + $duplicateCount + $invalidCount !== count($rows)) {
            throw new RuntimeException('Legacy employee reconciliation failed.');
        }
        $pdo->commit();
        return [
            'source' => count($rows),
            'imported' => $imported,
            'skipped_existing' => $skipped,
            'invalid' => $invalidCount,
            'duplicate_count' => $duplicateCount,
        ];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    require_once __DIR__ . '/../public/api/src/Database.php';
    $result = erp_import_legacy_employees(erp_database(erp_load_config()), in_array('--dry-run', $argv, true));
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
}
