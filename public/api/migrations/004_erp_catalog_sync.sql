ALTER TABLE erp_workshop_badges
    ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order,
    ADD COLUMN archived_at DATETIME(6) NULL AFTER is_active,
    ADD KEY erp_workshop_badges_active_sort_idx (workshop_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS erp_catalog_sync_runs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    source_name VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    finished_at DATETIME(6) NULL,
    source_badges INT UNSIGNED NOT NULL DEFAULT 0,
    active_badges INT UNSIGNED NOT NULL DEFAULT 0,
    archived_badges INT UNSIGNED NOT NULL DEFAULT 0,
    error_code VARCHAR(64) NULL,
    PRIMARY KEY (id),
    KEY erp_catalog_sync_runs_source_started_idx (source_name, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
