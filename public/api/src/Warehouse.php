<?php
declare(strict_types=1);

/**
 * Склад на SQL: номенклатура, остатки и движения.
 *
 * Остаток нигде не хранится полем — он приходит из представления
 * erp_warehouse_balance (начальный остаток плюс движения по логу).
 * Обоснование: docs/superpowers/specs/2026-08-30-warehouse-supply-sql-design.md
 */

/** Составной ключ позиции: тот же формат, что в листах «Склад» и «Лог». */
function erp_warehouse_stock_key(string $platform, string $cell, string $name, string $type, string $category): string
{
    return implode('|', [$platform, $cell, $name, $type, $category]);
}

function erp_warehouse_number(mixed $value): float
{
    if (is_int($value) || is_float($value)) {
        return (float) $value;
    }
    if (!is_string($value)) {
        return 0.0;
    }
    // Источник даёт «40 000,00 ₽» и «1 234,5»: неразрывные пробелы,
    // запятая как разделитель дробной части, знак валюты.
    $normalized = str_replace(["\xC2\xA0", ' ', '₽'], '', trim($value));
    $normalized = str_replace(',', '.', $normalized);
    if ($normalized === '' || !is_numeric($normalized)) {
        return 0.0;
    }
    return (float) $normalized;
}

/** Тело POST-запроса. Формат ошибки — как в остальных обработчиках. */
function erp_warehouse_input(string $requestId): array
{
    $raw = file_get_contents('php://input') ?: '';
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }
    return $payload;
}

/**
 * Запись в аудит. Ссылаемся на строку лога по числовому id: составной ключ
 * позиции доходит до 512 символов и в entity_type VARCHAR(64) не помещается,
 * а сам ключ и так лежит в строке лога.
 */
function erp_warehouse_audit(PDO $pdo, ?int $actorId, string $action, int $logId, string $requestId): void
{
    $statement = $pdo->prepare(
        'INSERT INTO erp_audit_log (actor_user_id, action, entity_type, entity_id, request_id)
         VALUES (:actor, :action, :entity_type, :entity_id, :request_id)'
    );
    $statement->execute([
        'actor' => $actorId,
        'action' => $action,
        'entity_type' => 'warehouse_log',
        'entity_id' => $logId,
        'request_id' => $requestId,
    ]);
}

function erp_warehouse_categories(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'warehouse', $requestId);

    $rows = $pdo->query(
        'SELECT DISTINCT category FROM erp_warehouse_items WHERE category <> \'\' ORDER BY category'
    )->fetchAll(PDO::FETCH_COLUMN);

    erp_json(200, ['ok' => true, 'data' => ['categories' => array_values($rows)]]);
}

function erp_warehouse_platforms(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'warehouse', $requestId);

    $rows = $pdo->query(
        'SELECT DISTINCT platform FROM erp_warehouse_stock WHERE platform <> \'\' ORDER BY platform'
    )->fetchAll(PDO::FETCH_COLUMN);

    erp_json(200, ['ok' => true, 'data' => ['platforms' => array_values($rows)]]);
}

function erp_warehouse_items(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'warehouse', $requestId);

    $category = trim((string) ($_GET['category'] ?? ''));
    $statement = $pdo->prepare(
        'SELECT name FROM erp_warehouse_items WHERE category = :category ORDER BY name'
    );
    $statement->execute(['category' => $category]);

    erp_json(200, ['ok' => true, 'data' => ['items' => $statement->fetchAll(PDO::FETCH_COLUMN)]]);
}

/**
 * Остатки площадки. Позиции с нулевым остатком не отдаём: на экране выдачи
 * выбирать нечего, а список из сотен нулей мешает найти нужное.
 */
function erp_warehouse_stock(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'warehouse', $requestId);

    $platform = trim((string) ($_GET['platform'] ?? ''));
    $category = trim((string) ($_GET['category'] ?? ''));

    $sql = 'SELECT cell, item_name, item_type, category, unit, balance
            FROM erp_warehouse_balance
            WHERE platform = :platform AND balance > 0';
    $params = ['platform' => $platform];

    if ($category !== '') {
        $sql .= ' AND category = :category';
        $params['category'] = $category;
    }
    $sql .= ' ORDER BY item_name';

    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    $items = [];
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $items[] = [
            'cell' => (string) $row['cell'],
            'name' => (string) $row['item_name'],
            'type' => (string) $row['item_type'],
            'category' => (string) $row['category'],
            'balance' => (float) $row['balance'],
            'unit' => (string) $row['unit'],
        ];
    }

    erp_json(200, ['ok' => true, 'data' => ['items' => $items]]);
}

/**
 * Общая запись движения для приёма и выдачи.
 *
 * Позиция создаётся при первом приёме с нулевым начальным остатком: сам
 * приём уже лежит в логе и попадёт в расчёт, иначе он учёлся бы дважды.
 */
