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
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function erp_request_id(): string
{
    return bin2hex(random_bytes(12));
}
