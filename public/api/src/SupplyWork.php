<?php
declare(strict_types=1);

/**
 * Работа со снабжением: заведение счетов по заявкам.
 *
 * Право на раздел — `supply` («Работа со снабжением»), узкий круг снабженцев.
 * Заявки создаются в другом разделе, под правом `orders` («Заказ снабжения»).
 */

const ERP_INVOICE_STATUS_NEW = 'Ожидает РО';
const ERP_INVOICE_STATUS_PENDING_GD = 'Ожидает ГД';
const ERP_INVOICE_STATUS_APPROVED = 'Согласован ГД';
const ERP_INVOICE_STATUS_REJECTED = 'Отклонен';

/** Больше сюда не пролезет: жёсткая граница на стороне PHP (см. .user.ini). */
const ERP_INVOICE_MAX_BYTES = 8 * 1024 * 1024;

/** Сколько байт реально примет этот сервер: минимум из настроек PHP и нашей границы. */
function erp_invoice_upload_limit(): int
{
    $toBytes = static function (string $value): int {
        $value = trim($value);
        if ($value === '') {
            return 0;
        }
        $unit = strtolower(substr($value, -1));
        $number = (int) $value;
        return match ($unit) {
            'g' => $number * 1024 * 1024 * 1024,
            'm' => $number * 1024 * 1024,
            'k' => $number * 1024,
            default => $number,
        };
    };

    $limits = array_filter([
        ERP_INVOICE_MAX_BYTES,
        $toBytes((string) ini_get('upload_max_filesize')),
        // post_max_size покрывает и файл, и поля формы: оставляем запас.
        (int) ($toBytes((string) ini_get('post_max_size')) * 0.9),
    ]);

    return (int) min($limits);
}

/** Данные для формы: заявки, договоры, согласующие, лимит файла. */
function erp_supply_work_form(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    // Заявки показываем все и со статусом: снабженец должен видеть, что счёт
    // на эту заявку уже мог заводиться.
    $requests = $pdo->query(
        "SELECT request_code,
                MIN(platform) AS platform,
                MIN(department) AS department,
                MIN(category) AS category,
                MIN(employee_fio) AS employee_fio,
                MAX(requested_at) AS requested_at,
                MIN(status) AS status
         FROM erp_supply_requests
         WHERE request_code <> ''
         GROUP BY request_code
         ORDER BY MAX(id) DESC"
    )->fetchAll(PDO::FETCH_ASSOC);

    // Договоры берём из справочника: счёт связывается с договором по
    // внутреннему номеру, поэтому предлагать что-то помимо заведённых
    // договоров значило бы плодить ссылки в никуда.
    $contracts = $pdo->query(
        'SELECT internal_number, customer FROM erp_contracts ORDER BY id DESC'
    )->fetchAll(PDO::FETCH_ASSOC);

    // Согласующие — сотрудники с правом «Право согласования» (approvals).
    $approvers = $pdo->prepare(
        "SELECT u.fio FROM erp_users u
         JOIN erp_user_permissions p ON p.user_id = u.id
         WHERE p.permission_code = 'approvals' AND p.allowed = 1 AND u.status = :status
         ORDER BY u.fio"
    );
    $approvers->execute(['status' => 'Работает']);

    erp_json(200, ['ok' => true, 'data' => [
        'requests' => array_map(static fn (array $row): array => [
            'requestCode' => (string) $row['request_code'],
            'platform' => (string) $row['platform'],
            'department' => (string) $row['department'],
            'category' => (string) $row['category'],
            'employeeFio' => (string) $row['employee_fio'],
            'requestedAt' => (string) $row['requested_at'],
            'status' => (string) $row['status'],
        ], $requests),
        'contracts' => array_map(static fn (array $row): array => [
            'internalNumber' => (string) $row['internal_number'],
            'customer' => (string) $row['customer'],
        ], $contracts),
        'approvers' => array_map('strval', $approvers->fetchAll(PDO::FETCH_COLUMN)),
        'maxFileBytes' => erp_invoice_upload_limit(),
        'units' => erp_supply_work_units(),
    ]]);
}

