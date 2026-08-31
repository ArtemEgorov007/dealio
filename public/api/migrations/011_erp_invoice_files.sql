-- Счёт, заведённый снабжением: связь с заявкой и PDF-файл.

-- Счёт всегда заводится под конкретную заявку: из неё подтягиваются площадка,
-- отдел и категория, и по ней же согласующий понимает, что именно оплачивает.
ALTER TABLE erp_approvals
    ADD COLUMN request_code VARCHAR(64) NULL AFTER contract,
    ADD KEY erp_approvals_request_code_idx (request_code);

-- Файл лежит отдельной таблицей, а не колонкой в erp_approvals.
--
-- Список счетов на экране согласований читает строки целиком; LONGBLOB в той
-- же таблице затягивался бы в каждый такой запрос и в каждый бэкап выборки.
-- Отдельная таблица оставляет список лёгким, а файл достаётся ровно тогда,
-- когда его открывают.
--
-- Хранение в базе, а не в файловой системе, выбрано осознанно: всё под
-- webroot отдаётся по HTTP, и мы уже ловили утечку исходников и схемы базы
-- именно так. Файл в базе физически недостижим без авторизованного
-- обработчика, попадает в тот же бэкап, что и строка счёта, и не может
-- осиротеть при сбое.
CREATE TABLE IF NOT EXISTS erp_invoice_files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    approval_id BIGINT UNSIGNED NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    byte_size INT UNSIGNED NOT NULL,
    content LONGBLOB NOT NULL,
    uploaded_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    -- Один счёт — один файл. Перезаливка заменяет прежний, а не плодит копии.
    UNIQUE KEY erp_invoice_files_approval_unique (approval_id),
    CONSTRAINT erp_invoice_files_approval_fk
        FOREIGN KEY (approval_id) REFERENCES erp_approvals (id) ON DELETE CASCADE,
    CONSTRAINT erp_invoice_files_user_fk
        FOREIGN KEY (uploaded_by) REFERENCES erp_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
