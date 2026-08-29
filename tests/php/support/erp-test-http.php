<?php
declare(strict_types=1);

function erp_error_payload(string $code, string $message, string $requestId): array
{
    return [
        'ok' => false,
        'error' => [
            'code' => $code,
            'message' => $message,
            'requestId' => $requestId,
        ],
    ];
}

function erp_json(int $status, array $payload): never
{
    fwrite(STDOUT, (string) $status . "\n");
    exit(0);
}

function erp_request_id(): string
{
    return 'approvals-auth-test';
}