/**
 * Бакет подраздела «Заявки»: ровно 4 группы из ТЗ.
 *
 * erp_supply_requests.status обновляется один раз — при заведении счёта
 * (см. UPDATE в erp_supply_work_create_invoice) — и дальше не меняется,
 * даже когда согласование продвигается по erp_approvals.status. Текущий
 * статус поэтому в первую очередь читаем из последнего счёта этой заявки, а
 * не из самой заявки; сам статус заявки — запасной источник для случая, когда
 * связки со счётом нет вовсе (см. вызывающую функцию). Отклонённый счёт и
 * вовсе не заведённый — оба возвращают заявку в «Новые»: снабженцу в обоих
 * случаях нужно завести (или перезавести) счёт.
 */
function erp_supply_work_queue_bucket(?string $approvalStatus): string
{
    return match ($approvalStatus) {
        ERP_INVOICE_STATUS_NEW => 'awaiting_ro',
        ERP_INVOICE_STATUS_PENDING_GD => 'awaiting_gd',
        ERP_INVOICE_STATUS_APPROVED => 'approved',
        default => 'new',
    };
}

/**
 * Очередь заявок для подраздела «Заявки»: снабженец отслеживает статус,
 * не взаимодействуя с заявками — граница ТЗ («не входит: изменения в
 * процедуре заявок») здесь держится тем, что ручка ничего не пишет.
 *
 * LIMIT 200 по самым свежим заявкам: без него список рос бы бессрочно (в
 * т.ч. «Согласованные», откуда заявки никуда не деваются), а страница
 * опрашивает эту ручку раз в 15 секунд, пока открыта.
 */
function erp_supply_work_requests_queue(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    $rows = $pdo->query(
        "SELECT
            r.request_code,
            MIN(r.platform) AS platform,
            MIN(r.department) AS department,
            MIN(r.category) AS category,
            MIN(r.employee_fio) AS employee_fio,
            MAX(r.requested_at) AS requested_at,
            MIN(r.status) AS request_status,
            MIN(a.invoice) AS invoice,
            MIN(a.status) AS approval_status,
            MIN(a.amount) AS amount
         FROM erp_supply_requests r
         LEFT JOIN erp_approvals a ON a.id = (
             SELECT a2.id FROM erp_approvals a2
             WHERE a2.request_code = r.request_code
             ORDER BY a2.id DESC
             LIMIT 1
         )
         WHERE r.request_code <> ''
         GROUP BY r.request_code
         ORDER BY MAX(r.id) DESC
         LIMIT 200"
    )->fetchAll(PDO::FETCH_ASSOC);

    erp_json(200, ['ok' => true, 'data' => [
        'requests' => array_map(static function (array $row): array {
            // Импорт исторических заявок (scripts/sql-import-warehouse.php) пишет
            // реальный статус сразу в erp_supply_requests.status, но не проставляет
            // erp_approvals.request_code — та же строка не находится через JOIN.
            // Без запасного чтения из r.status такая заявка навсегда осела бы в
            // «Новых», хотя по факту уже согласована.
            $approvalStatus = $row['approval_status'] !== null ? (string) $row['approval_status'] : null;
            $requestStatus = $row['request_status'] !== null ? (string) $row['request_status'] : null;
            return [
                'requestCode' => (string) $row['request_code'],
                'platform' => (string) $row['platform'],
                'department' => (string) $row['department'],
                'category' => (string) $row['category'],
                'employeeFio' => (string) $row['employee_fio'],
                'requestedAt' => (string) $row['requested_at'],
                'queueStatus' => erp_supply_work_queue_bucket($approvalStatus ?? $requestStatus),
                'invoice' => $row['invoice'] !== null ? (string) $row['invoice'] : '',
                'amount' => $row['amount'] !== null ? (float) $row['amount'] : null,
            ];
        }, $rows),
    ]]);
}

