<?php
declare(strict_types=1);

/**
 * Приход: приёмка объектов выполнения работ на площадку.
 *
 * Право на раздел — `intake`, у всех «Нет» по умолчанию (ТЗ п. «Пользователь
 * и право»). Площадка нигде не выбирается пользователем — берётся из его
 * карточки, тем же приёмом, что у бирок/сдачи/промеров.
 */

const ERP_INTAKE_STATUS_PENDING = 'pending';
const ERP_INTAKE_STATUS_MATCHED = 'matched';
const ERP_INTAKE_STATUS_UNMATCHED = 'unmatched';

/** Больше сюда не пролезет: жёсткая граница на стороне PHP (см. .user.ini). */
const ERP_INTAKE_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** Сколько байт реально примет этот сервер: минимум из настроек PHP и нашей границы. */
function erp_intake_photo_upload_limit(): int
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
        ERP_INTAKE_PHOTO_MAX_BYTES,
        $toBytes((string) ini_get('upload_max_filesize')),
        (int) ($toBytes((string) ini_get('post_max_size')) * 0.9),
    ]);

    return (int) min($limits);
}

/**
 * Проверка присланного фото накладной.
 *
 * По сигнатуре байт, а не по расширению/Content-Type — их задаёт клиент, тот
 * же приём, что у erp_invoice_validate_file для PDF.
 */
function erp_intake_validate_photo(string $requestId): array
{
    $file = $_FILES['photo'] ?? null;
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        erp_json(422, erp_error_payload('invalid_input', 'Приложите фотографию накладной', $requestId));
    }

    $error = (int) $file['error'];
    if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
        $mb = round(erp_intake_photo_upload_limit() / 1048576, 1);
        erp_json(413, erp_error_payload('file_too_large', "Файл больше {$mb} МБ", $requestId));
    }
    if ($error !== UPLOAD_ERR_OK) {
        erp_json(400, erp_error_payload('upload_failed', 'Файл не загрузился, повторите попытку', $requestId));
    }

    $size = (int) $file['size'];
    if ($size <= 0) {
        erp_json(422, erp_error_payload('invalid_input', 'Файл пустой', $requestId));
    }
    if ($size > erp_intake_photo_upload_limit()) {
        $mb = round(erp_intake_photo_upload_limit() / 1048576, 1);
        erp_json(413, erp_error_payload('file_too_large', "Файл больше {$mb} МБ", $requestId));
    }

    $content = file_get_contents((string) $file['tmp_name']);
    $isJpeg = $content !== false && str_starts_with($content, "\xFF\xD8\xFF");
    $isPng = $content !== false && str_starts_with($content, "\x89PNG\r\n\x1a\n");
    if ($content === false || (!$isJpeg && !$isPng)) {
        erp_json(422, erp_error_payload('invalid_input', 'Нужна фотография (JPEG или PNG)', $requestId));
    }

    return [
        'name' => mb_substr(basename((string) ($file['name'] ?? 'waybill.jpg')), 0, 255),
        'size' => $size,
        'content' => $content,
        'mime' => $isPng ? 'image/png' : 'image/jpeg',
    ];
}

/** Данные для первого экрана: титулы, ждущие приход, и сотрудники ПТО для сценария 2. */
function erp_intake_form(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'intake', $requestId);

    // Титул — кандидат на приход, только если под ним есть хотя бы одна
    // марка без площадки: остальным принимать нечего.
    $titles = $pdo->query(
        "SELECT DISTINCT title FROM erp_work_objects WHERE platform = '' ORDER BY title"
    )->fetchAll(PDO::FETCH_COLUMN);

    // department — свободный текст без справочника отделов; часть карточек
    // могла завести отдел иначе, а должность «Инженер ПТО»/«Ведущий инженер
    // ПТО» — нет. Матчим по любому из двух (тот же фильтр, что и в
    // erp_intake_complete_unmatched), иначе список рискует оказаться пустым
    // без единой диагностики.
    $pto = $pdo->query(
        "SELECT fio FROM erp_users WHERE (department = 'ПТО' OR position LIKE '%ПТО%') AND status = 'Работает' ORDER BY fio"
    );

    erp_json(200, ['ok' => true, 'data' => [
        'titles' => array_map('strval', $titles),
        'ptoEmployees' => array_map('strval', $pto->fetchAll(PDO::FETCH_COLUMN)),
        'maxFileBytes' => erp_intake_photo_upload_limit(),
    ]]);
}

