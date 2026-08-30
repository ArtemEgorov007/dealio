<?php
declare(strict_types=1);

/**
 * Импорт склада, заявок и согласований из выгрузок Google-таблицы «Склад».
 *
 * Ожидает CSV-файлы, выгруженные из листов, в каталоге ERP_IMPORT_DIR:
 *   Sklad.csv, Log.csv, Nomenklatura.csv, Zayavki.csv, Soglasovaniya.csv
 *
 * Импорт повторяемый: строки сопоставляются по своим естественным ключам,
 * повторный запуск обновляет, а не задваивает.
 *
 * Остаток из листа кладётся в opening_balance — движения из лога применяются
 * поверх него. Причина: текущие остатки в лог никогда не писались, там только
 * строки первичного импорта с нулевым количеством.
 */

require_once __DIR__ . '/erp-cli-paths.php';
require_once erp_cli_api_src() . '/Bootstrap.php';

$importDir = getenv('ERP_IMPORT_DIR') ?: (dirname(__DIR__) . '/tmp/sklad-csv');

function erp_import_number(string $value): float
{
    $normalized = str_replace(["\xC2\xA0", ' ', '₽'], '', trim($value));
    $normalized = str_replace(',', '.', $normalized);
    return $normalized !== '' && is_numeric($normalized) ? (float) $normalized : 0.0;
}

/** Даты в выгрузке — «29.08.2026». Пустое значение остаётся NULL. */
function erp_import_date(string $value): ?string
{
    $value = trim($value);
    if ($value === '') {
        return null;
    }
    $date = DateTimeImmutable::createFromFormat('d.m.Y', $value)
        ?: DateTimeImmutable::createFromFormat('d.m.y', $value);
    return $date ? $date->format('Y-m-d') : null;
}

function erp_import_rows(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException("Не найден файл выгрузки: $path");
    }
    $handle = fopen($path, 'r');
    $header = fgetcsv($handle);
    if (!$header) {
        throw new RuntimeException("Пустая выгрузка: $path");
    }
    $header = array_map(static fn ($h) => trim((string) $h), $header);

    $rows = [];
    while (($line = fgetcsv($handle)) !== false) {
        if ($line === [null] || $line === []) {
            continue;
        }
        $row = [];
        foreach ($header as $index => $name) {
            $row[$name] = (string) ($line[$index] ?? '');
        }
        $rows[] = $row;
    }
    fclose($handle);
    return $rows;
}

$config = erp_load_config();
$pdo = erp_database($config);
erp_apply_migrations($pdo, erp_cli_migrations_dir());

$summary = [];

// --- Номенклатура ---------------------------------------------------------
$rows = erp_import_rows($importDir . '/Nomenklatura.csv');
$statement = $pdo->prepare(
    'INSERT INTO erp_warehouse_items (name, category) VALUES (:name, :category)
     ON DUPLICATE KEY UPDATE category = VALUES(category)'
);
$count = 0;
foreach ($rows as $row) {
    $name = trim($row['Наименование товара'] ?? '');
    if ($name === '') {
        continue;
    }
    $statement->execute(['name' => $name, 'category' => trim($row['Категория'] ?? '')]);
    $count++;
}
$summary['номенклатура'] = $count;

// --- Остатки --------------------------------------------------------------
$rows = erp_import_rows($importDir . '/Sklad.csv');
$statement = $pdo->prepare(
    'INSERT INTO erp_warehouse_stock
        (stock_key, platform, cell, item_name, item_type, category, unit, opening_balance)
     VALUES (:stock_key, :platform, :cell, :item_name, :item_type, :category, :unit, :opening_balance)
     ON DUPLICATE KEY UPDATE
        unit = VALUES(unit),
        opening_balance = VALUES(opening_balance)'
);
$count = 0;
foreach ($rows as $row) {
    $key = trim($row['ID'] ?? '');
    if ($key === '') {
        continue;
    }
    $statement->execute([
        'stock_key' => $key,
        'platform' => trim($row['Площадка'] ?? ''),
        'cell' => trim($row['Ячейка хранения'] ?? ''),
        'item_name' => trim($row['Наименование'] ?? ''),
        'item_type' => trim($row['Тип'] ?? ''),
        'category' => trim($row['Категория'] ?? ''),
        'unit' => trim($row['Ед.изм.'] ?? ''),
        'opening_balance' => erp_import_number($row['Остаток'] ?? '0'),
    ]);
    $count++;
}
$summary['позиции склада'] = $count;

// --- Лог ------------------------------------------------------------------
// Строки первичного импорта идут без request_id: у них его нет в источнике,
// а UNIQUE по NULL повторы не блокирует. Чтобы повторный запуск не задваивал
// лог, сначала убираем ранее импортированные строки (у них request_id IS NULL).
$pdo->exec('DELETE FROM erp_warehouse_log WHERE request_id IS NULL');

