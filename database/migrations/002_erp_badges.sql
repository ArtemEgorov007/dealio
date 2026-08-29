CREATE TABLE IF NOT EXISTS erp_workshop_badges (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    workshop_id VARCHAR(32) NOT NULL,
    badge_hash CHAR(64) NOT NULL,
    badge_content MEDIUMTEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_workshop_badges_workshop_hash_unique (workshop_id, badge_hash),
    KEY erp_workshop_badges_workshop_sort_idx (workshop_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_badge_issues (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    workshop_id VARCHAR(32) NOT NULL,
    badge_content MEDIUMTEXT NOT NULL,
    issued_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    idempotency_key VARCHAR(64) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY erp_badge_issues_idempotency_key_unique (idempotency_key),
    KEY erp_badge_issues_today_idx (workshop_id, issued_at, deleted_at),
    KEY erp_badge_issues_user_issued_idx (user_id, issued_at),
    CONSTRAINT erp_badge_issues_user_id_fk FOREIGN KEY (user_id) REFERENCES erp_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