/**
 * Создание поставки: титул (может быть пустым — сценарий 2 узнает его на
 * втором экране), накладная, вес, фото. Площадка — из карточки сотрудника.
 *
 * Повтор с тем же ключом идемпотентности отдаёт уже созданную запись — тот
 * же приём, что у бирок: мобильная сеть теряет ответы чаще, чем сами запросы.
 */
function erp_intake_create_delivery(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'intake', $requestId);

    if ($_POST === [] && $_FILES === [] && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        $mb = round(erp_intake_photo_upload_limit() / 1048576, 1);
        erp_json(413, erp_error_payload('file_too_large', "Файл больше {$mb} МБ", $requestId));
    }

    $title = trim((string) ($_POST['title'] ?? ''));
    $waybillNumber = trim((string) ($_POST['waybillNumber'] ?? ''));
    $weightTons = (float) str_replace(',', '.', (string) ($_POST['weightTons'] ?? ''));
    $idempotencyKey = trim((string) ($_POST['idempotencyKey'] ?? ''));

    if (mb_strlen($title) > 128) {
        erp_json(422, erp_error_payload('invalid_input', 'Титул длиннее 128 символов', $requestId));
    }
    if ($waybillNumber === '') {
        erp_json(422, erp_error_payload('invalid_input', 'Укажите номер накладной', $requestId));
    }
    if (mb_strlen($waybillNumber) > 64) {
        erp_json(422, erp_error_payload('invalid_input', 'Номер накладной длиннее 64 символов', $requestId));
    }
    if ($weightTons <= 0) {
        erp_json(422, erp_error_payload('invalid_input', 'Укажите вес из накладной', $requestId));
    }
    // Верхняя граница держит значение в DECIMAL(12,3): без неё опечатка вроде
    // лишнего нуля роняла бы вставку MySQL-ошибкой 1264 вместо понятной 422.
    if ($weightTons > 999999.999) {
        erp_json(422, erp_error_payload('invalid_input', 'Проверьте вес — похоже на опечатку', $requestId));
    }
    if ($idempotencyKey !== '' && strlen($idempotencyKey) > 64) {
        erp_json(422, erp_error_payload('invalid_input', 'Некорректный ключ идемпотентности', $requestId));
    }

    if ($idempotencyKey !== '') {
        $existing = $pdo->prepare(
            'SELECT id, title, status FROM erp_intake_deliveries WHERE idempotency_key = :key LIMIT 1'
        );
        $existing->execute(['key' => $idempotencyKey]);
        $row = $existing->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            erp_json(200, ['ok' => true, 'data' => [
                'id' => (int) $row['id'],
                'title' => $row['title'] !== null ? (string) $row['title'] : null,
                'status' => (string) $row['status'],
            ]]);
        }
    }

    $photo = erp_intake_validate_photo($requestId);

    $pdo->beginTransaction();
    try {
        $insert = $pdo->prepare(
            'INSERT INTO erp_intake_deliveries
                (title, waybill_number, weight_tons, platform, status, created_by, author_fio, idempotency_key)
             VALUES
                (:title, :waybill_number, :weight_tons, :platform, :status, :created_by, :author_fio, :idempotency_key)'
        );
        $insert->execute([
            'title' => $title === '' ? null : $title,
            'waybill_number' => $waybillNumber,
            'weight_tons' => $weightTons,
            'platform' => (string) ($actor['platform'] ?? ''),
            'status' => ERP_INTAKE_STATUS_PENDING,
            'created_by' => $actor['id'] ?? null,
            'author_fio' => (string) ($actor['fio'] ?? ''),
            'idempotency_key' => $idempotencyKey !== '' ? $idempotencyKey : null,
        ]);
        $deliveryId = (int) $pdo->lastInsertId();

        $pdo->prepare(
            'INSERT INTO erp_intake_delivery_files (delivery_id, file_name, mime_type, byte_size, content, uploaded_by)
             VALUES (:delivery_id, :file_name, :mime_type, :byte_size, :content, :uploaded_by)'
        )->execute([
            'delivery_id' => $deliveryId,
            'file_name' => $photo['name'],
            'mime_type' => $photo['mime'],
            'byte_size' => $photo['size'],
            'content' => $photo['content'],
            'uploaded_by' => $actor['id'] ?? null,
        ]);

        $pdo->commit();
    } catch (PDOException $error) {
        $pdo->rollBack();
        if ($idempotencyKey !== '' && (int) ($error->errorInfo[1] ?? 0) === 1062) {
            $existing = $pdo->prepare(
                'SELECT id, title, status FROM erp_intake_deliveries WHERE idempotency_key = :key LIMIT 1'
            );
            $existing->execute(['key' => $idempotencyKey]);
            $row = $existing->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                erp_json(200, ['ok' => true, 'data' => [
                    'id' => (int) $row['id'],
                    'title' => $row['title'] !== null ? (string) $row['title'] : null,
                    'status' => (string) $row['status'],
                ]]);
            }
        }
        throw $error;
    }

    erp_json(200, ['ok' => true, 'data' => [
        'id' => $deliveryId,
        'title' => $title === '' ? null : $title,
        'status' => ERP_INTAKE_STATUS_PENDING,
    ]]);
}

