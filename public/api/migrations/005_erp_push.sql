CREATE TABLE IF NOT EXISTS erp_push_subscriptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    endpoint VARCHAR(512) NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    user_agent VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    revoked_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY erp_push_subscriptions_endpoint_unique (endpoint),
    KEY erp_push_subscriptions_user_active_idx (user_id, revoked_at),
    CONSTRAINT erp_push_subscriptions_user_id_fk FOREIGN KEY (user_id) REFERENCES erp_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_push_sent (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    approval_row_number INT UNSIGNED NOT NULL,
    invoice VARCHAR(160) NOT NULL DEFAULT '',
    sent_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_push_sent_user_row_unique (user_id, approval_row_number),
    KEY erp_push_sent_sent_at_idx (sent_at),
    CONSTRAINT erp_push_sent_user_id_fk FOREIGN KEY (user_id) REFERENCES erp_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
