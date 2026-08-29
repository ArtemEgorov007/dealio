<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$http = $root . '/public/api/src/Http.php';
$router = $root . '/public/api/src/Router.php';

if (!is_file($http) || !is_file($router)) {
    fwrite(STDERR, "API shell files are missing\n");
    exit(1);
}

require $http;
require $router;

function expect_same(mixed $actual, mixed $expected, string $message): void {
    if ($actual !== $expected) {
        fwrite(STDERR, $message . ' actual=' . var_export($actual, true) . "\n");
        exit(1);
    }
}

$error = erp_error_payload('not_found', 'Не найдено', 'request-1');
expect_same($error['ok'], false, 'Error payload must fail closed');
expect_same($error['error']['code'], 'not_found', 'Error payload must include code');
expect_same($error['error']['requestId'], 'request-1', 'Error payload must include request id');

expect_same(erp_route('POST', '/auth/login')[0] ?? null, 'auth_login', 'Login route must be registered');
expect_same(erp_route('POST', '/auth/logout')[0] ?? null, 'auth_logout', 'Logout route must be registered');
expect_same(erp_route('GET', '/auth/me')[0] ?? null, 'auth_me', 'Session route must be registered');
expect_same(erp_route('GET', '/personnel/departments')[0] ?? null, 'personnel_departments', 'Departments route must be registered');
expect_same(erp_route('GET', '/approvals')[0] ?? null, 'approvals_current', 'Approvals queue route must be registered');
expect_same(erp_route('POST', '/approvals/decisions')[0] ?? null, 'approvals_decide', 'Approvals decision route must be registered');
expect_same(erp_route('GET', '/unknown'), null, 'Unknown route must not be dispatched');

echo "PHP API shell tests passed\n";