/** Марки конкретного титула, ещё без площадки — кандидаты на приход. */
function erp_intake_objects_options(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'intake', $requestId);

    $title = trim((string) ($_GET['title'] ?? ''));
    if ($title === '') {
        erp_json(422, erp_error_payload('invalid_input', 'Укажите титул', $requestId));
    }

    $statement = $pdo->prepare(
        "SELECT id, work_object, contract_internal_number, area, weight
         FROM erp_work_objects
         WHERE title = :title AND platform = ''
         ORDER BY work_object"
    );
    $statement->execute(['title' => $title]);

    erp_json(200, ['ok' => true, 'data' => [
        'objects' => array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'workObject' => (string) $row['work_object'],
            'contractInternalNumber' => (string) $row['contract_internal_number'],
            'area' => $row['area'] === null ? null : (float) $row['area'],
            'weight' => $row['weight'] === null ? null : (float) $row['weight'],
        ], $statement->fetchAll(PDO::FETCH_ASSOC)),
    ]]);
}

/**
 * Сценарий 1: марки внесены на приход. Площадка проставляется на выбранные
 * строки erp_work_objects, и в журнал работ пишется по строке на марку.
 *
 * `AND platform = ''` в блокирующем SELECT — тот же приём, что нигде не
 * выбирать площадку руками: если строку уже принял кто-то другой между
 * чтением списка и этим запросом, она не перезапишется повторно и просто не
 * попадёт в число принятых (см. skippedIds в ответе).
 *
 * Строка поставки блокируется первой же — SELECT ... FOR UPDATE внутри той
 * же транзакции, а не отдельным запросом до неё: иначе два запроса могли бы
 * оба пройти проверку `status = 'pending'`, пока ни один ещё не закоммитил
 * смену статуса — сценарий 1 и сценарий 2 гонялись бы за одной и той же
 * поставкой. Владельца поставки проверяем тут же: без этого чужую pending
 * поставку мог бы закрыть кто угодно с правом intake, и erp_work_objects
 * получил бы площадку из чужой поставки, а erp_work_log — площадку актора,
 * то есть две таблицы разошлись бы по одной операции.
 */
