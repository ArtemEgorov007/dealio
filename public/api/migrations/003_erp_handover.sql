CREATE TABLE IF NOT EXISTS erp_handover_entries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    badge_content MEDIUMTEXT NOT NULL,
    badge_hash CHAR(64) NOT NULL,
    handed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    idempotency_key VARCHAR(64) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY erp_handover_entries_idempotency_key_unique (idempotency_key),
    KEY erp_handover_entries_today_idx (handed_at, deleted_at),
    KEY erp_handover_entries_badge_hash_idx (badge_hash, deleted_at),
    KEY erp_handover_entries_user_handed_idx (user_id, handed_at),
    CONSTRAINT erp_handover_entries_user_id_fk FOREIGN KEY (user_id) REFERENCES erp_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
