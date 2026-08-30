<?php
declare(strict_types=1);

function erp_personnel_rights(PDO $pdo, int $userId): array
{
    $rights = [];
    foreach (erp_permission_codes() as $code) {
        $rights[$code] = 'Нет';
    }
    $stmt = $pdo->prepare('SELECT permission_code, allowed FROM erp_user_permissions WHERE user_id = :user_id');
    $stmt->execute(['user_id' => $userId]);
    foreach ($stmt->fetchAll() as $row) {
        $code = (string) $row['permission_code'];
        if (array_key_exists($code, $rights)) {
            $rights[$code] = ((int) $row['allowed']) === 1 ? 'Да' : 'Нет';
        }
    }

    $labels = erp_personnel_right_labels();

    $list = [];
    foreach ($labels as $code => $name) {
        $list[] = ['name' => $name, 'value' => $rights[$code]];
    }
    return $list;
}

function erp_personnel_departments(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'personnel', $requestId);

    $departments = $pdo->query(
        "SELECT department, COUNT(*) AS activeCount
         FROM erp_users
         WHERE status = 'Работает' AND department <> ''
         GROUP BY department
         ORDER BY department"
    )->fetchAll();

    $platforms = $pdo->query(
        "SELECT DISTINCT platform
         FROM erp_users
         WHERE platform <> ''
         ORDER BY platform"
    )->fetchAll(PDO::FETCH_COLUMN);

    $rightsTemplate = [];
    foreach (erp_personnel_rights($pdo, (int) $actor['id']) as $right) {
        $rightsTemplate[] = ['name' => $right['name'], 'value' => 'Нет'];
    }

    erp_json(200, [
        'ok' => true,
        'data' => [
            'departments' => array_map(static function (array $row): array {
                return [
                    'department' => (string) $row['department'],
                    'activeCount' => (int) $row['activeCount'],
                ];
            }, $departments),
            'platforms' => array_values(array_map('strval', $platforms)),
            'rights' => $rightsTemplate,
        ],
    ]);
}

function erp_personnel_employees(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'personnel', $requestId);

    $department = trim((string) ($_GET['department'] ?? ''));
    if ($department === '') {
        erp_json(400, erp_error_payload('bad_request', 'Укажите отдел', $requestId));
    }

    $stmt = $pdo->prepare(
        "SELECT id, fio, position
         FROM erp_users
         WHERE department = :department AND status = 'Работает'
         ORDER BY fio"
    );
    $stmt->execute(['department' => $department]);
    $employees = array_map(static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'row' => (int) $row['id'],
            'fio' => (string) $row['fio'],
            'position' => (string) $row['position'],
        ];
    }, $stmt->fetchAll());

    erp_json(200, ['ok' => true, 'data' => ['employees' => $employees]]);
}

function erp_personnel_right_labels(): array
{
    return [
        'badges' => 'Доступ к биркам',
        'measurements' => 'Доступ к промерам',
        'packing' => 'Доступ к упаковкам',
        'reports' => 'Доступ к отчетам',
        'approvals' => 'Право согласования',
        'orders' => 'Заказ снабжения',
        'supply' => 'Работа со снабжением',
        'warehouse' => 'Доступ к складу',
        'handover' => 'Доступ к сдаче',
        'personnel' => 'Управление кадрами',
    ];
}

function erp_personnel_employee_payload(PDO $pdo, array $user, string $passwordOnce = ''): array
{
    return [
        'id' => (int) $user['id'],
        'row' => (int) $user['id'],
        'fio' => (string) $user['fio'],
        'department' => (string) $user['department'],
        'position' => (string) $user['position'],
        'platform' => (string) $user['platform'],
        'role' => (string) $user['role'],
        'login' => (string) $user['login'],
        'password' => $passwordOnce,
        'status' => (string) $user['status'],
        'rights' => erp_personnel_rights($pdo, (int) $user['id']),
    ];
}

function erp_personnel_json_body(string $requestId): array
{
    $raw = file_get_contents('php://input') ?: '';
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректный запрос', $requestId));
    }
    return $payload;
}

function erp_personnel_normalize_login(string $login): string
{
    $login = trim($login);
    return function_exists('mb_strtolower') ? mb_strtolower($login, 'UTF-8') : strtolower($login);
}

function erp_personnel_normalize_role(string $role, string $requestId): string
{
    $role = trim($role);
    if ($role !== 'Исполнитель' && $role !== 'Менеджер') {
        erp_json(400, erp_error_payload('bad_request', 'Выберите роль', $requestId));
    }
    return $role;
}

function erp_personnel_is_password(string $password): bool
{
    return (bool) preg_match('/^[A-Za-z0-9]{10}$/', $password)
        && preg_match('/[a-z]/', $password)
        && preg_match('/[A-Z]/', $password)
        && preg_match('/[0-9]/', $password);
}