/** Сумма из поля формы: принимаем и «12 345,67», и «12345.67». */
function erp_invoice_amount(string $raw): float
{
    $normalized = str_replace([' ', "\u{00A0}", "\u{202F}", '₽'], '', $raw);
    return (float) str_replace(',', '.', $normalized);
}

/**
 * Проверка присланного PDF.
 *
 * Расширению и заголовку Content-Type верить нельзя — их задаёт клиент.
 * Проверяем сигнатуру файла: настоящий PDF начинается с «%PDF-».
 */
function erp_invoice_validate_file(string $requestId): array
{
    $file = $_FILES['file'] ?? null;
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        erp_json(422, erp_error_payload('invalid_input', 'Прикрепите PDF-файл счёта', $requestId));
    }

    $error = (int) $file['error'];
    if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
        $mb = round(erp_invoice_upload_limit() / 1048576, 1);
        erp_json(413, erp_error_payload('file_too_large', "Файл больше {$mb} МБ", $requestId));
    }
    if ($error !== UPLOAD_ERR_OK) {
        erp_json(400, erp_error_payload('upload_failed', 'Файл не загрузился, повторите попытку', $requestId));
    }

    $size = (int) $file['size'];
    if ($size <= 0) {
        erp_json(422, erp_error_payload('invalid_input', 'Файл пустой', $requestId));
    }
    if ($size > erp_invoice_upload_limit()) {
        $mb = round(erp_invoice_upload_limit() / 1048576, 1);
        erp_json(413, erp_error_payload('file_too_large', "Файл больше {$mb} МБ", $requestId));
    }

    $content = file_get_contents((string) $file['tmp_name']);
    if ($content === false || !str_starts_with($content, '%PDF-')) {
        erp_json(422, erp_error_payload('invalid_input', 'Это не PDF-файл', $requestId));
    }

    return [
        'name' => mb_substr(basename((string) ($file['name'] ?? 'invoice.pdf')), 0, 255),
        'size' => $size,
        'content' => $content,
    ];
}

