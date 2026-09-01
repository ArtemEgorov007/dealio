<?php
declare(strict_types=1);

/**
 * Договоры и расценки по ним.
 *
 * Право на раздел — `contracts` («Работа с договорами»).
 */

/** Сумма из поля формы: принимаем и «12 345,67», и «12345.67». */
function erp_contract_amount(string $raw): float
{
    return (float) str_replace(',', '.', str_replace([' ', "\u{00A0}", "\u{202F}", '₽'], '', $raw));
}

/**
 * Цена расценки: пустое поле — это ноль, а не NULL.
 *
 * NULL в расчётах даёт ни истину, ни ложь: любое сравнение с ним ложно, и
 * незаполненная цена молча выпадала бы из выборок вместо того, чтобы честно
 * считаться нулём.
 */
function erp_contract_price(mixed $raw): float
{
    $value = trim((string) $raw);
    return $value === '' ? 0.0 : erp_contract_amount($value);
}

/**
 * Параметр расценки: пустое поле — это прочерк.
 *
 * Параметры участвуют в подборе расценки для журнала работ. Пустая строка
 * совпала бы с любой другой пустой, то есть с чужой расценкой; прочерк
 * говорит «здесь параметра нет» явно.
 */
function erp_contract_param(mixed $raw): string
{
    $value = trim((string) $raw);
    return $value === '' ? '-' : mb_substr($value, 0, 255);
}

/**
 * Сводка по договору.
 *
 * Аванс, СМР, ИД и КС считаются из других таблиц, которых ещё нет. Отдаём
 * нули явным полем, а не прячем блок: руководство должно видеть, что строка
 * существует и ждёт данных, а не гадать, куда она делась.
 */
function erp_contract_summary(array $contract): array
{
    return [
        'limitAmount' => (float) $contract['limit_amount'],
        'advance' => 0.0,
        'construction' => 0.0,
        'executiveDocs' => 0.0,
        'acts' => 0.0,
    ];
}

function erp_contract_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'internalNumber' => (string) $row['internal_number'],
        'contractNumber' => (string) $row['contract_number'],
        'customer' => (string) $row['customer'],
        'subject' => (string) $row['subject'],
        'summary' => erp_contract_summary($row),
        'ratesCount' => isset($row['rates_count']) ? (int) $row['rates_count'] : 0,
    ];
}

/** Список договоров. */
function erp_contracts_list(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'contracts', $requestId);

    $rows = $pdo->query(
        'SELECT c.*, (SELECT COUNT(*) FROM erp_contract_rates r
                      WHERE r.internal_number = c.internal_number) AS rates_count
         FROM erp_contracts c
         ORDER BY c.id DESC'
    )->fetchAll(PDO::FETCH_ASSOC);

    erp_json(200, ['ok' => true, 'data' => ['contracts' => array_map('erp_contract_row', $rows)]]);
}

/** Один договор вместе с его расценками. */
function erp_contract_show(PDO $pdo, array $config, string $requestId, int $contractId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'contracts', $requestId);

    $statement = $pdo->prepare('SELECT * FROM erp_contracts WHERE id = :id');
    $statement->execute(['id' => $contractId]);
    $contract = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$contract) {
        erp_json(404, erp_error_payload('not_found', 'Договор не найден', $requestId));
    }

    $rates = $pdo->prepare(
        'SELECT * FROM erp_contract_rates WHERE internal_number = :number ORDER BY id'
    );
    $rates->execute(['number' => $contract['internal_number']]);

    erp_json(200, ['ok' => true, 'data' => [
        'contract' => erp_contract_row($contract),
        'rates' => array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'param1' => (string) $row['param1'],
            'param2' => (string) $row['param2'],
            'param3' => (string) $row['param3'],
            'param4' => (string) $row['param4'],
            'priceM2' => (float) $row['price_m2'],
            'priceTon' => (float) $row['price_ton'],
        ], $rates->fetchAll(PDO::FETCH_ASSOC)),
    ]]);
}

/** Создание договора. Все поля обязательны — так просило руководство. */
function erp_contract_create(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'contracts', $requestId);

    $input = erp_warehouse_input($requestId);
    $internalNumber = trim((string) ($input['internalNumber'] ?? ''));
    $contractNumber = trim((string) ($input['contractNumber'] ?? ''));
    $customer = trim((string) ($input['customer'] ?? ''));
    $subject = trim((string) ($input['subject'] ?? ''));
    $limitAmount = erp_contract_amount((string) ($input['limitAmount'] ?? ''));

    $missing = [];
    if ($internalNumber === '') {
        $missing[] = 'внутренний номер';
    }
    if ($contractNumber === '') {
        $missing[] = 'номер договора';
    }
    if ($customer === '') {
        $missing[] = 'заказчик';
    }
    if ($subject === '') {
        $missing[] = 'предмет договора';
    }
    if ($limitAmount <= 0) {
        $missing[] = 'предельная сумма';
    }
    if ($missing !== []) {
        erp_json(422, erp_error_payload('invalid_input', 'Заполните: ' . implode(', ', $missing), $requestId));
    }

    $exists = $pdo->prepare('SELECT 1 FROM erp_contracts WHERE internal_number = :number');
    $exists->execute(['number' => $internalNumber]);
    if ($exists->fetchColumn()) {
        erp_json(409, erp_error_payload(
            'conflict',
            "Договор с внутренним номером «{$internalNumber}» уже заведён",
            $requestId
        ));
    }

    $pdo->prepare(
        'INSERT INTO erp_contracts
            (internal_number, contract_number, customer, subject, limit_amount, created_by)
         VALUES (:internal_number, :contract_number, :customer, :subject, :limit_amount, :created_by)'
    )->execute([
        'internal_number' => $internalNumber,
        'contract_number' => $contractNumber,
        'customer' => $customer,
        'subject' => $subject,
        'limit_amount' => $limitAmount,
        'created_by' => $actor['id'] ?? null,
    ]);

    erp_json(200, ['ok' => true, 'data' => [
        'id' => (int) $pdo->lastInsertId(),
        'internalNumber' => $internalNumber,
    ]]);
}

