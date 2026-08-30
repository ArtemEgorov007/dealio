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
        ];
    }

    return ['rows' => $normalizedRows];
}

function erp_reports_fetch_bridge(array $config): array
{
    $reports = $config['reports'] ?? null;
    $url = is_array($reports) ? trim((string) ($reports['bridge_url'] ?? '')) : '';
    $token = is_array($reports) ? (string) ($reports['bridge_token'] ?? '') : '';
    if ($url === '' || $token === '') {
        throw new RuntimeException('Источник отчётов не настроен');
    }

    $separator = str_contains($url, '?') ? '&' : '?';
    $requestUrl = $url . $separator . 'action=reportsCurrent&token=' . rawurlencode($token);
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
    return erp_reports_decode_bridge($body);
}

function erp_reports_payload(array $source): array
{
    $rows = $source['rows'] ?? [];
    $summary = [
        'productionRub' => 0.0,
        'shippedTons' => 0.0,
        'inWorkshopTons' => 0.0,
    ];
    foreach ($rows as $row) {
        $summary['productionRub'] += erp_reports_number($row['productionRub'] ?? 0);
        $summary['shippedTons'] += erp_reports_number($row['shippedTons'] ?? 0);
        $summary['inWorkshopTons'] += erp_reports_number($row['inWorkshopTons'] ?? 0);
    }

    $timezone = new DateTimeZone('Europe/Moscow');
    $now = new DateTimeImmutable('now', $timezone);
    return [
        'updatedAt' => $now->format(DATE_ATOM),
        'period' => $now->format('Y-m'),
        'summary' => $summary,
        'rows' => $rows,
    ];
}

function erp_reports_current(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'reports', $requestId);

    try {
        erp_json(200, ['ok' => true, 'data' => erp_reports_payload(erp_reports_fetch_bridge($config))]);
    } catch (RuntimeException $error) {
        erp_json(503, erp_error_payload('reports_unavailable', 'Источник отчётов временно недоступен. Повторите попытку.', $requestId));
    }
}
