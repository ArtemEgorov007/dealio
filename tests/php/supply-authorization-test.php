<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$supply = $root . '/public/api/src/Supply.php';
$probe = __DIR__ . '/supply-auth-probe.php';

if (!is_file($supply) || !is_file($probe)) {
    fwrite(STDERR, "Supply authorization test files are missing\n");
    exit(1);
}

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

$source = file_get_contents($supply) ?: '';

// Экран заказа снабжения (app/pages/supply.vue) открыт клиентом всем
// держателям права `orders` (app/utils/erp-sections.ts), а не только
// `supply`. Три ручки, которые эта форма вызывает, обязаны пускать оба
// права — иначе большинство держателей `orders` получают 403 при отправке.
foreach (['erp_supply_create', 'erp_supply_my_requests', 'erp_supply_catalog'] as $handler) {
    $body = extract_function_body($source, $handler);
    expect_auth(
        str_contains($body, 'erp_supply_require_orders_or_supply($pdo, $actor, $requestId)'),
        "{$handler} must accept both orders and supply — form-callers with only orders would get 403"
    );
    expect_auth(
        !preg_match("/erp_require_permission\\(\\\$pdo, \\\$actor, 'supply', \\\$requestId\\)/", $body),
        "{$handler} must not fall back to the single-permission supply gate"
    );
}

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

run_probe('orders-only', 200);
run_probe('supply-only', 200);
run_probe('neither', 403);

echo "Supply authorization tests passed\n";