/**
 * Сохранение расценок договора.
 *
 * Экран открывает весь набор и присылает его целиком. Строки с id правим на
 * месте, новые добавляем, пропавшие удаляем — так у расценки остаётся
 * постоянный id. Прежняя реализация стирала набор и записывала заново: с ней
 * id менялись на каждом сохранении, и сослаться на расценку было не из чего.
 *
 * Чужие id молча игнорировать нельзя: это была бы правка расценки соседнего
 * договора, поэтому принадлежность проверяется явно.
 */
function erp_contract_save_rates(PDO $pdo, array $config, string $requestId, int $contractId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'contracts', $requestId);

    $statement = $pdo->prepare('SELECT internal_number FROM erp_contracts WHERE id = :id');
    $statement->execute(['id' => $contractId]);
    $internalNumber = $statement->fetchColumn();
    if ($internalNumber === false) {
        erp_json(404, erp_error_payload('not_found', 'Договор не найден', $requestId));
    }

    $raw = erp_warehouse_input($requestId)['rates'] ?? null;
    if (!is_array($raw)) {
        erp_json(400, erp_error_payload('bad_request', 'Не переданы расценки', $requestId));
    }

    $existing = $pdo->prepare('SELECT id FROM erp_contract_rates WHERE internal_number = :number');
    $existing->execute(['number' => $internalNumber]);
    $existingIds = array_map('intval', $existing->fetchAll(PDO::FETCH_COLUMN));

    $rates = [];
    foreach ($raw as $row) {
        if (!is_array($row)) {
            continue;
        }
        $params = [
            erp_contract_param($row['param1'] ?? ''),
            erp_contract_param($row['param2'] ?? ''),
            erp_contract_param($row['param3'] ?? ''),
            erp_contract_param($row['param4'] ?? ''),
        ];
        $priceM2 = erp_contract_price($row['priceM2'] ?? '');
        $priceTon = erp_contract_price($row['priceTon'] ?? '');
        $id = (int) ($row['id'] ?? 0);

        // Пустой бланк — не расценка: все параметры прочерки и обе цены нули.
        if ($id === 0 && $params === ['-', '-', '-', '-'] && $priceM2 === 0.0 && $priceTon === 0.0) {
            continue;
        }
        if ($id !== 0 && !in_array($id, $existingIds, true)) {
            erp_json(422, erp_error_payload(
                'invalid_input',
                'Расценка не принадлежит этому договору',
                $requestId
            ));
        }

        $rates[] = ['id' => $id, 'params' => $params, 'priceM2' => $priceM2, 'priceTon' => $priceTon];
    }

    $keptIds = array_values(array_filter(array_column($rates, 'id')));
    $removedIds = array_values(array_diff($existingIds, $keptIds));

    $pdo->beginTransaction();
    try {
        if ($removedIds !== []) {
            $placeholders = implode(',', array_fill(0, count($removedIds), '?'));
            $pdo->prepare("DELETE FROM erp_contract_rates WHERE id IN ({$placeholders})")
                ->execute($removedIds);
        }

        $insert = $pdo->prepare(
            'INSERT INTO erp_contract_rates
                (internal_number, param1, param2, param3, param4, price_m2, price_ton)
             VALUES (:number, :param1, :param2, :param3, :param4, :price_m2, :price_ton)'
        );
        $update = $pdo->prepare(
            'UPDATE erp_contract_rates
             SET param1 = :param1, param2 = :param2, param3 = :param3, param4 = :param4,
                 price_m2 = :price_m2, price_ton = :price_ton
             WHERE id = :id'
        );

        foreach ($rates as $rate) {
            $values = [
                'param1' => $rate['params'][0],
                'param2' => $rate['params'][1],
                'param3' => $rate['params'][2],
                'param4' => $rate['params'][3],
                'price_m2' => $rate['priceM2'],
                'price_ton' => $rate['priceTon'],
            ];
            if ($rate['id'] !== 0) {
                $update->execute($values + ['id' => $rate['id']]);
            } else {
                $insert->execute($values + ['number' => $internalNumber]);
            }
        }
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    erp_json(200, ['ok' => true, 'data' => [
        'saved' => count($rates),
        'removed' => count($removedIds),
    ]]);
}
