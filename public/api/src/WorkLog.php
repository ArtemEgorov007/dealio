<?php
declare(strict_types=1);

/**
 * Журнал работ.
 *
 * Все выполненные работы — промеры, сдача, упаковка и то, что появится
 * позже, — пишутся сюда одинаковыми строками. Вид работы задаёт тег.
 */

const ERP_WORK_TAG_MEASUREMENT = 'Промер';
const ERP_WORK_TAG_PACKING = 'Упаковка';
const ERP_WORK_TAG_EXECUTIVE_DOCS = 'ИД';
const ERP_WORK_TAG_BADGE = 'Бирка';
const ERP_WORK_TAG_INTAKE = 'Приход';

/** Теги сдачи: сотрудник выбирает один из них на экране. */
function erp_work_handover_tags(): array
{
    return ['Очистка', 'ОГЗ', 'Финиш'];
}

/**
 * Теги упаковки.
 *
 * Их два: сценарий упаковки в ТЗ записан как «Тег: Упаковка, ИД», то есть
 * одна операция закрывает и упаковку, и исполнительную документацию. Колонка
 * тега одна, поэтому получается две строки журнала. Если имелась в виду одна
 * работа — убрать отсюда лишний тег.
 */
function erp_work_packing_tags(): array
{
    return [ERP_WORK_TAG_PACKING, ERP_WORK_TAG_EXECUTIVE_DOCS];
}

/** Все теги, которые журнал принимает. */
function erp_work_tags(): array
{
    return array_merge(
        [ERP_WORK_TAG_MEASUREMENT, ERP_WORK_TAG_BADGE, ERP_WORK_TAG_INTAKE],
        erp_work_handover_tags(),
        erp_work_packing_tags(),
    );
}

/**
 * Титул и объект работы из текста бирки — первая и вторая строка.
 *
 * Бирка — обычный текст каталога, а не гарантированно многострочный формат:
 * у части бирок второй строки нет вовсе. Тогда объект работы просто пуст —
 * это не ошибка разбора, а честное отражение того, что бирка была короче.
 *
 * @return array{0: string, 1: string}
 */
function erp_badge_title_lines(string $badgeContent): array
{
    $lines = preg_split('/\r\n|\r|\n/', trim($badgeContent)) ?: [];
    return [trim($lines[0] ?? ''), trim($lines[1] ?? '')];
}

/**
 * Запись работы в журнал.
 *
 * ФИО и площадку берём из карточки сотрудника, а не от клиента: журнал должен
 * отражать, кто выполнил работу, а не что прислал браузер.
 *
 * Повтор с тем же ключом идемпотентности молча ничего не делает — так потеря
 * ответа на клиенте не задваивает работу.
 *
 * @param array{tag: string, badge?: string, thickness?: float|null, idempotencyKey?: string|null, title?: string|null, workObject?: string|null, contractInternalNumber?: string|null} $work
 */
function erp_work_log_record(PDO $pdo, array $actor, array $work): int
{
    $tag = (string) $work['tag'];

    $statement = $pdo->prepare(
        'INSERT INTO erp_work_log
            (contract_internal_number, material, title, work_object, platform, performed_at, employee_fio,
             badge, tag, thickness, user_id, idempotency_key)
         VALUES
            (:contract_internal_number, NULL, :title, :work_object, :platform, CURRENT_TIMESTAMP(6), :employee_fio,
             :badge, :tag, :thickness, :user_id, :idempotency_key)'
    );

    $title = $work['title'] ?? null;
    $workObject = $work['workObject'] ?? null;
    $contract = $work['contractInternalNumber'] ?? null;

    try {
        $statement->execute([
            'platform' => (string) ($actor['platform'] ?? ''),
            'employee_fio' => (string) ($actor['fio'] ?? ''),
            'badge' => mb_substr((string) ($work['badge'] ?? ''), 0, 512),
            'tag' => $tag,
            'thickness' => $work['thickness'] ?? null,
            'user_id' => $actor['id'] ?? null,
            'idempotency_key' => $work['idempotencyKey'] ?? null,
            'title' => $title === null || $title === '' ? null : mb_substr($title, 0, 512),
            'work_object' => $workObject === null || $workObject === '' ? null : mb_substr($workObject, 0, 512),
            'contract_internal_number' => $contract === null || $contract === '' ? null : mb_substr($contract, 0, 64),
        ]);
    } catch (PDOException $error) {
        // 23000 — нарушение уникальности ключа идемпотентности: работа уже
        // записана, повтор пришёл после потерянного ответа.
        if ($error->getCode() === '23000' && ($work['idempotencyKey'] ?? null) !== null) {
            return 0;
        }
        throw $error;
    }

    return (int) $pdo->lastInsertId();
}

