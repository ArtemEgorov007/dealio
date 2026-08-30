<?php
declare(strict_types=1);

/**
 * @param array{kolpino?: string[], volkhonka?: string[]} $catalog
 * @return array{imported:int, skipped:int, workshops:array<string,int>}
 */
function erp_import_workshop_badges(PDO $pdo, array $catalog): array
{
    $imported = 0;
    $skipped = 0;
    $workshops = [];

    $insert = $pdo->prepare(
        'INSERT INTO erp_workshop_badges (workshop_id, badge_hash, badge_content, sort_order)
         VALUES (:workshop_id, :badge_hash, :badge_content, :sort_order)
         ON DUPLICATE KEY UPDATE
            badge_content = VALUES(badge_content),
            sort_order = VALUES(sort_order)'
    );

    foreach (['kolpino', 'volkhonka'] as $workshopId) {
        $list = $catalog[$workshopId] ?? [];
        if (!is_array($list)) {
            continue;
        }
        $count = 0;
        $order = 0;
        foreach ($list as $badge) {
            $content = trim((string) $badge);
            if ($content === '') {
                $skipped += 1;
                continue;
            }
            $order += 1;
            $insert->execute([
                'workshop_id' => $workshopId,
                'badge_hash' => hash('sha256', $content),
                'badge_content' => $content,
                'sort_order' => $order,
            ]);
            $imported += 1;
            $count += 1;
        }
        $workshops[$workshopId] = $count;
    }

    return [
        'imported' => $imported,
        'skipped' => $skipped,
        'workshops' => $workshops,
    ];
}
