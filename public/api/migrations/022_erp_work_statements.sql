-- Ведомость работ: исходные проектные характеристики выполняемых работ.
--
-- Это хранилище, а не экран ввода. API и UI появятся отдельным этапом, когда
-- утвердят процесс загрузки ведомостей. Поэтому здесь нет эвристик, триггеров
-- и неявной перезаписи проектных данных.
CREATE TABLE IF NOT EXISTS erp_work_statements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    -- Внутренний номер — рабочий ключ договора во всей ERP: по нему уже
    -- связаны расценки и объекты работ. RESTRICT сохраняет ведомость при
    -- попытке удалить договор: потерять проектные данные нельзя.
    contract_internal_number VARCHAR(64) NOT NULL,

    work_description TEXT NOT NULL,
    tag VARCHAR(255) NOT NULL DEFAULT '',
    material VARCHAR(255) NOT NULL DEFAULT '',
    thickness DECIMAL(12,3) NULL,
    fire_resistance VARCHAR(128) NOT NULL DEFAULT '',
    theoretical_consumption DECIMAL(15,3) NULL,

    -- Параметры храним явно, хотя по текущей договорённости они повторяют тег
    -- и предел огнестойкости. Будущий экран подставит эти значения по
    -- умолчанию; триггер здесь был бы опасен — он молча переписывал бы импорт.
    param1 VARCHAR(255) NOT NULL DEFAULT '',
    param2 VARCHAR(128) NOT NULL DEFAULT '',

    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY erp_work_statements_contract_idx (contract_internal_number),
    CONSTRAINT erp_work_statements_contract_fk
        FOREIGN KEY (contract_internal_number) REFERENCES erp_contracts (internal_number)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Существующие работающие сотрудники ПТО получают право сразу. Новым
-- сотрудникам его выдаёт обычная карточка «Кадры»: миграция не должна
-- перезаписывать индивидуальное решение кадров при повторных запусках.
--
-- Отдел и должность проверяем вместе — тем же фильтром, что «Приход»
-- (erp_intake_options в public/api/src/Intake.php). department — свободный
-- текст без справочника: часть карточек завела отдел иначе, а должность
-- «Инженер ПТО» / «Ведущий инженер ПТО» — нет. По одному отделу половина
-- отдела молча осталась бы без права.
INSERT INTO erp_user_permissions (user_id, permission_code, allowed)
SELECT id, 'project_data', 1
FROM erp_users
WHERE status = 'Работает'
  AND (department = 'ПТО' OR position LIKE '%ПТО%')
ON DUPLICATE KEY UPDATE allowed = 1;
