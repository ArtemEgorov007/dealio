<?php
declare(strict_types=1);

/**
 * @param array<string, mixed> $catalog
 * @return array<string, list<array{content:string,hash:string,sort_order:int}>>
 */
function erp_normalize_badge_catalog(array $catalog): array
{
    $normalized = [];
    foreach ($catalog as $workshopId => $badges) {
        if (!is_string($workshopId) || !is_array($badges)) {
            continue;
        }
        $seen = [];
        $items = [];
        foreach ($badges as $badge) {
            $content = trim((string) $badge);
            if ($content === '') {
                continue;
            }
            $hash = hash('sha256', $content);
            if (isset($seen[$hash])) {
                continue;
            }
            $seen[$hash] = true;
            $items[] = [
                'content' => $content,
                'hash' => $hash,
                'sort_order' => count($items) + 1,
            ];
        }
        $normalized[$workshopId] = $items;
    }
    return $normalized;
}

/**
 * @return list<string>
 */
function erp_badge_catalog_from_gas_payload(array $payload): array
{
    if (($payload['ok'] ?? false) !== true || !is_array($payload['badges'] ?? null)) {
        throw new RuntimeException('Badge source returned an invalid response.');
    }
    return array_values(array_map(static fn (mixed $badge): string => (string) $badge, $payload['badges']));
}

/**
 * @return array<string, list<string>>
 */
function erp_fetch_badge_catalog_from_gas(array $config): array
{
    $baseUrl = trim((string) ($config['badges']['gas_url'] ?? ''));
    if ($baseUrl === '') {
        throw new RuntimeException('Badge source is not configured.');
    }
    $catalog = [];
    foreach (['kolpino', 'volkhonka'] as $workshopId) {
        $separator = str_contains($baseUrl, '?') ? '&' : '?';
        $url = $baseUrl . $separator . http_build_query([
            'action' => 'badges',
            'workshop' => $workshopId,
        ]);
        $context = stream_context_create(['http' => ['timeout' => 15]]);
        $raw = file_get_contents($url, false, $context);
        if ($raw === false) {
            throw new RuntimeException('Badge source is unavailable.');
        }
        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            throw new RuntimeException('Badge source returned invalid JSON.');
        }
        $catalog[$workshopId] = erp_badge_catalog_from_gas_payload($payload);
    }
    return $catalog;
}

/**
 * @param array<string, mixed> $catalog
 * @return array{run_id:int,source_badges:int,active_badges:int,archived_badges:int}
 */
function erp_reconcile_badge_catalog(PDO $pdo, array $catalog): array
{
    $snapshot = erp_normalize_badge_catalog($catalog);
    $sourceBadges = array_sum(array_map('count', $snapshot));
    $run = $pdo->prepare(
        'INSERT INTO erp_catalog_sync_runs (source_name, status, source_badges)
         VALUES (:source_name, :status, :source_badges)'
    );
    $run->execute([
        'source_name' => 'gas_badges',
        'status' => 'running',
        'source_badges' => $sourceBadges,
    ]);
    $runId = (int) $pdo->lastInsertId();
    $timestamp = gmdate('Y-m-d H:i:s.u');

    try {
        $pdo->beginTransaction();
        $find = $pdo->prepare(
            'SELECT id FROM erp_workshop_badges
             WHERE workshop_id = :workshop_id AND badge_hash = :badge_hash LIMIT 1'
        );
        $insert = $pdo->prepare(
            'INSERT INTO erp_workshop_badges
             (workshop_id, badge_hash, badge_content, sort_order, is_active, archived_at)
             VALUES (:workshop_id, :badge_hash, :badge_content, :sort_order, 1, NULL)'
        );
        $restore = $pdo->prepare(
            'UPDATE erp_workshop_badges
             SET badge_content = :badge_content, sort_order = :sort_order,
                 is_active = 1, archived_at = NULL
             WHERE id = :id'
        );
        $archive = $pdo->prepare(
            'UPDATE erp_workshop_badges
             SET is_active = 0, archived_at = :archived_at
             WHERE workshop_id = :workshop_id AND is_active = 1'
        );
        $archived = 0;

        foreach ($snapshot as $workshopId => $badges) {
            $hashes = [];
            foreach ($badges as $badge) {
                $hashes[] = $badge['hash'];
                $find->execute(['workshop_id' => $workshopId, 'badge_hash' => $badge['hash']]);
                $id = $find->fetchColumn();
                if ($id === false) {
                    $insert->execute([
                        'workshop_id' => $workshopId,
                        'badge_hash' => $badge['hash'],
                        'badge_content' => $badge['content'],
                        'sort_order' => $badge['sort_order'],
                    ]);
                    continue;
                }
                $restore->execute([
                    'id' => $id,
                    'badge_content' => $badge['content'],
                    'sort_order' => $badge['sort_order'],
                ]);
            }

            if ($hashes === []) {
                $archive->execute(['workshop_id' => $workshopId, 'archived_at' => $timestamp]);
                $archived += $archive->rowCount();
                continue;
            }
            $placeholders = implode(', ', array_fill(0, count($hashes), '?'));
            $statement = 'UPDATE erp_workshop_badges
                SET is_active = 0, archived_at = ?
                WHERE workshop_id = ? AND is_active = 1 AND badge_hash NOT IN (' . $placeholders . ')';
            $params = array_merge([$timestamp, $workshopId], $hashes);
            $archiveCurrent = $pdo->prepare($statement);
            $archiveCurrent->execute($params);
            $archived += $archiveCurrent->rowCount();
        }

        $activeBadges = 0;
        if ($snapshot !== []) {
            $active = $pdo->prepare(
                'SELECT COUNT(*) FROM erp_workshop_badges
                 WHERE workshop_id IN (' . implode(', ', array_fill(0, count($snapshot), '?')) . ') AND is_active = 1'
            );
            $active->execute(array_keys($snapshot));
            $activeBadges = (int) $active->fetchColumn();
        }
        $complete = $pdo->prepare(
            'UPDATE erp_catalog_sync_runs
             SET status = :status, finished_at = :finished_at, active_badges = :active_badges,
                 archived_badges = :archived_badges
             WHERE id = :id'
        );
        $complete->execute([
            'status' => 'completed',
            'finished_at' => $timestamp,
            'active_badges' => $activeBadges,
            'archived_badges' => $archived,
            'id' => $runId,
        ]);
        $pdo->commit();

        return [
            'run_id' => $runId,
            'source_badges' => $sourceBadges,
            'active_badges' => $activeBadges,
            'archived_badges' => $archived,
        ];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $failed = $pdo->prepare(
            'UPDATE erp_catalog_sync_runs
             SET status = :status, finished_at = :finished_at, error_code = :error_code
             WHERE id = :id'
        );
        $failed->execute([
            'status' => 'failed',
            'finished_at' => $timestamp,
            'error_code' => 'sync_failed',
            'id' => $runId,
        ]);
        throw $error;
    }
}