/** Заведение счёта: строка в erp_approvals плюс приложенный PDF. */
function erp_supply_work_create_invoice(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    // Превышение post_max_size PHP отбрасывает и тело, и $_FILES ещё до нас:
    // без этой проверки пользователь видел бы «прикрепите файл» на файле,
    // который он только что прикрепил.
    if ($_POST === [] && $_FILES === [] && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        $mb = round(erp_invoice_upload_limit() / 1048576, 1);
        erp_json(413, erp_error_payload('file_too_large', "Файл больше {$mb} МБ", $requestId));
    }

    $invoice = trim((string) ($_POST['invoice'] ?? ''));
    $contract = trim((string) ($_POST['contract'] ?? ''));
    $requestCode = trim((string) ($_POST['requestCode'] ?? ''));
    $approverFio = trim((string) ($_POST['approverFio'] ?? ''));
    $amount = erp_invoice_amount((string) ($_POST['amount'] ?? ''));

    if ($invoice === '') {
        erp_json(422, erp_error_payload('invalid_input', 'Укажите номер счёта', $requestId));
    }
    if ($requestCode === '') {
        erp_json(422, erp_error_payload('invalid_input', 'Выберите номер заявки', $requestId));
    }
    if ($amount <= 0) {
        erp_json(422, erp_error_payload('invalid_input', 'Укажите сумму счёта', $requestId));
    }
    if ($approverFio === '') {
        erp_json(422, erp_error_payload('invalid_input', 'Выберите согласующего', $requestId));
    }

    // Площадка, отдел и категория берутся из заявки, а не от клиента: иначе
    // счёт и заявка разъедутся, и согласующий увидит чужую площадку.
    $source = $pdo->prepare(
        "SELECT MIN(platform) AS platform, MIN(department) AS department, MIN(category) AS category
         FROM erp_supply_requests WHERE request_code = :code"
    );
    $source->execute(['code' => $requestCode]);
    $row = $source->fetch(PDO::FETCH_ASSOC);
    if (!$row || $row['platform'] === null) {
        erp_json(422, erp_error_payload('invalid_input', "Заявки «{$requestCode}» нет в системе", $requestId));
    }

    // Договор необязателен, но если указан — должен существовать. Иначе в
    // счёте окажется ссылка в никуда, и связать его с договором позже будет
    // нечем.
    //
    // Внешним ключом это не закрыть: тем же полем пользуется импорт из
    // таблицы (scripts/sql-import-warehouse.php), где договор — свободный
    // текст источника. Жёсткая связь сломала бы импорт исторических счетов.
    if ($contract !== '') {
        $contractExists = $pdo->prepare('SELECT 1 FROM erp_contracts WHERE internal_number = :number');
        $contractExists->execute(['number' => $contract]);
        if (!$contractExists->fetchColumn()) {
            erp_json(422, erp_error_payload(
                'invalid_input',
                "Договора с внутренним номером «{$contract}» нет в справочнике",
                $requestId
            ));
        }
    }

    $approverExists = $pdo->prepare(
        "SELECT 1 FROM erp_users u JOIN erp_user_permissions p ON p.user_id = u.id
         WHERE u.fio = :fio AND p.permission_code = 'approvals' AND p.allowed = 1 AND u.status = :status
         LIMIT 1"
    );
    $approverExists->execute(['fio' => $approverFio, 'status' => 'Работает']);
    if (!$approverExists->fetchColumn()) {
        erp_json(422, erp_error_payload('invalid_input', 'У выбранного сотрудника нет права согласования', $requestId));
    }

    $file = erp_invoice_validate_file($requestId);

    $pdo->beginTransaction();
    try {
        $insert = $pdo->prepare(
            'INSERT INTO erp_approvals
                (invoice, contract, request_code, department, platform, status, amount, category,
                 approver_fio, created_by, author_fio, approved_ro_at, approved_gd_at, cancelled_at)
             VALUES
                (:invoice, :contract, :request_code, :department, :platform, :status, :amount, :category,
                 :approver_fio, :created_by, :author_fio, NULL, NULL, NULL)'
        );
        $insert->execute([
            'invoice' => $invoice,
            'contract' => $contract !== '' ? $contract : null,
            'request_code' => $requestCode,
            'department' => (string) $row['department'],
            'platform' => (string) $row['platform'],
            'status' => ERP_INVOICE_STATUS_NEW,
            'amount' => $amount,
            'category' => (string) $row['category'],
            'approver_fio' => $approverFio,
            // Снимок автора: тот же приём, что в erp_work_objects/erp_work_log.
            // Увольнение автора не должно обнулять счёт, который он завёл, а
            // «Инженеру снабжения» из п.7 ТЗ иначе некого будет уведомлять.
            'created_by' => $actor['id'] ?? null,
            'author_fio' => (string) ($actor['fio'] ?? ''),
        ]);
        $approvalId = (int) $pdo->lastInsertId();

        $pdo->prepare(
            'INSERT INTO erp_invoice_files (approval_id, file_name, mime_type, byte_size, content, uploaded_by)
             VALUES (:approval_id, :file_name, :mime_type, :byte_size, :content, :uploaded_by)'
        )->execute([
            'approval_id' => $approvalId,
            'file_name' => $file['name'],
            'mime_type' => 'application/pdf',
            'byte_size' => $file['size'],
            'content' => $file['content'],
            'uploaded_by' => $actor['id'] ?? null,
        ]);

        // Счёт заведён — заявка больше не «Ожидает счёт». Статус меняем в той
        // же транзакции: счёт без перевода заявки означал бы, что автор так и
        // ждёт счёт, который уже есть.
        $pdo->prepare(
            'UPDATE erp_supply_requests SET status = :status WHERE request_code = :code'
        )->execute(['status' => ERP_INVOICE_STATUS_NEW, 'code' => $requestCode]);

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    // Мгновенно, не через пять минут крона: назначенный РО узнаёт о счёте,
    // ждущем его решения, сразу — тот же приём, что и у заявок снабжения.
    try {
        erp_supply_notify_status_changes($pdo, $config);
        erp_approvals_notify_responsible($pdo, $config, $approvalId);
    } catch (Throwable) {
        // Счёт уже заведён: непришедшее уведомление — повод посмотреть логи,
        // а не потерять счёт.
    }

    erp_json(200, ['ok' => true, 'data' => ['id' => $approvalId, 'invoice' => $invoice]]);
}

/** Часто используемые единицы: подсказки в справочнике ТМЦ. */
function erp_supply_work_units(): array
{
    return ['шт.', 'компл.', 'кг', 'тн', 'л', 'м', 'м2', 'м3', 'уп.', 'пар'];
}

/** Поля позиции справочника из тела запроса. */
function erp_supply_work_item_input(string $requestId): array
{
    $input = erp_warehouse_input($requestId);
    $name = trim((string) ($input['name'] ?? ''));
    $category = trim((string) ($input['category'] ?? ''));
    $unit = trim((string) ($input['unit'] ?? ''));

    if ($name === '') {
        erp_json(422, erp_error_payload('invalid_input', 'Укажите наименование', $requestId));
    }
    if (mb_strlen($name) > 255 || mb_strlen($category) > 255 || mb_strlen($unit) > 32) {
        erp_json(422, erp_error_payload('invalid_input', 'Слишком длинное значение', $requestId));
    }

    return ['name' => $name, 'category' => $category, 'unit' => $unit];
}

/** Добавление позиции в справочник. */
function erp_supply_work_create_item(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    $item = erp_supply_work_item_input($requestId);

    $exists = $pdo->prepare('SELECT id FROM erp_warehouse_items WHERE name = :name');
    $exists->execute(['name' => $item['name']]);
    if ($exists->fetchColumn()) {
        erp_json(409, erp_error_payload(
            'conflict',
            "«{$item['name']}» уже есть в справочнике",
            $requestId
        ));
    }

    try {
        $pdo->prepare('INSERT INTO erp_warehouse_items (name, category, unit) VALUES (:name, :category, :unit)')
            ->execute($item);
    } catch (PDOException $error) {
        // Проверка выше не спасает от гонки: имя закрыто уникальным индексом,
        // и два одновременных добавления одного наименования дошли бы сюда.
        // 23000 — нарушение уникальности; отвечаем тем же 409, а не 500.
        if ($error->getCode() !== '23000') {
            throw $error;
        }
        erp_json(409, erp_error_payload('conflict', "«{$item['name']}» уже есть в справочнике", $requestId));
    }

    erp_json(200, ['ok' => true, 'data' => ['id' => (int) $pdo->lastInsertId()] + $item]);
}

/**
 * Правка позиции справочника.
 *
 * Переименование тянет за собой склад: остаток хранится строкой с составным
 * ключом «площадка|ячейка|наименование|тип|категория», а лог движений ссылается
 * на тот же ключ. Оставить их со старым именем значило бы оторвать остатки от
 * позиции — на стенде остатки есть у 271 позиции из 301, то есть почти у всех.
 *
 * Поэтому имя, категория и единица переносятся на складские строки в той же
 * транзакции, а ключи пересобираются.
 *
 * Это единственное место, где лог движений правится, а не пополняется
 * (см. запрет в 007_erp_warehouse.sql). Исключение вынужденное: ключ строки
 * производный от наименования, и не переписать его значило бы оторвать
 * движения от остатка. Переписываем строку целиком — и ключ, и текстовые
 * поля: половинчатая правка оставила бы запись, где ключ от одного товара, а
 * наименование от другого. Количества, даты и действия при этом
 * неприкосновенны, восстановить остаток на любую дату по логу по-прежнему
 * можно.
 */
function erp_supply_work_update_item(PDO $pdo, array $config, string $requestId, int $itemId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    $item = erp_supply_work_item_input($requestId);

    $current = $pdo->prepare('SELECT name, category, unit FROM erp_warehouse_items WHERE id = :id');
    $current->execute(['id' => $itemId]);
    $before = $current->fetch(PDO::FETCH_ASSOC);
    if (!$before) {
        erp_json(404, erp_error_payload('not_found', 'Позиция номенклатуры не найдена', $requestId));
    }

    $taken = $pdo->prepare('SELECT id FROM erp_warehouse_items WHERE name = :name AND id <> :id');
    $taken->execute(['name' => $item['name'], 'id' => $itemId]);
    if ($taken->fetchColumn()) {
        erp_json(409, erp_error_payload('conflict', "«{$item['name']}» уже есть в справочнике", $requestId));
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            'UPDATE erp_warehouse_items SET name = :name, category = :category, unit = :unit WHERE id = :id'
        )->execute($item + ['id' => $itemId]);

        $rows = $pdo->prepare(
            'SELECT id, stock_key, platform, cell, item_type FROM erp_warehouse_stock WHERE item_name = :name'
        );
        $rows->execute(['name' => (string) $before['name']]);

        $updateStock = $pdo->prepare(
            'UPDATE erp_warehouse_stock
             SET stock_key = :stock_key, item_name = :name, category = :category, unit = :unit
             WHERE id = :id'
        );
        $updateLog = $pdo->prepare(
            'UPDATE erp_warehouse_log
             SET stock_key = :new_key, item_name = :name, category = :category, unit = :unit
             WHERE stock_key = :old_key'
        );

        foreach ($rows->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $newKey = erp_warehouse_stock_key(
                (string) $row['platform'],
                (string) $row['cell'],
                $item['name'],
                (string) $row['item_type'],
                $item['category'],
            );
            if ($newKey === $row['stock_key']) {
                $updateStock->execute($item + ['stock_key' => $newKey, 'id' => (int) $row['id']]);
                continue;
            }

            // Ключ уникален: если такой уже занят, слияние двух складских
            // позиций — не правка справочника, и молча терять остаток нельзя.
            $busy = $pdo->prepare('SELECT id FROM erp_warehouse_stock WHERE stock_key = :key AND id <> :id');
            $busy->execute(['key' => $newKey, 'id' => (int) $row['id']]);
            if ($busy->fetchColumn()) {
                $pdo->rollBack();
                erp_json(409, erp_error_payload(
                    'conflict',
                    'На складе уже есть позиция с таким названием и категорией — переименование объединило бы остатки',
                    $requestId
                ));
            }

            $updateLog->execute($item + ['new_key' => $newKey, 'old_key' => (string) $row['stock_key']]);
            $updateStock->execute($item + ['stock_key' => $newKey, 'id' => (int) $row['id']]);
        }

        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        // Как и при добавлении: проверка «имя занято» выше не спасает от
        // гонки, а два одновременных переименования в одно имя упрутся в
        // уникальный индекс. Это конфликт, а не поломка сервера.
        if ($error instanceof PDOException && $error->getCode() === '23000') {
            erp_json(409, erp_error_payload('conflict', "«{$item['name']}» уже есть в справочнике", $requestId));
        }
        throw $error;
    }

    erp_json(200, ['ok' => true, 'data' => ['id' => $itemId] + $item]);
}

