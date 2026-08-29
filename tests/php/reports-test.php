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

$invalid = false;
try {
    erp_reports_decode_bridge('{"ok":false}');
} catch (RuntimeException) {
    $invalid = true;
}
expect_reports($invalid, 'Invalid bridge response must be rejected');

echo "Reports PHP tests passed\n";
