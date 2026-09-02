<?php
declare(strict_types=1);

$approvals = dirname(__DIR__, 2) . '/public/api/src/Approvals.php';
if (!is_file($approvals)) {
    fwrite(STDERR, "Approvals API adapter is missing\n");
    exit(1);
}

require $approvals;

function assert_same(mixed $expected, mixed $actual, string $message = ''): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, ($message !== '' ? $message . ': ' : '') . 'expected=' . var_export($expected, true) . ' actual=' . var_export($actual, true) . "\n");
        exit(1);
    }
}

function assert_throws(callable $callback, string $expectedMessage): void
{
    try {
        $callback();
    } catch (RuntimeException $error) {
        assert_same($expectedMessage, $error->getMessage(), 'Unexpected adapter error');
        return;
    }
    fwrite(STDERR, "Expected RuntimeException {$expectedMessage}\n");
    exit(1);
}

assert_same('Генеральный директор', erp_approvals_position('  генеральный ДИРЕКТОР '), 'Position must use canonical director spelling');
assert_same('Инженер снабжения', erp_approvals_position('Инженер снабжения'), 'Non-director position is returned normalized, unchanged');
assert_same(true, erp_approvals_is_director('генеральный директор'), 'Director predicate must match case-insensitively');
assert_same(false, erp_approvals_is_director('Руководитель отдела'), 'Non-director position must not match');

assert_throws(fn () => erp_approvals_action(['action' => 'delete']), 'invalid_action');
assert_same('approve', erp_approvals_action(['action' => 'approve']), 'Valid action must pass through');
assert_same('reject', erp_approvals_action(['action' => 'reject']), 'Valid action must pass through');

assert_throws(fn () => erp_approvals_id(['id' => 0]), 'invalid_id');
assert_throws(fn () => erp_approvals_id(['id' => -1]), 'invalid_id');
assert_throws(fn () => erp_approvals_id([]), 'invalid_id');
assert_same(42, erp_approvals_id(['id' => 42]), 'Integer id must parse');
assert_same(42, erp_approvals_id(['id' => '42']), 'Numeric string id must parse');

$row = erp_approvals_row([
    'id' => 5, 'platform' => 'Колпино', 'department' => 'Снабжение', 'category' => 'ЛКМ',
    'invoice' => 'СЧ-5', 'amount' => '1234.50',
], 'manager');
assert_same(5, $row['id'], 'Row id must be an int');
assert_same('manager', $row['stage'], 'Stage is passed through, not derived from the row');
assert_same('Снабжение ЛКМ', $row['departmentType'], 'departmentType joins department and category');
assert_same(1234.50, $row['amount'], 'Amount must be a float');
assert_same(false, array_key_exists('invoiceUrl', $row), 'DTO must not carry a URL the client already builds itself (invoiceFileUrl)');

// Пустая категория не оставляет висящего пробела на конце.
$rowNoCategory = erp_approvals_row([
    'id' => 6, 'platform' => 'Колпино', 'department' => 'Снабжение', 'category' => '',
    'invoice' => 'СЧ-6', 'amount' => '1',
], 'director');
assert_same('Снабжение', $rowNoCategory['departmentType'], 'Empty category must not leave a trailing space');

echo "Approvals PHP tests passed\n";
