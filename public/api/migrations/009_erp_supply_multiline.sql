-- Заявка на снабжение состоит из нескольких позиций: одна заявка «Колпино-9»
-- даёт столько строк, сколько номенклатуры выбрал сотрудник. Уникальность
-- request_code этому мешала — заменяем на обычный индекс.
ALTER TABLE erp_supply_requests
    DROP INDEX erp_supply_requests_code_unique,
    ADD KEY erp_supply_requests_code_idx (request_code);

-- Порядковый номер заявки внутри площадки.
--
-- Считать его как MAX(...)+1 нельзя: два сотрудника одной площадки, нажавшие
-- «Заказать» одновременно, прочитают одинаковый максимум и создадут две
-- разные заявки с номером «Колпино-9». Счётчик инкрементируется атомарно
-- одним запросом, поэтому одинаковый номер выдать невозможно.
CREATE TABLE IF NOT EXISTS erp_supply_request_counters (
    platform VARCHAR(255) NOT NULL,
    last_seq INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Автор заявки. Нужен, чтобы показывать сотруднику «Ваши заявки» и слать ему
-- уведомление при смене статуса: ФИО для этого ненадёжно — оно меняется
-- и повторяется.
ALTER TABLE erp_supply_requests
    ADD COLUMN author_user_id BIGINT UNSIGNED NULL AFTER id,
    ADD KEY erp_supply_requests_author_idx (author_user_id, requested_at),
    ADD CONSTRAINT erp_supply_requests_author_fk
        FOREIGN KEY (author_user_id) REFERENCES erp_users (id) ON DELETE SET NULL;

-- Перенос существующих кодов в счётчик, иначе первая же заявка после импорта
-- получила бы номер 1 и столкнулась с уже существующей «Колпино-1».
INSERT INTO erp_supply_request_counters (platform, last_seq)
SELECT platform, MAX(CAST(SUBSTRING_INDEX(request_code, '-', -1) AS UNSIGNED))
FROM erp_supply_requests
WHERE platform <> '' AND request_code REGEXP '-[0-9]+$'
GROUP BY platform
ON DUPLICATE KEY UPDATE last_seq = GREATEST(last_seq, VALUES(last_seq));
