<?php
declare(strict_types=1);

/**
 * Null means the authenticated manager may read the whole shift.
 */
function erp_scope_user_id(array $actor): ?int
{
    if (($actor['role'] ?? '') === 'Менеджер') {
        return null;
    }
    $userId = (int) ($actor['id'] ?? 0);
    if ($userId <= 0) {
        throw new RuntimeException('Authenticated user has no valid id.');
    }
    return $userId;
}

function erp_active_badge_exists(PDO $pdo, string $workshopId, string $badgeContent): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM erp_workshop_badges
         WHERE workshop_id = :workshop_id AND badge_hash = :badge_hash AND is_active = 1
         LIMIT 1'
    );
    $stmt->execute([
        'workshop_id' => $workshopId,
        'badge_hash' => hash('sha256', trim($badgeContent)),
    ]);
    return $stmt->fetchColumn() !== false;
}
