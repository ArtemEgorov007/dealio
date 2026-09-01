-- Договоры и расценки по ним.

-- Внутренний номер — рабочий идентификатор договора: по нему договор называют
-- в разговоре и по нему же он связывается с расценками. Поэтому он уникален
-- и служит целью внешнего ключа, а не суррогатный id: так расценка не может
-- сослаться на несуществующий договор, а внутренний номер не приходится
-- дублировать в двух местах.
CREATE TABLE IF NOT EXISTS erp_contracts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    internal_number VARCHAR(64) NOT NULL,
    contract_number VARCHAR(128) NOT NULL,
    customer VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    limit_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_contracts_internal_unique (internal_number),
    KEY erp_contracts_customer_idx (customer),
    CONSTRAINT erp_contracts_author_fk
        FOREIGN KEY (created_by) REFERENCES erp_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Расценки по договору.
--
-- Смысл параметров задаёт договор, а не система: в одном это диаметр и марка
-- стали, в другом — тип покрытия и слой. Поэтому четыре свободных текстовых
-- поля, а не жёсткая схема, которую пришлось бы менять под каждый договор.
--
-- Цены двух видов: договоры считают и по площади, и по массе. Обе NULL, если
-- в конкретной расценке применима только одна.
CREATE TABLE IF NOT EXISTS erp_contract_rates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    internal_number VARCHAR(64) NOT NULL,
    param1 VARCHAR(255) NOT NULL DEFAULT '',
    param2 VARCHAR(255) NOT NULL DEFAULT '',
    param3 VARCHAR(255) NOT NULL DEFAULT '',
    param4 VARCHAR(255) NOT NULL DEFAULT '',
    price_m2 DECIMAL(15,2) NULL,
    price_ton DECIMAL(15,2) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY erp_contract_rates_contract_idx (internal_number),
    CONSTRAINT erp_contract_rates_contract_fk
        FOREIGN KEY (internal_number) REFERENCES erp_contracts (internal_number)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Право «Работа с договорами» выдаём по должностям, как просило руководство.
--
-- «Руководитель ПТО» в справочнике должностей отсутствует: есть «Ведущий
-- инженер ПТО», «Инженер ПТО» и «Руководитель отдела». Наугад не выдаём —
-- право проставляется через раздел «Кадры», когда должность назовут точно.
INSERT INTO erp_user_permissions (user_id, permission_code, allowed)
SELECT id, 'contracts', 1
FROM erp_users
WHERE status = 'Работает'
  AND position IN ('Главный экономист', 'Генеральный директор', 'Коммерческий директор')
ON DUPLICATE KEY UPDATE allowed = 1;
