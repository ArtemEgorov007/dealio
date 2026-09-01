<?php
declare(strict_types=1);

function erp_permission_codes(): array
{
    return ['badges', 'measurements', 'packing', 'reports', 'approvals', 'orders', 'supply', 'warehouse', 'handover', 'personnel', 'contracts'];
}

function erp_user_access(PDO $pdo, int $userId): array
{
    $access = [];
    foreach (erp_permission_codes() as $code) {
        $access[$code] = false;
    }

    $stmt = $pdo->prepare('SELECT permission_code, allowed FROM erp_user_permissions WHERE user_id = :user_id');
    $stmt->execute(['user_id' => $userId]);
    foreach ($stmt->fetchAll() as $row) {
        $code = (string) $row['permission_code'];
        if (array_key_exists($code, $access)) {
            $access[$code] = ((int) $row['allowed']) === 1;
        }
    }

    return $access;
}

function erp_public_profile(array $user, array $access): array
{
    return [
        'fio' => (string) $user['fio'],
        'department' => (string) $user['department'],
        'position' => (string) $user['position'],
        'platform' => (string) $user['platform'],
        'role' => (string) $user['role'],
        'login' => (string) $user['login'],
        'access' => $access,
    ];
}

function erp_find_user_by_login(PDO $pdo, string $login): ?array
{
    $normalized = function_exists('mb_strtolower') ? mb_strtolower(trim($login), 'UTF-8') : strtolower(trim($login));
    $stmt = $pdo->prepare('SELECT * FROM erp_users WHERE login = :login LIMIT 1');
    $stmt->execute(['login' => $normalized]);
    $user = $stmt->fetch();
    return $user ?: null;
}

function erp_session_ttl(array $config): int
{
    $ttl = isset($config['session']['ttl_seconds']) ? (int) $config['session']['ttl_seconds'] : 604800;
    return max(3600, $ttl);
}

function erp_set_session_cookie(array $config, string $token, int $ttl): void
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443');

    setcookie(erp_session_cookie_name($config), $token, [
        'expires' => time() + $ttl,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function erp_clear_session_cookie(array $config): void
{
    setcookie(erp_session_cookie_name($config), '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function erp_create_session(PDO $pdo, array $config, int $userId): string
{
    $token = bin2hex(random_bytes(32));
    $ttl = erp_session_ttl($config);
    $stmt = $pdo->prepare(
        'INSERT INTO erp_sessions (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, DATE_ADD(NOW(6), INTERVAL ' . $ttl . ' SECOND))'
    );
    $stmt->execute([
        'user_id' => $userId,
        'token_hash' => hash('sha256', $token),
    ]);
    erp_set_session_cookie($config, $token, $ttl);
    return $token;
}

function erp_current_user(PDO $pdo, array $config): ?array
{
    $cookieName = erp_session_cookie_name($config);
    $token = isset($_COOKIE[$cookieName]) ? (string) $_COOKIE[$cookieName] : '';
    if ($token === '' || strlen($token) < 32) {
        return null;
    }

    $stmt = $pdo->prepare(
        'SELECT u.*
         FROM erp_sessions s
         INNER JOIN erp_users u ON u.id = s.user_id
         WHERE s.token_hash = :token_hash
           AND s.revoked_at IS NULL
           AND s.expires_at > NOW(6)
         LIMIT 1'
    );
    $stmt->execute(['token_hash' => hash('sha256', $token)]);
    $user = $stmt->fetch();
    if (!$user) {
        return null;
    }
    if ((string) $user['status'] !== 'Работает') {
        return null;
    }
    return $user;
}

function erp_require_user(PDO $pdo, array $config, string $requestId): array
{
    $user = erp_current_user($pdo, $config);
    if (!$user) {
        erp_json(401, erp_error_payload('unauthorized', 'Требуется вход', $requestId));
    }
    return $user;
}

function erp_require_permission(PDO $pdo, array $user, string $code, string $requestId): void
{
    $access = erp_user_access($pdo, (int) $user['id']);
    if (empty($access[$code])) {
        erp_json(403, erp_error_payload('forbidden', 'Недостаточно прав', $requestId));
    }
}

function erp_auth_login(PDO $pdo, array $config, string $requestId): void
{
    $raw = file_get_contents('php://input') ?: '';
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }

    $login = trim((string) ($payload['login'] ?? ''));
    $password = (string) ($payload['password'] ?? '');
    if ($login === '' || $password === '') {
        erp_json(401, erp_error_payload('unauthorized', 'Неверный логин или пароль', $requestId));
    }

    $user = erp_find_user_by_login($pdo, $login);
    if (!$user || !password_verify($password, (string) $user['password_hash'])) {
        erp_json(401, erp_error_payload('unauthorized', 'Неверный логин или пароль', $requestId));
    }
    if ((string) $user['status'] !== 'Работает') {
        erp_json(401, erp_error_payload('unauthorized', 'Учётная запись отключена — обратитесь к руководителю', $requestId));
    }

    erp_create_session($pdo, $config, (int) $user['id']);
    $access = erp_user_access($pdo, (int) $user['id']);

    $audit = $pdo->prepare(
        'INSERT INTO erp_audit_log (actor_user_id, action, entity_type, entity_id, request_id) VALUES (:actor, :action, :entity_type, :entity_id, :request_id)'
    );
    $audit->execute([
        'actor' => (int) $user['id'],
        'action' => 'auth.login',
        'entity_type' => 'user',
        'entity_id' => (int) $user['id'],
        'request_id' => $requestId,
    ]);

    erp_json(200, ['ok' => true, 'data' => erp_public_profile($user, $access)]);
}

function erp_auth_logout(PDO $pdo, array $config, string $requestId): void
{
    $cookieName = erp_session_cookie_name($config);
    $token = isset($_COOKIE[$cookieName]) ? (string) $_COOKIE[$cookieName] : '';
    $userId = null;
    if ($token !== '') {
        $stmt = $pdo->prepare(
            'SELECT user_id FROM erp_sessions WHERE token_hash = :token_hash AND revoked_at IS NULL LIMIT 1'
        );
        $stmt->execute(['token_hash' => hash('sha256', $token)]);
        $session = $stmt->fetch();
        if ($session) {
            $userId = (int) $session['user_id'];
        }
        $stmt = $pdo->prepare('UPDATE erp_sessions SET revoked_at = NOW(6) WHERE token_hash = :token_hash AND revoked_at IS NULL');
        $stmt->execute(['token_hash' => hash('sha256', $token)]);
    }
    if ($userId !== null) {
        erp_push_revoke_user_subscriptions($pdo, $userId);
    }
    erp_clear_session_cookie($config);
    erp_json(200, ['ok' => true, 'data' => null]);
}

function erp_auth_me(PDO $pdo, array $config, string $requestId): void
{
    $user = erp_require_user($pdo, $config, $requestId);
    $access = erp_user_access($pdo, (int) $user['id']);
    erp_json(200, ['ok' => true, 'data' => erp_public_profile($user, $access)]);
}
