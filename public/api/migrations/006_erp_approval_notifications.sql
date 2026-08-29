CREATE TABLE IF NOT EXISTS erp_approval_notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    approval_row_number INT NOT NULL,
    invoice VARCHAR(255) NOT NULL,
    read_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_approval_notifications_user_row_unique (user_id, approval_row_number),
    KEY erp_approval_notifications_user_unread_idx (user_id, read_at),
    CONSTRAINT erp_approval_notifications_user_id_fk FOREIGN KEY (user_id) REFERENCES erp_users (id) ON DELETE CASCADE
);