/**
 * Запись работы из раздела, который ещё живёт на Google Apps Script.
 *
 * Промеры и упаковка пишутся в GAS, поэтому серверу неоткуда узнать о работе
 * самому — экран сообщает о ней сюда после успешной записи. Сдача уже на SQL
 * и пишет журнал внутри своей транзакции, без этой ручки.
 *
 * Когда промеры и упаковка переедут на SQL, их записи тоже уйдут внутрь
 * транзакций, а эта ручка исчезнет.
 */
function erp_work_log_create(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);

    $input = erp_warehouse_input($requestId);
    $tag = trim((string) ($input['tag'] ?? ''));

    if (!in_array($tag, erp_work_tags(), true)) {
        erp_json(422, erp_error_payload('invalid_input', "Неизвестный тег работы «{$tag}»", $requestId));
    }

    // Право проверяем по виду работы: журнал не должен становиться дырой,
    // через которую любой вошедший пишет чужие работы.
    $permission = match (true) {
        $tag === ERP_WORK_TAG_MEASUREMENT => 'measurements',
        in_array($tag, erp_work_packing_tags(), true) => 'packing',
        default => 'handover',
    };
    erp_require_permission($pdo, $actor, $permission, $requestId);

    $thicknessRaw = $input['thickness'] ?? null;
    $thickness = $thicknessRaw === null || $thicknessRaw === '' ? null : erp_warehouse_number($thicknessRaw);

    $idempotencyKey = trim((string) ($input['idempotencyKey'] ?? ''));

    $id = erp_work_log_record($pdo, $actor, [
        'tag' => $tag,
        'badge' => (string) ($input['badge'] ?? ''),
        'thickness' => $thickness,
        'idempotencyKey' => $idempotencyKey !== '' ? $idempotencyKey : null,
    ]);

    erp_json(200, ['ok' => true, 'data' => ['id' => $id, 'tag' => $tag]]);
}

/** Журнал за смену: что записано сегодня. */
function erp_work_log_today(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'reports', $requestId);

    $rows = $pdo->query(
        'SELECT id, contract_internal_number, platform, performed_at, employee_fio,
                badge, tag, material, thickness, title, work_object
         FROM erp_work_log
         WHERE DATE(performed_at) = CURDATE()
         ORDER BY id DESC
         LIMIT 500'
    )->fetchAll(PDO::FETCH_ASSOC);

    erp_json(200, ['ok' => true, 'data' => ['entries' => array_map(static fn (array $r): array => [
        'id' => (int) $r['id'],
        'contractInternalNumber' => (string) ($r['contract_internal_number'] ?? ''),
        'platform' => (string) $r['platform'],
        'performedAt' => (string) $r['performed_at'],
        'employeeFio' => (string) $r['employee_fio'],
        'badge' => (string) $r['badge'],
        'tag' => (string) $r['tag'],
        'material' => (string) ($r['material'] ?? ''),
        'thickness' => $r['thickness'] === null ? null : (float) $r['thickness'],
        'title' => (string) ($r['title'] ?? ''),
        'workObject' => (string) ($r['work_object'] ?? ''),
    ], $rows)]]);
}
