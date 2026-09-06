<?php
declare(strict_types=1);

$reports = dirname(__DIR__, 2) . '/public/api/src/Reports.php';
if (!is_file($reports)) {
    fwrite(STDERR, "Reports API adapter is missing\n");
    exit(1);
}

require $reports;

function expect_reports(bool $actual, string $message): void {
    if (!$actual) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }
}

expect_reports(erp_reports_number('12 250 994') === 12250994.0, 'Report rubles must normalize spaces');
expect_reports(erp_reports_number('') === 0.0, 'Blank report values must normalize to zero');
expect_reports(erp_reports_number("1\u{00A0}061,5") === 1061.5, 'Report tons must normalize NBSP and decimal comma');

$decoded = erp_reports_decode_bridge(json_encode([
    'ok' => true,
    'data' => [
        'sourceReadAt' => '2026-08-28T12:49:00+03:00',
        'rows' => [[
            'customer' => 'Велесстрой',
            'contract' => 'Линия 3',
            'site' => 'Волхонка',
            'productionRub' => '12 250 994',
            'shippedTons' => '368',
            'inWorkshopTons' => '172',
        ]],
    ],
], JSON_THROW_ON_ERROR));

expect_reports($decoded['rows'][0]['productionRub'] === 12250994.0, 'TP must be normalized to rubles');
expect_reports($decoded['rows'][0]['shippedTons'] === 368.0, 'Shipment must be normalized to tons');
expect_reports($decoded['rows'][0]['inWorkshopTons'] === 172.0, 'Workshop balance must be normalized to tons');
// Колонки за весь период (D/E) и площадь отгрузки (K) приезжают той же
// строкой, что и месячные: лист один, запрос к мосту один.
expect_reports($decoded['rows'][0]['productionTotalRub'] === 0.0, 'Missing period columns must normalize to zero instead of failing the report');

$decodedFull = erp_reports_decode_bridge(json_encode([
    'ok' => true,
    'data' => [
        'rows' => [[
            'customer' => 'Велесстрой',
            'contract' => 'Линия 3',
            'site' => 'Волхонка',
            'productionRub' => '12 250 994',
            'shippedTons' => '368',
            'inWorkshopTons' => '172',
            'shippedSquareMeters' => '1 480',
            'productionTotalRub' => '98 000 000',
            'shippedTotalTons' => '4 210',
        ]],
    ],
], JSON_THROW_ON_ERROR));
expect_reports($decodedFull['rows'][0]['shippedSquareMeters'] === 1480.0, 'Shipped area must be normalized to square meters');
expect_reports($decodedFull['rows'][0]['productionTotalRub'] === 98000000.0, 'Period TP must be normalized to rubles');
expect_reports($decodedFull['rows'][0]['shippedTotalTons'] === 4210.0, 'Period shipment must be normalized to tons');

// «Полный отчёт» — за весь период, «Отчёт месяца» — за месяц: сводка считает
// только месячные метрики, иначе в ней сложатся разные периоды.
$payload = erp_reports_payload($decodedFull);
expect_reports($payload['summary']['productionRub'] === 12250994.0, 'Summary must total the monthly TP');
expect_reports(!array_key_exists('productionTotalRub', $payload['summary']), 'Summary must not mix the all-period columns into monthly totals');

$decodedId = erp_reports_decode_id_bridge(json_encode([
    'ok' => true,
    'data' => ['rows' => [[
        'contract' => 'Договор 1',
        'status' => 'Подписана',
        'area' => '150 000',
        'amountWithVat' => '480 000 000',
    ]]],
], JSON_THROW_ON_ERROR));
expect_reports($decodedId['rows'][0]['area'] === 150000.0, 'ID rows must carry the area column');
expect_reports($decodedId['rows'][0]['amountWithVat'] === 480000000.0, 'ID rows must carry the cost with VAT');

// Причина отказа от источника не стирается: без неё «отчёты не видят
// данные» невозможно диагностировать ни с экрана, ни из логов.
$reasonSeen = '';
try {
    erp_reports_decode_bridge(json_encode([
        'ok' => false,
        'error' => 'Не найден лист отчётов «Лист15». Есть: Лист 15, КС, ИД',
    ], JSON_THROW_ON_ERROR));
} catch (RuntimeException $error) {
    $reasonSeen = $error->getMessage();
}
expect_reports(str_contains($reasonSeen, 'Не найден лист отчётов'), 'Bridge failure reason must survive decoding');
expect_reports(str_contains($reasonSeen, 'Есть: Лист 15'), 'Bridge failure must keep the list of real sheet names');

$ksReason = '';
try {
    erp_reports_decode_ks_bridge(json_encode(['ok' => false, 'error' => 'Нет доступа к отчётам'], JSON_THROW_ON_ERROR));
} catch (RuntimeException $error) {
    $ksReason = $error->getMessage();
}
expect_reports($ksReason === 'Нет доступа к отчётам', 'KS bridge must surface the source reason too');

expect_reports(
    erp_reports_failure_message(new RuntimeException('Не найден столбец «ТП за месяц, тн»')) === 'Не найден столбец «ТП за месяц, тн»',
    'Screen message must repeat the source reason'
);
expect_reports(
    erp_reports_failure_message(new RuntimeException('')) === 'Источник отчётов временно недоступен. Повторите попытку.',
    'Empty reason must fall back to the generic message'
);

$invalid = false;
try {
    erp_reports_decode_bridge('{"ok":false}');
} catch (RuntimeException) {
    $invalid = true;
}
expect_reports($invalid, 'Invalid bridge response must be rejected');

echo "Reports PHP tests passed\n";
