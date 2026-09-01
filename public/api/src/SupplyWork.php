<?php
declare(strict_types=1);

/**
 * Работа со снабжением: заведение счетов по заявкам.
 *
 * Право на раздел — `supply` («Работа со снабжением»), узкий круг снабженцев.
 * Заявки создаются в другом разделе, под правом `orders` («Заказ снабжения»).
 */

const ERP_INVOICE_STATUS_NEW = 'Ожидает РО';

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

    // Справочника договоров в системе нет — предлагаем те, что уже вводили.
    $contracts = $pdo->query(
        "SELECT DISTINCT contract FROM erp_approvals
         WHERE contract IS NOT NULL AND contract <> '' ORDER BY contract"
    )->fetchAll(PDO::FETCH_COLUMN);

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
        'contracts' => array_map('strval', $contracts),
        'approvers' => array_map('strval', $approvers->fetchAll(PDO::FETCH_COLUMN)),
        'maxFileBytes' => erp_invoice_upload_limit(),
        'units' => erp_supply_work_units(),
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
                 approver_fio, approved_ro_at, approved_gd_at, cancelled_at)
             VALUES
                (:invoice, :contract, :request_code, :department, :platform, :status, :amount, :category,
                 :approver_fio, NULL, NULL, NULL)'
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

    // Автор заявки узнаёт о смене статуса сразу, а не через пять минут крона.
    // Тот же обработчик и отмечает заявку как сообщённую, поэтому крон её
    // повторно не возьмёт.
    try {
        erp_supply_notify_status_changes($pdo, $config);
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

/** Проставление единицы измерения позиции номенклатуры. */
function erp_supply_work_set_unit(PDO $pdo, array $config, string $requestId, int $itemId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

    $unit = trim((string) (erp_warehouse_input($requestId)['unit'] ?? ''));
    if (mb_strlen($unit) > 32) {
        erp_json(422, erp_error_payload('invalid_input', 'Слишком длинная единица измерения', $requestId));
    }

    $statement = $pdo->prepare('UPDATE erp_warehouse_items SET unit = :unit WHERE id = :id');
    $statement->execute(['unit' => $unit, 'id' => $itemId]);
    if ($statement->rowCount() === 0) {
        // rowCount = 0 бывает и когда значение не изменилось, поэтому
        // отличаем «нет такой позиции» отдельной проверкой.
        $exists = $pdo->prepare('SELECT 1 FROM erp_warehouse_items WHERE id = :id');
        $exists->execute(['id' => $itemId]);
        if (!$exists->fetchColumn()) {
            erp_json(404, erp_error_payload('not_found', 'Позиция номенклатуры не найдена', $requestId));
        }
    }

    erp_json(200, ['ok' => true, 'data' => ['id' => $itemId, 'unit' => $unit]]);
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
                a.created_at, f.id AS file_id, f.byte_size
         FROM erp_approvals a
         LEFT JOIN erp_invoice_files f ON f.approval_id = a.id
         ORDER BY a.id DESC
         LIMIT 300'
    )->fetchAll(PDO::FETCH_ASSOC);

    erp_json(200, ['ok' => true, 'data' => ['invoices' => array_map(static fn (array $r): array => [
        'id' => (int) $r['id'],
        'invoice' => (string) $r['invoice'],
        'contract' => (string) ($r['contract'] ?? ''),
        'requestCode' => (string) ($r['request_code'] ?? ''),
        'department' => (string) $r['department'],
        'platform' => (string) $r['platform'],
        'status' => (string) $r['status'],
        'amount' => (float) $r['amount'],
        'category' => (string) $r['category'],
        'approverFio' => (string) ($r['approver_fio'] ?? ''),
        'approvedRoAt' => (string) ($r['approved_ro_at'] ?? ''),
        'approvedGdAt' => (string) ($r['approved_gd_at'] ?? ''),
        'cancelledAt' => (string) ($r['cancelled_at'] ?? ''),
        'hasFile' => $r['file_id'] !== null,
    ], $rows)]]);
}

/** Отдача PDF. Файл лежит в базе, поэтому это единственный путь к нему. */
function erp_supply_work_invoice_file(PDO $pdo, array $config, string $requestId, int $approvalId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'supply', $requestId);

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
