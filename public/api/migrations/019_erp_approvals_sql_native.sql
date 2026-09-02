-- Согласования счетов уходят с Google-таблицы на SQL целиком.
--
-- erp_approvals уже пишется при создании счёта (erp_supply_work_create_invoice),
-- но до сих пор не хватало данных для остальной части сценария: кто завёл
-- счёт (некого уведомлять на каждой смене статуса — п.7 ТЗ) и кто решил на
-- этапе ГД (старый Apps Script вёл отдельный аудит-лист с ФИО на каждое
-- решение — в SQL этой возможности не было вовсе).
ALTER TABLE erp_approvals
    ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER approver_fio,
    ADD COLUMN author_fio VARCHAR(255) NOT NULL DEFAULT '' AFTER created_by,
    ADD COLUMN approved_gd_fio VARCHAR(255) NULL AFTER approved_gd_at,
    ADD COLUMN rejected_by_fio VARCHAR(255) NULL AFTER cancelled_at,
    -- Тот же паттерн diff'а, что уже проверен на erp_supply_requests: крон
    -- уведомляет только по расхождению status <> notified_status и метит
    -- отправленным даже при сбое доставки — иначе бесконечный повтор.
    ADD COLUMN notified_status VARCHAR(64) NOT NULL DEFAULT '' AFTER status,
    ADD CONSTRAINT erp_approvals_author_fk
        FOREIGN KEY (created_by) REFERENCES erp_users (id) ON DELETE SET NULL;

-- Уже существующие счета получают notified_status = их текущий status, а не
-- пустую строку. erp_approvals_notify_status_changes() шлёт пуш при
-- расхождении status <> notified_status — без этой строки первый же прогон
-- крона принял бы всю историю счетов за только что изменившуюся и разослал
-- бы залп уведомлений по каждому. created_by у этих строк всё равно NULL
-- (взять их автора неоткуда — исторические счета никогда не хранили эту
-- связь), и сам diff их не заденет, но если created_by когда-нибудь
-- бэкфилят отдельной задачей, эта строка не даст той задаче случайно
-- включить залп по всей истории заодно.
UPDATE erp_approvals SET notified_status = status WHERE notified_status = '';

-- erp_approval_notifications.approval_row_number и erp_push_sent.approval_row_number
-- намеренно не трогаются: erp_approvals_notify_all_with_access() (тестовая
-- рассылка «всем согласующим») переиспользует эту колонку с синтетическим
-- отрицательным номером, которого никогда не будет строкой erp_approvals —
-- внешний ключ на неё немедленно сломал бы эту рассылку.