function erp_warehouse_record_movement(PDO $pdo, array $actor, string $action, array $input, string $requestId): void
{
    $platform = trim((string) ($input['platform'] ?? ''));
    $cell = trim((string) ($input['cell'] ?? ''));
    $name = trim((string) ($input['name'] ?? ''));
    $type = trim((string) ($input['type'] ?? ''));
    $unit = trim((string) ($input['unit'] ?? ''));
    $quantity = erp_warehouse_number($input['qty'] ?? 0);
    $clientRequestId = trim((string) ($input['requestId'] ?? ''));

    if ($platform === '' || $name === '' || $quantity <= 0) {
        erp_json(422, erp_error_payload('invalid_input', 'Заполните площадку, наименование и количество', $requestId));
    }

    // Категория берётся из справочника, а не от клиента: она часть ключа
    // позиции, и расхождение в ней раздвоило бы остаток по одному товару.
    $categoryStatement = $pdo->prepare('SELECT category FROM erp_warehouse_items WHERE name = :name LIMIT 1');
    $categoryStatement->execute(['name' => $name]);
    $category = (string) ($categoryStatement->fetchColumn() ?: '');

    $stockKey = erp_warehouse_stock_key($platform, $cell, $name, $type, $category);

    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            'INSERT INTO erp_warehouse_stock (stock_key, platform, cell, item_name, item_type, category, unit, opening_balance)
             VALUES (:stock_key, :platform, :cell, :item_name, :item_type, :category, :unit, 0)
             ON DUPLICATE KEY UPDATE unit = VALUES(unit)'
        )->execute([
            'stock_key' => $stockKey,
            'platform' => $platform,
            'cell' => $cell,
            'item_name' => $name,
            'item_type' => $type,
            'category' => $category,
            'unit' => $unit,
        ]);

        if ($action === 'issue') {
            $balanceStatement = $pdo->prepare('SELECT balance FROM erp_warehouse_balance WHERE stock_key = :stock_key');
            $balanceStatement->execute(['stock_key' => $stockKey]);
            $balance = erp_warehouse_number($balanceStatement->fetchColumn());
            if ($quantity > $balance) {
                $pdo->rollBack();
                erp_json(409, erp_error_payload('insufficient_balance', 'На складе меньше, чем выдаётся', $requestId));
            }
        }

        $pdo->prepare(
            'INSERT INTO erp_warehouse_log
                (occurred_at, platform, action, cell, item_name, item_type, category,
                 quantity, unit, received_by, issued_by, recipient, stock_key, request_id)
             VALUES
                (NOW(6), :platform, :action, :cell, :item_name, :item_type, :category,
                 :quantity, :unit, :received_by, :issued_by, :recipient, :stock_key, :request_id)'
        )->execute([
            'platform' => $platform,
            'action' => $action,
            'cell' => $cell,
            'item_name' => $name,
            'item_type' => $type,
            'category' => $category,
            'quantity' => $quantity,
            'unit' => $unit,
            'received_by' => $action === 'receipt' ? trim((string) ($input['fio'] ?? '')) : '',
            'issued_by' => $action === 'issue' ? trim((string) ($input['fio'] ?? '')) : '',
            'recipient' => trim((string) ($input['recipientFio'] ?? '')),
            'stock_key' => $stockKey,
            'request_id' => $clientRequestId !== '' ? $clientRequestId : null,
        ]);

        $logId = (int) $pdo->lastInsertId();

        $pdo->commit();
    } catch (PDOException $error) {
        $pdo->rollBack();
        // 23000 — нарушение уникальности request_id: та же операция уже
        // записана, повтор пришёл из-за потерянного ответа. Отвечаем успехом,
        // иначе клиент будет ретраить бесконечно и запутает кладовщика.
        if ($error->getCode() === '23000') {
            erp_json(200, ['ok' => true, 'data' => ['duplicate' => true]]);
        }
        throw $error;
    }

    erp_warehouse_audit($pdo, $actor['id'] ?? null, 'warehouse_' . $action, $logId, $requestId);

    erp_json(200, ['ok' => true, 'data' => ['duplicate' => false]]);
}

function erp_warehouse_receive(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'warehouse', $requestId);
    erp_warehouse_record_movement($pdo, $actor, 'receipt', erp_warehouse_input($requestId), $requestId);
}

function erp_warehouse_issue(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'warehouse', $requestId);
    erp_warehouse_record_movement($pdo, $actor, 'issue', erp_warehouse_input($requestId), $requestId);
}

/** Заявки на снабжение. */
function erp_supply_requests(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    $statement = $pdo->query(
        'SELECT request_code, requested_at, platform, employee_fio, department, item_name,
                quantity, unit, category, approver_fio, approved_at, invoice, status
         FROM erp_supply_requests
         ORDER BY requested_at DESC, request_code'
    );

    $rows = [];
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $rows[] = [
            'requestCode' => (string) $row['request_code'],
            'requestedAt' => (string) $row['requested_at'],
            'platform' => (string) $row['platform'],
            'employeeFio' => (string) $row['employee_fio'],
            'department' => (string) $row['department'],
            'itemName' => (string) $row['item_name'],
            'quantity' => (float) $row['quantity'],
            'unit' => (string) $row['unit'],
            'category' => (string) $row['category'],
            'approverFio' => (string) ($row['approver_fio'] ?? ''),
            'approvedAt' => (string) ($row['approved_at'] ?? ''),
            'invoice' => (string) ($row['invoice'] ?? ''),
            'status' => (string) $row['status'],
        ];
    }

    erp_json(200, ['ok' => true, 'data' => ['requests' => $rows]]);
}