function erp_intake_complete_matched(PDO $pdo, array $config, string $requestId, int $deliveryId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'intake', $requestId);

    $input = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($input)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $objectIds = array_values(array_unique(array_filter(
        array_map('intval', is_array($input['objectIds'] ?? null) ? $input['objectIds'] : []),
        static fn (int $id): bool => $id > 0,
    )));
    if ($objectIds === []) {
        erp_json(422, erp_error_payload('invalid_input', 'Выберите хотя бы одну марку', $requestId));
    }

    $pdo->beginTransaction();
    try {
        $delivery = $pdo->prepare(
            'SELECT id, title, platform, status, created_by FROM erp_intake_deliveries WHERE id = :id LIMIT 1 FOR UPDATE'
        );
        $delivery->execute(['id' => $deliveryId]);
        $deliveryRow = $delivery->fetch(PDO::FETCH_ASSOC);
        if (!$deliveryRow) {
            $pdo->rollBack();
            erp_json(404, erp_error_payload('not_found', 'Поставка не найдена', $requestId));
        }
        if ((int) ($deliveryRow['created_by'] ?? 0) !== (int) ($actor['id'] ?? 0)) {
            $pdo->rollBack();
            erp_json(403, erp_error_payload('forbidden', 'Поставка заведена другим сотрудником', $requestId));
        }

        $title = $deliveryRow['title'] !== null ? (string) $deliveryRow['title'] : '';
        if ($title === '') {
            $pdo->rollBack();
            erp_json(422, erp_error_payload('invalid_input', 'У поставки не указан титул', $requestId));
        }
        $platform = (string) $deliveryRow['platform'];
        $status = (string) $deliveryRow['status'];

        if ($status === ERP_INTAKE_STATUS_MATCHED) {
            // Повтор на уже закрытой поставке — не обязательно точный повтор
            // одного и того же запроса: частичный приём (см. skippedIds ниже)
            // сам закрывает поставку, и потерянный на телефоне ответ ровно
            // тогда пришёл бы снова с тем же набором id, включая пропущенные.
            // Отвечаем тем же честным skippedIds, а не 409 — иначе тот самый
            // пользователь, ради которого сделан skippedIds, при потере
            // ответа терял бы список пропущенных марок безвозвратно.
            $linked = $pdo->prepare('SELECT work_object_id FROM erp_intake_delivery_objects WHERE delivery_id = :id');
            $linked->execute(['id' => $deliveryId]);
            $linkedIds = array_map('intval', $linked->fetchAll(PDO::FETCH_COLUMN));
            $pdo->commit();
            erp_json(200, ['ok' => true, 'data' => [
                'matched' => count(array_intersect($objectIds, $linkedIds)),
                'skippedIds' => array_values(array_diff($objectIds, $linkedIds)),
            ]]);
        }
        if ($status !== ERP_INTAKE_STATUS_PENDING) {
            $pdo->rollBack();
            erp_json(409, erp_error_payload('conflict', 'Поставка уже обработана', $requestId));
        }

        $placeholders = implode(',', array_fill(0, count($objectIds), '?'));
        $lock = $pdo->prepare(
            "SELECT id, work_object, contract_internal_number
             FROM erp_work_objects
             WHERE id IN ($placeholders) AND title = ? AND platform = ''
             FOR UPDATE"
        );
        $lock->execute([...$objectIds, $title]);
        $claimed = $lock->fetchAll(PDO::FETCH_ASSOC);

        if ($claimed === []) {
            $pdo->rollBack();
            erp_json(409, erp_error_payload('conflict', 'Эти марки уже приняты — обновите список', $requestId));
        }

        $claimedIds = array_map(static fn (array $row): int => (int) $row['id'], $claimed);
        // Часть выбранных марок мог перехватить кто-то другой между тем, как
        // список показался пользователю, и этим запросом — поставка не
        // тонет из-за этого, но клиент обязан показать, какие марки не
        // вошли: другой возможности принять их этой же накладной уже нет.
        $skippedIds = array_values(array_diff($objectIds, $claimedIds));

        $claimedPlaceholders = implode(',', array_fill(0, count($claimedIds), '?'));
        $pdo->prepare(
            "UPDATE erp_work_objects SET platform = ? WHERE id IN ($claimedPlaceholders)"
        )->execute([$platform, ...$claimedIds]);

        $linkInsert = $pdo->prepare(
            'INSERT INTO erp_intake_delivery_objects (delivery_id, work_object_id) VALUES (:delivery_id, :work_object_id)'
        );
        foreach ($claimed as $row) {
            $linkInsert->execute(['delivery_id' => $deliveryId, 'work_object_id' => $row['id']]);

            erp_work_log_record($pdo, $actor, [
                'tag' => ERP_WORK_TAG_INTAKE,
                'title' => $title,
                'workObject' => (string) $row['work_object'],
                'contractInternalNumber' => (string) $row['contract_internal_number'],
                'idempotencyKey' => 'intake:' . $deliveryId . ':' . $row['id'],
            ]);
        }

        $pdo->prepare(
            'UPDATE erp_intake_deliveries SET status = :status WHERE id = :id'
        )->execute(['status' => ERP_INTAKE_STATUS_MATCHED, 'id' => $deliveryId]);

        $pdo->commit();
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        // 1213 — дедлок между двумя одновременными приёмами по одному
        // титулу: обе стороны блокируют строки erp_work_objects в разном
        // порядке. Клиенту это выглядит как обычный конфликт — повторная
        // попытка почти всегда проходит.
        if ((int) ($error->errorInfo[1] ?? 0) === 1213) {
            erp_json(409, erp_error_payload('conflict', 'Одновременная попытка — повторите', $requestId));
        }
        throw $error;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    erp_json(200, ['ok' => true, 'data' => ['matched' => count($claimed), 'skippedIds' => $skippedIds]]);
}

/**
 * Сценарий 2: титула не было в системе. Титул вписывается вручную, и
 * выбранный сотрудник ПТО получает уведомление — без него о поставке без
 * проектных данных никто не узнает.
 *
 * `WHERE id = :id AND created_by = :actor_id AND status = 'pending'` в одном
 * атомарном UPDATE — тот же приём, что блокировка строки поставки в
 * erp_intake_complete_matched: отдельные SELECT-затем-UPDATE позволили бы
 * гонке статуса (сценарий 1 и сценарий 2 на одну и ту же поставку) и чужому
 * сотруднику с правом intake закрыть не свою поставку (IDOR).
 */
