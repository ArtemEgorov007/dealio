<?php
declare(strict_types=1);

/**
 * Снабжение: заявки сотрудников на материалы.
 *
 * Заявка — это группа строк с общим request_code: сколько позиций выбрал
 * сотрудник, столько строк в erp_supply_requests.
 */

const ERP_SUPPLY_STATUS_NEW = 'Ожидает счёт';
const ERP_SUPPLY_ENGINEER_POSITION = 'Инженер снабжения';

/**
 * Следующий номер заявки для площадки.
 *
 * Один атомарный инкремент вместо MAX(...)+1: иначе два сотрудника одной
 * площадки, нажавшие «Заказать» одновременно, прочитали бы одинаковый
 * максимум и создали две разные заявки с одним номером.
 */
function erp_supply_next_code(PDO $pdo, string $platform): string
{
    $pdo->prepare(
        'INSERT INTO erp_supply_request_counters (platform, last_seq) VALUES (:platform, 1)
         ON DUPLICATE KEY UPDATE last_seq = last_seq + 1'
    )->execute(['platform' => $platform]);

    $statement = $pdo->prepare('SELECT last_seq FROM erp_supply_request_counters WHERE platform = :platform');
    $statement->execute(['platform' => $platform]);

    return $platform . '-' . (int) $statement->fetchColumn();
}

/** Позиции заявки из тела запроса. Пустые строки формы отбрасываем. */
function erp_supply_parse_items(array $input, string $requestId): array
{
    $raw = $input['items'] ?? null;
    if (!is_array($raw)) {
        erp_json(400, erp_error_payload('bad_request', 'Не переданы позиции заявки', $requestId));
    }

    $items = [];
    foreach ($raw as $row) {
        if (!is_array($row)) {
            continue;
        }
        $name = trim((string) ($row['name'] ?? ''));
        $quantity = erp_warehouse_number($row['quantity'] ?? 0);
        if ($name === '') {
            continue;
        }
        if ($quantity <= 0) {
            erp_json(422, erp_error_payload('invalid_input', "Укажите количество для «{$name}»", $requestId));
        }
        $items[] = ['name' => $name, 'quantity' => $quantity];
    }

    if ($items === []) {
        erp_json(422, erp_error_payload('invalid_input', 'Добавьте хотя бы одну позицию', $requestId));
    }

    return $items;
}

/**
 * Уведомление инженерам снабжения о новой заявке.
 *
 * Сбой доставки не отменяет саму заявку: она уже создана и лежит в базе,
 * а непришедшее уведомление — повод посмотреть логи, а не потерять заказ.
 */
function erp_supply_notify_engineers(PDO $pdo, array $config, string $requestCode, string $authorFio): void
{
    try {
        $statement = $pdo->prepare('SELECT id FROM erp_users WHERE position = :position AND status = :status');
        $statement->execute(['position' => ERP_SUPPLY_ENGINEER_POSITION, 'status' => 'Работает']);
        $engineers = $statement->fetchAll(PDO::FETCH_COLUMN);
        if ($engineers === []) {
            return;
        }

        erp_push_send_to_users($pdo, $config, $engineers, 'Новая заявка на снабжение', "{$requestCode} — {$authorFio}", '/supply');
    } catch (Throwable) {
        // Молча: заявка важнее уведомления.
    }
}

/** Уведомление автору о смене статуса заявки. */
function erp_supply_notify_author(PDO $pdo, array $config, string $requestCode, string $status): void
{
    try {
        $statement = $pdo->prepare(
            'SELECT DISTINCT author_user_id FROM erp_supply_requests
             WHERE request_code = :code AND author_user_id IS NOT NULL'
        );
        $statement->execute(['code' => $requestCode]);
        $authors = $statement->fetchAll(PDO::FETCH_COLUMN);
        if ($authors === []) {
            return;
        }

        erp_push_send_to_users($pdo, $config, $authors, 'Заявка ' . $requestCode, 'Статус: ' . $status, '/supply-requests');
    } catch (Throwable) {
        // Молча: смена статуса важнее уведомления.
    }
}

/**
 * Рассылка уведомлений по заявкам, у которых статус разошёлся с сообщённым.
 *
 * Экрана обработки заявок ещё нет: статус меняет снабжение — сегодня правкой
 * в базе, позже из функционала счетов. Поэтому событием считаем сам факт
 * расхождения, а не вызов из конкретного обработчика: так уведомление уйдёт
 * независимо от того, кто и откуда статус поменял.
 *
 * @return array{requests: int, notified: int}
 */
function erp_supply_notify_status_changes(PDO $pdo, array $config): array
{
    // Заявка — это группа строк с общим кодом. Уведомляем один раз на заявку,
    // а не по разу на каждую позицию.
    $changed = $pdo->query(
        "SELECT request_code, status, MIN(author_user_id) AS author_user_id
         FROM erp_supply_requests
         WHERE author_user_id IS NOT NULL AND status <> COALESCE(notified_status, '')
         GROUP BY request_code, status"
    )->fetchAll(PDO::FETCH_ASSOC);

    // Имена параметров разные, хотя значение одно: при отключённой эмуляции
    // подготовленных выражений PDO не даёт переиспользовать один placeholder.
    $markNotified = $pdo->prepare(
        'UPDATE erp_supply_requests SET notified_status = :notified
         WHERE request_code = :code AND status = :status'
    );

    $notified = 0;
    foreach ($changed as $row) {
        $code = (string) $row['request_code'];
        $status = (string) $row['status'];

        erp_supply_notify_author($pdo, $config, $code, $status);

        // Отметку ставим и при сбое доставки: иначе каждая следующая минута
        // крона повторяла бы одну и ту же неудачную рассылку бесконечно.
        $markNotified->execute(['code' => $code, 'status' => $status, 'notified' => $status]);
        $notified++;
    }

    return ['requests' => count($changed), 'notified' => $notified];
}