function erp_personnel_generate_password(): string
{
    $lower = 'abcdefghijklmnopqrstuvwxyz';
    $upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $digits = '0123456789';
    $alphabet = $lower . $upper . $digits;
    $chars = [
        $lower[random_int(0, strlen($lower) - 1)],
        $upper[random_int(0, strlen($upper) - 1)],
        $digits[random_int(0, strlen($digits) - 1)],
    ];
    while (count($chars) < 10) {
        $chars[] = $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    for ($i = count($chars) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        $tmp = $chars[$i];
        $chars[$i] = $chars[$j];
        $chars[$j] = $tmp;
    }
    return implode('', $chars);
}

function erp_personnel_ensure_login_unique(PDO $pdo, string $login, int $exceptId, string $requestId): void
{
    if ($login === '') {
        erp_json(400, erp_error_payload('bad_request', 'Укажите логин', $requestId));
    }
    $stmt = $pdo->prepare('SELECT id FROM erp_users WHERE login = :login LIMIT 1');
    $stmt->execute(['login' => $login]);
    $existing = $stmt->fetch();
    if ($existing && (int) $existing['id'] !== $exceptId) {
        erp_json(409, erp_error_payload('conflict', 'Такой логин уже занят', $requestId));
    }
}

function erp_personnel_parse_rights(array $payload, string $requestId): array
{
    $raw = $payload['rights'] ?? null;
    if ($raw === null) {
        return [];
    }
    if (!is_array($raw)) {
        erp_json(400, erp_error_payload('bad_request', 'Некорректные права', $requestId));
    }

    $labels = erp_personnel_right_labels();
    $byLabel = array_flip($labels);
    $parsed = [];
    foreach ($raw as $key => $value) {
        $code = null;
        if (is_string($key) && isset($labels[$key])) {
            $code = $key;
        } elseif (is_string($key) && isset($byLabel[$key])) {
            $code = $byLabel[$key];
        }
        if ($code === null) {
            continue;
        }
        $normalized = is_string($value) ? trim($value) : '';
        $allowed = function_exists('mb_strtolower')
            ? mb_strtolower($normalized, 'UTF-8') === 'да'
            : strtolower($normalized) === 'да';
        $parsed[$code] = $allowed ? 1 : 0;
    }
    return $parsed;
}

function erp_personnel_write_rights(PDO $pdo, int $userId, array $rights): void
{
    if ($rights === []) {
        return;
    }
    $stmt = $pdo->prepare(
        'INSERT INTO erp_user_permissions (user_id, permission_code, allowed)
         VALUES (:user_id, :permission_code, :allowed)
         ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)'
    );
    foreach ($rights as $code => $allowed) {
        $stmt->execute([
            'user_id' => $userId,
            'permission_code' => $code,
            'allowed' => $allowed,
        ]);
    }
}

function erp_personnel_audit(PDO $pdo, ?int $actorId, string $action, int $entityId, string $requestId): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO erp_audit_log (actor_user_id, action, entity_type, entity_id, request_id)
         VALUES (:actor, :action, :entity_type, :entity_id, :request_id)'
    );
    $stmt->execute([
        'actor' => $actorId,
        'action' => $action,
        'entity_type' => 'user',
        'entity_id' => $entityId,
        'request_id' => $requestId,
    ]);
}

function erp_personnel_find(PDO $pdo, int $id, string $requestId): array
{
    $stmt = $pdo->prepare('SELECT * FROM erp_users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $user = $stmt->fetch();
    if (!$user) {
        erp_json(404, erp_error_payload('not_found', 'Сотрудник не найден', $requestId));
    }
    return $user;
}

function erp_personnel_employee(PDO $pdo, array $config, string $requestId, int $id): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'personnel', $requestId);

    $user = erp_personnel_find($pdo, $id, $requestId);
    erp_json(200, [
        'ok' => true,
        'data' => ['employee' => erp_personnel_employee_payload($pdo, $user)],
    ]);
}

