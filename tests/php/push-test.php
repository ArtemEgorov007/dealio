<?php
declare(strict_types=1);

$push = dirname(__DIR__, 2) . '/public/api/src/Push.php';
$approvals = dirname(__DIR__, 2) . '/public/api/src/Approvals.php';
if (!is_file($push) || !is_file($approvals)) {
    fwrite(STDERR, "Push API adapter is missing\n");
    exit(1);
}

require $approvals;
require $push;

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
        assert_same($expectedMessage, $error->getMessage(), 'Unexpected push adapter error');
        return;
    }
    fwrite(STDERR, "Expected RuntimeException {$expectedMessage}\n");
    exit(1);
}

assert_throws(fn () => erp_push_config([]), 'push_unconfigured');
assert_throws(fn () => erp_push_subscription_input([]), 'invalid_payload');
assert_throws(
    fn () => erp_push_subscription_input(['endpoint' => 'https://push.example.test', 'keys' => ['p256dh' => '', 'auth' => 'x']]),
    'invalid_payload',
);

$valid = erp_push_subscription_input([
    'endpoint' => 'https://push.example.test/subscription/1',
    'keys' => ['p256dh' => 'abc', 'auth' => 'def'],
]);
assert_same('https://push.example.test/subscription/1', $valid['endpoint']);

echo "Push PHP tests passed\n";
