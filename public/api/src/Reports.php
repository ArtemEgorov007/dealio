<?php
declare(strict_types=1);

function erp_reports_number(mixed $value): float
{
    if (is_int($value) || is_float($value)) {
        return (float) $value;
    }
    if (!is_string($value)) {
        return 0.0;
    }

    $normalized = str_replace(["\xC2\xA0", ' '], '', trim($value));
    $normalized = str_replace(',', '.', $normalized);
    if ($normalized === '' || !is_numeric($normalized)) {
        return 0.0;
    }
    return (float) $normalized;
}

function erp_reports_decode_bridge(string $body): array
{
    try {
        $payload = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new RuntimeException('Источник отчётов вернул некорректный ответ', 0, $error);
    }
    if (!is_array($payload) || empty($payload['ok']) || !is_array($payload['data'] ?? null)) {
        throw new RuntimeException('Источник отчётов временно недоступен');
    }

    $source = $payload['data'];
    $rows = $source['rows'] ?? null;
    if (!is_array($rows)) {
        throw new RuntimeException('Источник отчётов вернул неполные данные');
    }

    $normalizedRows = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $customer = trim((string) ($row['customer'] ?? ''));
        $contract = trim((string) ($row['contract'] ?? ''));
        $site = trim((string) ($row['site'] ?? ''));
        if ($customer === '' || $contract === '' || $site === '') {
            continue;
        }
        $normalizedRows[] = [
            'customer' => $customer,
            'contract' => $contract,
            'site' => $site,
            'productionRub' => erp_reports_number($row['productionRub'] ?? 0),
            'shippedTons' => erp_reports_number($row['shippedTons'] ?? 0),
            'inWorkshopTons' => erp_reports_number($row['inWorkshopTons'] ?? 0),
            // «Полный отчёт» — тот же лист и те же строки, что «Отчёт месяца»,
            // только показывает другую тройку метрик (ТП/Поступило/Отгружено
            // вместо ТП/Отгружено/В цехе). Читаем поступление тут же, а не
            // отдельным мостом: дублировать чтение одного и того же листа
            // под два разных экрана незачем.
            'receivedTons' => erp_reports_number($row['receivedTons'] ?? 0),
        ];
    }

    // Колонка «Поступило» необязательна на источнике (см. GAS
    // normalizeReportsRows_) — если её нет, отчёт месяца всё равно отдаёт
    // данные, а «Полный отчёт» узнаёт об этом по этому флагу и показывает
    // «нет данных» вместо тихого нуля.
    return ['rows' => $normalizedRows, 'receivedAvailable' => (bool) ($source['receivedAvailable'] ?? false)];
}

/**
 * Строки листов «КС» и «ИД» группируются по договору уже на клиенте (см.
 * groupReportsByContract в app/utils/erp-report-grouping.ts) — здесь только
 * нормализация чисел и отсев пустых строк, тем же приёмом, что и у
 * erp_reports_decode_bridge.
 */
function erp_reports_decode_ks_bridge(string $body): array
{
    $rows = erp_reports_decode_generic_bridge($body);
    $normalizedRows = [];
    foreach ($rows as $row) {
        $contract = trim((string) ($row['contract'] ?? ''));
        $number = trim((string) ($row['number'] ?? ''));
        $status = trim((string) ($row['status'] ?? ''));
        if ($contract === '' || $number === '') {
            continue;
        }
        $normalizedRows[] = [
            'contract' => $contract,
            'number' => $number,
            'amountWithVat' => erp_reports_number($row['amountWithVat'] ?? 0),
            'status' => $status,
        ];
    }

    return ['rows' => $normalizedRows];
}

function erp_reports_decode_id_bridge(string $body): array
{
    $rows = erp_reports_decode_generic_bridge($body);
    $normalizedRows = [];
    foreach ($rows as $row) {
        $contract = trim((string) ($row['contract'] ?? ''));
        $status = trim((string) ($row['status'] ?? ''));
        if ($contract === '' || $status === '') {
            continue;
        }
        $normalizedRows[] = [
            'contract' => $contract,
            'status' => $status,
            'volume' => erp_reports_number($row['volume'] ?? 0),
            'amountWithVat' => erp_reports_number($row['amountWithVat'] ?? 0),
        ];
    }

    return ['rows' => $normalizedRows];
}