function erp_intake_complete_unmatched(PDO $pdo, array $config, string $requestId, int $deliveryId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'intake', $requestId);

    $input = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($input)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $title = trim((string) ($input['title'] ?? ''));
    $ptoFio = trim((string) ($input['ptoFio'] ?? ''));
    if ($title === '') {
        erp_json(422, erp_error_payload('invalid_input', 'Укажите титул', $requestId));
    }
    if (mb_strlen($title) > 128) {
        erp_json(422, erp_error_payload('invalid_input', 'Титул длиннее 128 символов', $requestId));
    }
    if ($ptoFio === '') {
        erp_json(422, erp_error_payload('invalid_input', 'Выберите сотрудника ПТО', $requestId));
    }

    // department — свободный текст без справочника отделов; часть карточек
    // могла завести отдел иначе, а должность «Инженер ПТО»/«Ведущий инженер
    // ПТО» — нет. Матчим по любому из двух, а не только по отделу, иначе
    // список сценария 2 рискует оказаться пустым без единой диагностики.
    $ptoUser = $pdo->prepare(
        "SELECT id FROM erp_users
         WHERE fio = :fio AND (department = 'ПТО' OR position LIKE '%ПТО%') AND status = :status
         LIMIT 1"
    );
    $ptoUser->execute(['fio' => $ptoFio, 'status' => 'Работает']);
    $ptoUserId = $ptoUser->fetchColumn();
    if ($ptoUserId === false) {
        erp_json(422, erp_error_payload('invalid_input', 'Сотрудник ПТО не найден — обновите список', $requestId));
    }

    $actorId = (int) ($actor['id'] ?? 0);
    $update = $pdo->prepare(
        'UPDATE erp_intake_deliveries
         SET title = :title, status = :status, pto_user_id = :pto_user_id, pto_fio = :pto_fio, notified_at = CURRENT_TIMESTAMP(6)
         WHERE id = :id AND created_by = :actor_id AND status = :pending'
    );
    $update->execute([
        'title' => $title,
        'status' => ERP_INTAKE_STATUS_UNMATCHED,
        'pto_user_id' => (int) $ptoUserId,
        'pto_fio' => $ptoFio,
        'id' => $deliveryId,
        'actor_id' => $actorId,
        'pending' => ERP_INTAKE_STATUS_PENDING,
    ]);

    if ($update->rowCount() === 0) {
        // Повтор с тем же титулом И тем же ПТО на уже обработанной своей
        // поставке — потерянный на телефоне ответ, а не новая попытка:
        // уведомление уже ушло на первый успешный вызов. Тот же титул с
        // ДРУГИМ ФИО — не повтор, а попытка переназначить ответственного;
        // запись уже отправлена первому, второй раз молча замолчать её
        // нельзя, иначе пользователь решит, что переназначил, а уведомление
        // ушло не тому.
        $existing = $pdo->prepare(
            'SELECT title, pto_fio, status FROM erp_intake_deliveries WHERE id = :id AND created_by = :actor_id LIMIT 1'
        );
        $existing->execute(['id' => $deliveryId, 'actor_id' => $actorId]);
        $existingRow = $existing->fetch(PDO::FETCH_ASSOC);
        if (
            $existingRow
            && (string) $existingRow['status'] === ERP_INTAKE_STATUS_UNMATCHED
            && (string) $existingRow['title'] === $title
            && (string) $existingRow['pto_fio'] === $ptoFio
        ) {
            erp_json(200, ['ok' => true, 'data' => null]);
        }
        // Не найдена, чужая или уже в другом состоянии — не различаем: ни
        // одна из причин не то, что пользователь может исправить прямо тут.
        erp_json(409, erp_error_payload('conflict', 'Поставка не найдена или уже обработана', $requestId));
    }

    try {
        erp_push_send_to_users(
            $pdo, $config, [(int) $ptoUserId],
            'Приход без проектных данных',
            "Титул «{$title}» — нет в системе",
            '/intake',
        );
    } catch (Throwable) {
        // Запись уже сохранена: непришедшее уведомление — повод посмотреть
        // логи, а не потерять сведения о поставке.
    }

    erp_json(200, ['ok' => true, 'data' => null]);
}