/**
 * Удаление позиции справочника.
 *
 * Позицию с ненулевым остатком не удаляем: на складе физически лежит товар, и
 * убирать его из справочника — почти наверняка ошибка.
 *
 * Смотрим именно остаток, а не наличие складской строки. У списанной позиции
 * строка остаётся навсегда — с нулём и историей движений, — и запрет по самой
 * строке означал бы «спишите остатки» тому, кто уже всё списал: позицию стало
 * бы не убрать никогда. Нулевые строки после удаления остаются на месте: они
 * держат историю движений, а справочник — это перечень номенклатуры, а не
 * владелец складских записей.
 */
function erp_supply_work_delete_item(PDO $pdo, array $config, string $requestId, int $itemId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    $current = $pdo->prepare('SELECT name FROM erp_warehouse_items WHERE id = :id');
    $current->execute(['id' => $itemId]);
    $name = $current->fetchColumn();
    if ($name === false) {
        erp_json(404, erp_error_payload('not_found', 'Позиция номенклатуры не найдена', $requestId));
    }

    $stock = $pdo->prepare(
        'SELECT COUNT(*) FROM erp_warehouse_balance WHERE item_name = :name AND balance <> 0'
    );
    $stock->execute(['name' => $name]);
    if ((int) $stock->fetchColumn() > 0) {
        erp_json(409, erp_error_payload(
            'conflict',
            "«{$name}» есть на складе — сначала спишите остатки",
            $requestId
        ));
    }

    $pdo->prepare('DELETE FROM erp_warehouse_items WHERE id = :id')->execute(['id' => $itemId]);

    erp_json(200, ['ok' => true, 'data' => ['id' => $itemId]]);
}