function erp_supply_notify_status_cron(PDO $pdo, array $config, string $requestId): void
{
    erp_require_cron_token($config, $requestId);

    erp_json(200, ['ok' => true, 'data' => erp_supply_notify_status_changes($pdo, $config)]);
}


/** Создание заявки. Все позиции пишутся одной транзакцией. */
function erp_supply_create(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    $items = erp_supply_parse_items(erp_warehouse_input($requestId), $requestId);

    $platform = trim((string) ($actor['platform'] ?? ''));
    if ($platform === '') {
        erp_json(422, erp_error_payload('invalid_input', 'У сотрудника не указана площадка', $requestId));
    }

    $pdo->beginTransaction();
    try {
        $requestCode = erp_supply_next_code($pdo, $platform);

        $categoryStatement = $pdo->prepare('SELECT category FROM erp_warehouse_items WHERE name = :name LIMIT 1');
        $insert = $pdo->prepare(
            'INSERT INTO erp_supply_requests
                (author_user_id, request_code, requested_at, platform, employee_fio, department,
                 item_name, quantity, unit, category, approver_fio, approved_at, invoice, status, notified_status)
             VALUES
                (:author_user_id, :request_code, CURDATE(), :platform, :employee_fio, :department,
                 :item_name, :quantity, \'\', :category, NULL, NULL, NULL, :status, :notified_status)'
        );

        foreach ($items as $item) {
            // Категорию берём из справочника, а не от клиента: она должна
            // совпадать с номенклатурой, иначе заявки не сгруппировать.
            $categoryStatement->execute(['name' => $item['name']]);
            $category = $categoryStatement->fetchColumn();

            // Позицию не из справочника не принимаем. Поле ввода свободное
            // (подсказки не обязывают выбрать), и без проверки такая строка
            // легла бы с пустой категорией — заявка выпадает из любой
            // группировки по категориям и всплывает только в отчёте.
            if ($category === false) {
                $pdo->rollBack();
                erp_json(422, erp_error_payload(
                    'invalid_input',
                    "«{$item['name']}» нет в номенклатуре склада — выберите позицию из списка",
                    $requestId
                ));
            }

            $insert->execute([
                'author_user_id' => $actor['id'] ?? null,
                'request_code' => $requestCode,
                'platform' => $platform,
                'employee_fio' => (string) ($actor['fio'] ?? ''),
                'department' => (string) ($actor['department'] ?? ''),
                'item_name' => $item['name'],
                'quantity' => $item['quantity'],
                'category' => (string) $category,
                'status' => ERP_SUPPLY_STATUS_NEW,
                // Начальный статус сразу считаем сообщённым: автор только что
                // нажал «Заказать» и увидел подтверждение — уведомление о том
                // же статусе было бы шумом. Сторож ловит только изменения.
                'notified_status' => ERP_SUPPLY_STATUS_NEW,
            ]);
        }

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    erp_supply_notify_engineers($pdo, $config, $requestCode, (string) ($actor['fio'] ?? ''));

    erp_json(200, ['ok' => true, 'data' => ['requestCode' => $requestCode, 'positions' => count($items)]]);
}

/** Заявки текущего сотрудника, сгруппированные по номеру. */
function erp_supply_my_requests(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    // Порядок задаёт id, а не request_code: код — строка, и сортировка по нему
    // ставит «Колпино-9» выше «Колпино-18». Читаем по возрастанию (позиции
    // остаются в том порядке, в каком сотрудник их вводил), а список заявок
    // переворачиваем ниже — свежие сверху.
    $statement = $pdo->prepare(
        'SELECT request_code, requested_at, item_name, quantity, unit, category, status, invoice
         FROM erp_supply_requests
         WHERE author_user_id = :user_id
         ORDER BY id'
    );
    $statement->execute(['user_id' => $actor['id'] ?? 0]);

    $requests = [];
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $code = (string) $row['request_code'];
        if (!isset($requests[$code])) {
            $requests[$code] = [
                'requestCode' => $code,
                'requestedAt' => (string) $row['requested_at'],
                'status' => (string) $row['status'],
                'invoice' => (string) ($row['invoice'] ?? ''),
                'items' => [],
            ];
        }
        $requests[$code]['items'][] = [
            'name' => (string) $row['item_name'],
            'quantity' => (float) $row['quantity'],
            'unit' => (string) $row['unit'],
            'category' => (string) $row['category'],
        ];
    }

    erp_json(200, ['ok' => true, 'data' => ['requests' => array_reverse(array_values($requests))]]);
}

/** Номенклатура для подсказки в форме заявки. */
function erp_supply_catalog(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    $rows = $pdo->query('SELECT id, name, category, unit FROM erp_warehouse_items ORDER BY category, name')
        ->fetchAll(PDO::FETCH_ASSOC);

    $items = [];
    foreach ($rows as $row) {
        $items[] = [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'category' => (string) $row['category'],
            'unit' => (string) $row['unit'],
        ];
    }

    erp_json(200, ['ok' => true, 'data' => ['items' => $items]]);
}
