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
assert_same('approved', erp_approvals_decision_status(['status' => 'approved']), 'Approved bridge status must be accepted');
assert_same('already_processed', erp_approvals_decision_status(['status' => 'already_processed']), 'Idempotent bridge status must be accepted');
assert_throws(fn () => erp_approvals_action(['action' => 'delete']), 'invalid_action');
assert_throws(fn () => erp_approvals_payload(['ok' => false, 'error' => 'forbidden']), 'bridge_forbidden');
assert_throws(fn () => erp_approvals_decision_status(['status' => 'unknown']), 'bridge_invalid_payload');
assert_throws(fn () => erp_approvals_row_number(['rowNumber' => 1]), 'invalid_row');

assert_same(true, function_exists('erp_approvals_queue_response'), 'Authorized queue response helper must exist');
$authorizedQueue = erp_approvals_queue_response([
    'ok' => true,
    'rows' => [
        ['rowNumber' => 2, 'invoice' => 'INV-1'],
        ['rowNumber' => 7, 'invoice' => 'INV-2'],
    ],
]);
assert_same(2, $authorizedQueue['pendingCount'], 'Authorized queue response must include the number of visible rows');
assert_same(2, count($authorizedQueue['rows']), 'Pending count must match the authorized rows only');
assert_throws(fn () => erp_approvals_queue_response(['ok' => true, 'rows' => 'invalid']), 'bridge_invalid_payload');

echo "Approvals PHP tests passed\n";