/** Остатки позиции по площадкам. */
function erp_supply_work_item_stock(PDO $pdo, array $config, string $requestId, int $itemId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    $current = $pdo->prepare('SELECT name, unit FROM erp_warehouse_items WHERE id = :id');
    $current->execute(['id' => $itemId]);
    $item = $current->fetch(PDO::FETCH_ASSOC);
    if (!$item) {
        erp_json(404, erp_error_payload('not_found', 'Позиция номенклатуры не найдена', $requestId));
    }

    // Остаток считается представлением из начального плюс движения лога —
    // хранить его отдельным полем значило бы завести второй источник правды.
    $rows = $pdo->prepare(
        'SELECT platform, cell, item_type, unit, balance
         FROM erp_warehouse_balance
         WHERE item_name = :name
         ORDER BY platform, cell'
    );
    $rows->execute(['name' => (string) $item['name']]);
    $stock = $rows->fetchAll(PDO::FETCH_ASSOC);

    erp_json(200, ['ok' => true, 'data' => [
        'name' => (string) $item['name'],
        'unit' => (string) $item['unit'],
        'total' => array_sum(array_map(static fn (array $r): float => (float) $r['balance'], $stock)),
        'stock' => array_map(static fn (array $r): array => [
            'platform' => (string) $r['platform'],
            'cell' => (string) $r['cell'],
            'itemType' => (string) $r['item_type'],
            'unit' => (string) $r['unit'],
            'balance' => (float) $r['balance'],
        ], $stock),
    ]]);
}

