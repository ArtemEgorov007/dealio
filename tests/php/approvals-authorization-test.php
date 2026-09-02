<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$approvals = $root . '/public/api/src/Approvals.php';
$probe = __DIR__ . '/approvals-auth-probe.php';

if (!is_file($approvals) || !is_file($probe)) {
    fwrite(STDERR, "Approvals authorization test files are missing\n");
    exit(1);
}

require $root . '/tests/php/support/erp-test-http.php';
require $root . '/public/api/src/Auth.php';

function expect_auth(bool $actual, string $message): void
{
    if (!$actual) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }
}

function extract_function_body(string $source, string $name): string
{
    $start = strpos($source, "function {$name}(");
    if ($start === false) {
        throw new RuntimeException("Function {$name} is missing");
    }
    $brace = strpos($source, '{', $start);
    if ($brace === false) {
        throw new RuntimeException("Function {$name} body is missing");
    }

    $depth = 0;
    $length = strlen($source);
    for ($index = $brace; $index < $length; $index++) {
        $char = $source[$index];
        if ($char === '{') {
            $depth++;
        } elseif ($char === '}') {
            $depth--;
            if ($depth === 0) {
                return substr($source, $start, $index - $start + 1);
            }
        }
    }

    throw new RuntimeException("Function {$name} body is unbalanced");
}

function assert_auth_guard_before_sql(string $body, string $handler, string $marker): void
{
    $userPos = strpos($body, 'erp_require_user');
    $permissionPos = strpos($body, "erp_require_permission(\$pdo, \$actor, 'approvals'");
    $sqlPos = strpos($body, $marker);

    expect_auth($userPos !== false, "{$handler} must require an authenticated user");
    expect_auth($permissionPos !== false, "{$handler} must require approvals permission");
    expect_auth($sqlPos !== false, "{$handler} must reach its SQL work ({$marker})");
    expect_auth($userPos < $sqlPos, "{$handler} must authenticate before SQL access");
    expect_auth($permissionPos < $sqlPos, "{$handler} must check approvals before SQL access");
}

$source = file_get_contents($approvals) ?: '';
// erp_approvals_current не проверяет erp_require_permission напрямую перед
// SQL для decide (decide читает право у erp_require_user раньше строки) —
// достаточно первого запроса к erp_approvals в каждом обработчике.
assert_auth_guard_before_sql(extract_function_body($source, 'erp_approvals_current'), 'erp_approvals_current', 'FROM erp_approvals');
assert_auth_guard_before_sql(extract_function_body($source, 'erp_approvals_decide'), 'erp_approvals_decide', 'FROM erp_approvals');

// Мост убран полностью — не должно остаться ни единого упоминания.
expect_auth(!str_contains($source, 'erp_approvals_bridge'), 'Approvals.php must not reference the retired Apps Script bridge');
expect_auth(!str_contains($source, 'curl_init'), 'Approvals.php must not open outbound HTTP connections');

expect_auth(in_array('approvals', erp_permission_codes(), true), 'Permission registry must include approvals');

$pdo = new PDO('sqlite::memory:');
$pdo->exec('CREATE TABLE erp_user_permissions (
    user_id INTEGER NOT NULL,
    permission_code TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 0
)');
$pdo->exec("INSERT INTO erp_user_permissions (user_id, permission_code, allowed) VALUES (7, 'badges', 1)");
$pdo->exec("INSERT INTO erp_user_permissions (user_id, permission_code, allowed) VALUES (7, 'approvals', 0)");

$access = erp_user_access($pdo, 7);
expect_auth($access['badges'] === true, 'User without approvals right may still have badges');
expect_auth($access['approvals'] === false, 'User without approvals right must fail closed');

function run_probe(string $scenario, int $expectedStatus): void
{
    global $probe;
    $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($probe) . ' ' . escapeshellarg($scenario);
    $output = [];
    $exitCode = 0;
    exec($command, $output, $exitCode);
    $status = isset($output[0]) ? (int) $output[0] : -1;
    if ($status !== $expectedStatus || $exitCode !== 0) {
        fwrite(STDERR, "Probe {$scenario} expected HTTP {$expectedStatus}, got {$status} (exit {$exitCode})\n");
        exit(1);
    }
}

run_probe('require-user-no-session', 401);
run_probe('require-permission-denied', 403);

echo "Approvals authorization tests passed\n";