$rows = erp_import_rows($importDir . '/Log.csv');
$statement = $pdo->prepare(
    'INSERT INTO erp_warehouse_log
        (occurred_at, platform, action, cell, item_name, item_type, category,
         quantity, unit, received_by, issued_by, recipient, stock_key, request_id)
     VALUES (:occurred_at, :platform, :action, :cell, :item_name, :item_type, :category,
             :quantity, :unit, :received_by, :issued_by, :recipient, :stock_key, NULL)'
);
$actionMap = ['Прием' => 'receipt', 'Приём' => 'receipt', 'Выдача' => 'issue', 'Перемещение' => 'transfer'];
$count = 0;
foreach ($rows as $row) {
    $key = trim($row['ID'] ?? '');
    $action = $actionMap[trim($row['Действие'] ?? '')] ?? null;
    if ($key === '' || $action === null) {
        continue;
    }
    $date = erp_import_date($row['Дата'] ?? '');
    $statement->execute([
        'occurred_at' => ($date ?? date('Y-m-d')) . ' 00:00:00',
        'platform' => trim($row['Площадка'] ?? ''),
        'action' => $action,
        'cell' => trim($row['Ячейка хранения'] ?? ''),
        'item_name' => trim($row['Наименование'] ?? ''),
        'item_type' => trim($row['Тип'] ?? ''),
        'category' => trim($row['Категория'] ?? ''),
        'quantity' => erp_import_number($row['Кол-во'] ?? '0'),
        'unit' => trim($row['Ед.изм.'] ?? ''),
        'received_by' => trim($row['Принял'] ?? ''),
        'issued_by' => trim($row['Выдал'] ?? ''),
        'recipient' => trim($row['Получил'] ?? ''),
        'stock_key' => $key,
    ]);
    $count++;
}
$summary['строки лога'] = $count;

// --- Заявки ---------------------------------------------------------------
$rows = erp_import_rows($importDir . '/Zayavki.csv');
$statement = $pdo->prepare(
    'INSERT INTO erp_supply_requests
        (request_code, requested_at, platform, employee_fio, department, item_name,
         quantity, unit, category, approver_fio, approved_at, invoice, status)
     VALUES (:request_code, :requested_at, :platform, :employee_fio, :department, :item_name,
             :quantity, :unit, :category, :approver_fio, :approved_at, :invoice, :status)
     ON DUPLICATE KEY UPDATE
        requested_at = VALUES(requested_at), platform = VALUES(platform),
        employee_fio = VALUES(employee_fio), department = VALUES(department),
        item_name = VALUES(item_name), quantity = VALUES(quantity), unit = VALUES(unit),
        category = VALUES(category), approver_fio = VALUES(approver_fio),
        approved_at = VALUES(approved_at), invoice = VALUES(invoice), status = VALUES(status)'
);
$count = 0;
foreach ($rows as $row) {
    $code = trim($row['Заявка'] ?? '');
    if ($code === '') {
        continue;
    }
    $statement->execute([
        'request_code' => $code,
        'requested_at' => erp_import_date($row['Дата заявки'] ?? '') ?? date('Y-m-d'),
        'platform' => trim($row['Площадка'] ?? ''),
        'employee_fio' => trim($row['Сотрудник'] ?? ''),
        'department' => trim($row['Отдел'] ?? ''),
        'item_name' => trim($row['Наименование товара'] ?? ''),
        'quantity' => erp_import_number($row['Кол-во'] ?? '0'),
        'unit' => trim($row['Ед.изм.'] ?? ''),
        'category' => trim($row['Категория'] ?? ''),
        'approver_fio' => trim($row['Согласование'] ?? '') ?: null,
        'approved_at' => erp_import_date($row['Дата согласования'] ?? ''),
        'invoice' => trim($row['Счет'] ?? '') ?: null,
        'status' => trim($row['Статус заявки'] ?? ''),
    ]);
    $count++;
}
$summary['заявки'] = $count;

// --- Согласования ---------------------------------------------------------
// Номер счёта неуникален, поэтому сопоставляем по номеру строки листа.
$rows = erp_import_rows($importDir . '/Soglasovaniya.csv');
$statement = $pdo->prepare(
    'INSERT INTO erp_approvals
        (invoice, contract, department, platform, status, amount, category,
         approver_fio, approved_ro_at, approved_gd_at, cancelled_at, invoice_url, sheet_row)
     VALUES (:invoice, :contract, :department, :platform, :status, :amount, :category,
             :approver_fio, :approved_ro_at, :approved_gd_at, :cancelled_at, :invoice_url, :sheet_row)
     ON DUPLICATE KEY UPDATE
        invoice = VALUES(invoice), contract = VALUES(contract), department = VALUES(department),
        platform = VALUES(platform), status = VALUES(status), amount = VALUES(amount),
        category = VALUES(category), approver_fio = VALUES(approver_fio),
        approved_ro_at = VALUES(approved_ro_at), approved_gd_at = VALUES(approved_gd_at),
        cancelled_at = VALUES(cancelled_at), invoice_url = VALUES(invoice_url)'
);
$count = 0;
foreach ($rows as $index => $row) {
    $invoice = trim($row['Счет'] ?? '');
    if ($invoice === '') {
        continue;
    }
    $statement->execute([
        'invoice' => $invoice,
        'contract' => trim($row['Договор'] ?? '') ?: null,
        'department' => trim($row['Отдел'] ?? ''),
        'platform' => trim($row['Площадка'] ?? ''),
        'status' => trim($row['Статус согласования'] ?? ''),
        'amount' => erp_import_number($row['Сумма счета'] ?? '0'),
        'category' => trim($row['Тип'] ?? ''),
        'approver_fio' => trim($row['Согласование руководителя'] ?? '') ?: null,
        'approved_ro_at' => erp_import_date($row['Дата РО'] ?? ''),
        'approved_gd_at' => erp_import_date($row['Дата ГД'] ?? ''),
        'cancelled_at' => erp_import_date($row['Отмена'] ?? ''),
        'invoice_url' => trim($row['Ссылка на счет'] ?? '') ?: null,
        // +2: строка 1 — заголовок, нумерация листа с единицы.
        'sheet_row' => $index + 2,
    ]);
    $count++;
}
$summary['согласования'] = $count;

fwrite(STDOUT, json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL);