/** Все счета раздела со статусами. */
function erp_supply_work_invoices(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    // Содержимое файла здесь не читаем — только факт его наличия и размер.
    $rows = $pdo->query(
        'SELECT a.id, a.invoice, a.contract, a.request_code, a.department, a.platform, a.status,
                a.amount, a.category, a.approver_fio, a.approved_ro_at, a.approved_gd_at, a.cancelled_at,
                a.approved_gd_fio, a.rejected_by_fio, a.author_fio,
                a.created_at, f.id AS file_id, f.byte_size, c.customer
         FROM erp_approvals a
         LEFT JOIN erp_invoice_files f ON f.approval_id = a.id
         LEFT JOIN erp_contracts c ON c.internal_number = a.contract
         ORDER BY a.id DESC
         LIMIT 300'
    )->fetchAll(PDO::FETCH_ASSOC);

    erp_json(200, ['ok' => true, 'data' => ['invoices' => array_map(static fn (array $r): array => [
        'id' => (int) $r['id'],
        'invoice' => (string) $r['invoice'],
        'contract' => (string) ($r['contract'] ?? ''),
        'customer' => (string) ($r['customer'] ?? ''),
        'requestCode' => (string) ($r['request_code'] ?? ''),
        'department' => (string) $r['department'],
        'platform' => (string) $r['platform'],
        'status' => (string) $r['status'],
        'amount' => (float) $r['amount'],
        'category' => (string) $r['category'],
        'approverFio' => (string) ($r['approver_fio'] ?? ''),
        'authorFio' => (string) ($r['author_fio'] ?? ''),
        'approvedRoAt' => (string) ($r['approved_ro_at'] ?? ''),
        'approvedGdAt' => (string) ($r['approved_gd_at'] ?? ''),
        'approvedGdFio' => (string) ($r['approved_gd_fio'] ?? ''),
        'cancelledAt' => (string) ($r['cancelled_at'] ?? ''),
        'rejectedByFio' => (string) ($r['rejected_by_fio'] ?? ''),
        'hasFile' => $r['file_id'] !== null,
    ], $rows)]]);
}

