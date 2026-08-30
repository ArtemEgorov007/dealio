-- Заявки на снабжение и согласование счетов.
-- Схема и обоснование — docs/superpowers/specs/2026-08-30-warehouse-supply-sql-design.md

CREATE TABLE IF NOT EXISTS erp_supply_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_code VARCHAR(64) NOT NULL,
    requested_at DATE NOT NULL,
    platform VARCHAR(255) NOT NULL,
    employee_fio VARCHAR(255) NOT NULL DEFAULT '',
    department VARCHAR(255) NOT NULL DEFAULT '',
    item_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
    unit VARCHAR(32) NOT NULL DEFAULT '',
    category VARCHAR(255) NOT NULL DEFAULT '',
    approver_fio VARCHAR(255) NULL,
    approved_at DATE NULL,
    -- Номер счёта: мягкая связь с erp_approvals, не внешний ключ — номер
    -- счёта в источнике не уникален (308/1 встречается дважды с разными суммами).
    invoice VARCHAR(64) NULL,
    status VARCHAR(64) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_supply_requests_code_unique (request_code),
    KEY erp_supply_requests_platform_status_idx (platform, status),
    KEY erp_supply_requests_invoice_idx (invoice)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Согласование счетов.
--
-- Первичный ключ суррогатный: номер счёта не уникален в источнике.
--
-- Колонок «Ожидает РО», «Ожидает ГД», «Согласован», «Отменен» здесь нет:
-- в листе это готовые многострочные формулировки для показа, вычисляемые из
-- статуса, сумм и дат. Хранить производный текст рядом с исходными полями —
-- значит гарантировать расхождение при первой же правке формата.
CREATE TABLE IF NOT EXISTS erp_approvals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice VARCHAR(64) NOT NULL,
    contract VARCHAR(255) NULL,
    department VARCHAR(255) NOT NULL DEFAULT '',
    platform VARCHAR(255) NOT NULL DEFAULT '',
    status VARCHAR(64) NOT NULL DEFAULT '',
    -- Сумма разбирается при импорте из «40 000,00 ₽»: неразрывные пробелы,
    -- запятая как разделитель дробной части, знак валюты.
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    category VARCHAR(255) NOT NULL DEFAULT '',
    approver_fio VARCHAR(255) NULL,
    approved_ro_at DATE NULL,
    approved_gd_at DATE NULL,
    cancelled_at DATE NULL,
    invoice_url TEXT NULL,
    -- Номер строки в листе. Нужен, пока идёт двойная запись решения
    -- (SQL + лист): по нему мост находит строку для простановки даты.
    -- Удаляется вместе с мостом на последнем этапе переезда.
    sheet_row INT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY erp_approvals_invoice_idx (invoice),
    KEY erp_approvals_status_idx (status),
    KEY erp_approvals_platform_dept_idx (platform, department),
    UNIQUE KEY erp_approvals_sheet_row_unique (sheet_row)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Уведомления о согласованиях уже существуют (миграция 006) и ссылались на
-- номер строки в листе. Переводим на внешний ключ к erp_approvals: строка
-- в листе перестанет быть идентификатором, когда мост уйдёт.
ALTER TABLE erp_approval_notifications
    ADD COLUMN approval_id BIGINT UNSIGNED NULL AFTER user_id,
    ADD KEY erp_approval_notifications_approval_idx (approval_id),
    ADD CONSTRAINT erp_approval_notifications_approval_fk
        FOREIGN KEY (approval_id) REFERENCES erp_approvals (id) ON DELETE CASCADE;