/** Общая часть декодирования моста — то, что не зависит от формы строки. */
function erp_reports_decode_generic_bridge(string $body): array
{
    try {
        $payload = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new RuntimeException('Источник отчётов вернул некорректный ответ', 0, $error);
    }
    if (!is_array($payload) || empty($payload['ok']) || !is_array($payload['data'] ?? null)) {
        throw new RuntimeException('Источник отчётов временно недоступен');
    }

    $rows = $payload['data']['rows'] ?? null;
    if (!is_array($rows)) {
        throw new RuntimeException('Источник отчётов вернул неполные данные');
    }

    return array_values(array_filter($rows, 'is_array'));
}

/**
 * Один и тот же мост для всех отчётов — отличается только `action` в
 * запросе и функцией декодирования, которую передаёт вызывающая сторона:
 * форма строк у «Лист 15» и у «КС»/«ИД» разная, общая только транспортная
 * часть (URL/токен/таймауты/разбор верхнего уровня JSON).
 *
 * @param callable(string): array $decode
 */
function erp_reports_fetch_bridge(array $config, string $action, callable $decode): array
{
    $reports = $config['reports'] ?? null;
    $url = is_array($reports) ? trim((string) ($reports['bridge_url'] ?? '')) : '';
    $token = is_array($reports) ? (string) ($reports['bridge_token'] ?? '') : '';
    if ($url === '' || $token === '') {
        throw new RuntimeException('Источник отчётов не настроен');
    }

    $separator = str_contains($url, '?') ? '&' : '?';
    $requestUrl = $url . $separator . 'action=' . rawurlencode($action) . '&token=' . rawurlencode($token);
    $curl = curl_init($requestUrl);
    if ($curl === false) {
        throw new RuntimeException('Не удалось подключиться к источнику отчётов');
    }

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        // Apps Script redirects a Web App invocation to googleusercontent.com.
        // This is server-side only; the bridge URL and its token remain private.
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if (!is_string($body) || $status !== 200) {
        throw new RuntimeException($error !== '' ? 'Источник отчётов временно недоступен' : 'Не удалось загрузить отчёт');
    }
    return $decode($body);
}

function erp_reports_payload(array $source): array
{
    $rows = $source['rows'] ?? [];
    $summary = [
        'productionRub' => 0.0,
        'shippedTons' => 0.0,
        'inWorkshopTons' => 0.0,
        'receivedTons' => 0.0,
    ];
    foreach ($rows as $row) {
        $summary['productionRub'] += erp_reports_number($row['productionRub'] ?? 0);
        $summary['shippedTons'] += erp_reports_number($row['shippedTons'] ?? 0);
        $summary['inWorkshopTons'] += erp_reports_number($row['inWorkshopTons'] ?? 0);
        $summary['receivedTons'] += erp_reports_number($row['receivedTons'] ?? 0);
    }

    $timezone = new DateTimeZone('Europe/Moscow');
    $now = new DateTimeImmutable('now', $timezone);
    return [
        'updatedAt' => $now->format(DATE_ATOM),
        'period' => $now->format('Y-m'),
        'summary' => $summary,
        'rows' => $rows,
        'receivedAvailable' => (bool) ($source['receivedAvailable'] ?? false),
    ];
}

function erp_reports_current(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'reports', $requestId);

    try {
        $source = erp_reports_fetch_bridge($config, 'reportsCurrent', 'erp_reports_decode_bridge');
        erp_json(200, ['ok' => true, 'data' => erp_reports_payload($source)]);
    } catch (RuntimeException $error) {
        erp_json(503, erp_error_payload('reports_unavailable', 'Источник отчётов временно недоступен. Повторите попытку.', $requestId));
    }
}

/** Строки листа «КС» — сгруппируются по договору на клиенте. */
function erp_reports_ks_current(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'reports', $requestId);

    try {
        $source = erp_reports_fetch_bridge($config, 'reportsKs', 'erp_reports_decode_ks_bridge');
        erp_json(200, ['ok' => true, 'data' => ['rows' => $source['rows']]]);
    } catch (RuntimeException $error) {
        erp_json(503, erp_error_payload('reports_unavailable', 'Источник отчётов временно недоступен. Повторите попытку.', $requestId));
    }
}

/** Строки листа «ИД» — сгруппируются по договору на клиенте. */
function erp_reports_id_current(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'reports', $requestId);

    try {
        $source = erp_reports_fetch_bridge($config, 'reportsId', 'erp_reports_decode_id_bridge');
        erp_json(200, ['ok' => true, 'data' => ['rows' => $source['rows']]]);
    } catch (RuntimeException $error) {
        erp_json(503, erp_error_payload('reports_unavailable', 'Источник отчётов временно недоступен. Повторите попытку.', $requestId));
    }
}