function erp_personnel_save(PDO $pdo, array $config, string $requestId, int $id): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'personnel', $requestId);

    $user = erp_personnel_find($pdo, $id, $requestId);
    if ((string) $user['status'] !== 'Работает') {
        erp_json(400, erp_error_payload('bad_request', 'Нельзя изменить уволенного сотрудника', $requestId));
    }

    $payload = erp_personnel_json_body($requestId);
    $platform = trim((string) ($payload['platform'] ?? ''));
    $role = erp_personnel_normalize_role((string) ($payload['role'] ?? ''), $requestId);
    $login = erp_personnel_normalize_login((string) ($payload['login'] ?? ''));
    $password = trim((string) ($payload['password'] ?? ''));
    $rights = erp_personnel_parse_rights($payload, $requestId);

    erp_personnel_ensure_login_unique($pdo, $login, $id, $requestId);

    if ($password !== '' && !erp_personnel_is_password($password)) {
        erp_json(400, erp_error_payload(
            'bad_request',
            'Пароль должен содержать 10 латинских букв и цифр, включая строчную, прописную букву и цифру',
            $requestId
        ));
    }

    $pdo->beginTransaction();
    try {
        if ($password !== '') {
            $stmt = $pdo->prepare(
                'UPDATE erp_users
                 SET platform = :platform, role = :role, login = :login, password_hash = :password_hash
                 WHERE id = :id'
            );
            $stmt->execute([
                'platform' => $platform,
                'role' => $role,
                'login' => $login,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'id' => $id,
            ]);
            $pdo->prepare('UPDATE erp_sessions SET revoked_at = NOW(6) WHERE user_id = :user_id AND revoked_at IS NULL')
                ->execute(['user_id' => $id]);
        } else {
            $stmt = $pdo->prepare(
                'UPDATE erp_users
                 SET platform = :platform, role = :role, login = :login
                 WHERE id = :id'
            );
            $stmt->execute([
                'platform' => $platform,
                'role' => $role,
                'login' => $login,
                'id' => $id,
            ]);
        }

        erp_personnel_write_rights($pdo, $id, $rights);
        erp_personnel_audit($pdo, (int) $actor['id'], 'personnel.save', $id, $requestId);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    $fresh = erp_personnel_find($pdo, $id, $requestId);
    erp_json(200, [
        'ok' => true,
        'data' => ['employee' => erp_personnel_employee_payload($pdo, $fresh)],
    ]);
}

function erp_personnel_create(PDO $pdo, array $config, string $requestId): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'personnel', $requestId);

    $payload = erp_personnel_json_body($requestId);
    $fio = trim((string) ($payload['fio'] ?? ''));
    $department = trim((string) ($payload['department'] ?? ''));
    $position = trim((string) ($payload['position'] ?? ''));
    $platform = trim((string) ($payload['platform'] ?? ''));
    $role = erp_personnel_normalize_role((string) ($payload['role'] ?? ''), $requestId);
    $login = erp_personnel_normalize_login((string) ($payload['login'] ?? ''));
    $rights = erp_personnel_parse_rights($payload, $requestId);

    if ($fio === '' || $department === '' || $position === '') {
        erp_json(400, erp_error_payload('bad_request', 'Заполните ФИО, отдел и должность', $requestId));
    }

    erp_personnel_ensure_login_unique($pdo, $login, 0, $requestId);
    $password = erp_personnel_generate_password();

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO erp_users (legacy_employee_id, fio, login, password_hash, role, platform, department, position, status)
             VALUES (NULL, :fio, :login, :password_hash, :role, :platform, :department, :position, 'Работает')"
        );
        $stmt->execute([
            'fio' => $fio,
            'login' => $login,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role' => $role,
            'platform' => $platform,
            'department' => $department,
            'position' => $position,
        ]);
        $userId = (int) $pdo->lastInsertId();

        // Ensure every permission row exists; default Нет when omitted.
        $fullRights = [];
        foreach (erp_permission_codes() as $code) {
            $fullRights[$code] = $rights[$code] ?? 0;
        }
        erp_personnel_write_rights($pdo, $userId, $fullRights);
        erp_personnel_audit($pdo, (int) $actor['id'], 'personnel.create', $userId, $requestId);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    $fresh = erp_personnel_find($pdo, $userId, $requestId);
    erp_json(200, [
        'ok' => true,
        'data' => ['employee' => erp_personnel_employee_payload($pdo, $fresh, $password)],
    ]);
}

function erp_personnel_dismiss(PDO $pdo, array $config, string $requestId, int $id): void
{
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'personnel', $requestId);

    if ((int) $actor['id'] === $id) {
        erp_json(400, erp_error_payload('bad_request', 'Нельзя уволить свою учётную запись', $requestId));
    }

    $user = erp_personnel_find($pdo, $id, $requestId);
    if ((string) $user['status'] !== 'Работает') {
        erp_json(200, ['ok' => true, 'data' => null]);
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE erp_users SET status = 'Уволен' WHERE id = :id")
            ->execute(['id' => $id]);
        $pdo->prepare('UPDATE erp_sessions SET revoked_at = NOW(6) WHERE user_id = :user_id AND revoked_at IS NULL')
            ->execute(['user_id' => $id]);
        erp_personnel_audit($pdo, (int) $actor['id'], 'personnel.dismiss', $id, $requestId);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    erp_json(200, ['ok' => true, 'data' => null]);
}
