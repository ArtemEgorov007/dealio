-- Журнал работ: одно место для всех выполненных работ.
--
-- Промеры, сдача, упаковка и то, что появится позже, пишут сюда одинаковыми
-- строками. Смысл конкретной работы задаёт тег, а не отдельная таблица под
-- каждый вид: иначе любой сводный отчёт превращается в объединение пяти
-- разных схем.
CREATE TABLE IF NOT EXISTS erp_work_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    -- Внутренний номер договора и материал пока не заполняются: сценариев их
    -- получения ещё нет. Колонки заведены сразу, чтобы записи не пришлось
    -- переносить, когда источники появятся.
    contract_internal_number VARCHAR(64) NULL,
    material VARCHAR(255) NULL,

    platform VARCHAR(255) NOT NULL DEFAULT '',
    -- Дата работы. Храним со временем: за смену одну бирку проходят несколько
    -- раз, и без времени порядок работ по ней теряется.
    performed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    employee_fio VARCHAR(255) NOT NULL DEFAULT '',
    badge VARCHAR(512) NOT NULL DEFAULT '',
    tag VARCHAR(64) NOT NULL,

    -- Фактическая толщина: заполняется только промерами. В перечне колонок ТЗ
    -- её нет, но сценарий промера требует её записать, а класть замер в
    -- «Материал» значило бы смешать разные величины в одной колонке.
    thickness DECIMAL(10,3) NULL,

    -- Автор работы. ФИО и площадка продублированы строками намеренно: журнал
    -- фиксирует, как было в момент работы, а сотрудник позже может сменить
    -- площадку или уволиться.
    user_id BIGINT UNSIGNED NULL,

    -- Ключ идемпотентности: повтор после потерянного ответа не задваивает
    -- работу. Тот же приём уже используется в сдаче и на складе.
    idempotency_key VARCHAR(64) NULL,

    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_work_log_idempotency_unique (idempotency_key),
    KEY erp_work_log_performed_idx (performed_at),
    KEY erp_work_log_tag_idx (tag, performed_at),
    KEY erp_work_log_badge_idx (badge(191), performed_at),
    KEY erp_work_log_platform_idx (platform, performed_at),
    CONSTRAINT erp_work_log_user_fk
        FOREIGN KEY (user_id) REFERENCES erp_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