/**
 * Отдача PDF. Файл лежит в базе, поэтому это единственный путь к нему.
 *
 * Право двойное: `supply` видит все счета без разбора (тот же охват, что на
 * «Все счета»). `approvals` — только счёт, к которому согласующий реально
 * причастен: он ответственен за активный этап (тот РО, либо любой директор)
 * или сам его завёл. Маршрут отдаёт файл по голому id — без этой проверки
 * согласующий перебором id скачал бы PDF любого чужого счёта с любой
 * площадки, хотя в самой очереди такой счёт ему не показан.
 */
function erp_supply_work_invoice_file(PDO $pdo, array $config, string $requestId, int $approvalId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    $access = erp_user_access($pdo, (int) $actor['id']);
    if (empty($access['supply']) && empty($access['approvals'])) {
        erp_json(403, erp_error_payload('forbidden', 'Недостаточно прав', $requestId));
    }

    $approval = $pdo->prepare('SELECT approver_fio, created_by FROM erp_approvals WHERE id = :id');
    $approval->execute(['id' => $approvalId]);
    $invoiceRow = $approval->fetch(PDO::FETCH_ASSOC);
    if (!$invoiceRow) {
        erp_json(404, erp_error_payload('not_found', 'Файл счёта не найден', $requestId));
    }

    if (empty($access['supply'])) {
        $fio = trim((string) ($actor['fio'] ?? ''));
        $isRelated = erp_approvals_is_director((string) ($actor['position'] ?? ''))
            || trim((string) $invoiceRow['approver_fio']) === $fio
            || (int) ($invoiceRow['created_by'] ?? 0) === (int) $actor['id'];
        if (!$isRelated) {
            erp_json(403, erp_error_payload('forbidden', 'Недостаточно прав', $requestId));
        }
    }

    $statement = $pdo->prepare(
        'SELECT file_name, mime_type, byte_size, content FROM erp_invoice_files WHERE approval_id = :id'
    );
    $statement->execute(['id' => $approvalId]);
    $file = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$file) {
        erp_json(404, erp_error_payload('not_found', 'Файл счёта не найден', $requestId));
    }

    // Имя в заголовке кодируем по RFC 5987: в номерах счетов бывает кириллица.
    $name = rawurlencode((string) $file['file_name']);
    http_response_code(200);
    header('Content-Type: ' . (string) $file['mime_type']);
    header('Content-Length: ' . (string) $file['byte_size']);
    header("Content-Disposition: inline; filename*=UTF-8''{$name}");
    header('Cache-Control: private, no-store');
    echo $file['content'];
    exit;
}
