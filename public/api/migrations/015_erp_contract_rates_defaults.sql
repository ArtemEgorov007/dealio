-- Расценки: пустых значений быть не должно.
--
-- Параметры участвуют в подборе расценки для журнала работ, а цены — в
-- расчётах. Пустая строка и NULL в этих ролях одинаково опасны: сравнение с
-- NULL не даёт ни истины, ни лжи, а незаполненный параметр молча совпадает не
-- с той расценкой. Поэтому «нет значения» записывается явно: прочерк для
-- параметра, ноль для цены.
UPDATE erp_contract_rates SET param1 = '-' WHERE param1 = '';

UPDATE erp_contract_rates SET param2 = '-' WHERE param2 = '';

UPDATE erp_contract_rates SET param3 = '-' WHERE param3 = '';

UPDATE erp_contract_rates SET param4 = '-' WHERE param4 = '';

UPDATE erp_contract_rates SET price_m2 = 0 WHERE price_m2 IS NULL;

UPDATE erp_contract_rates SET price_ton = 0 WHERE price_ton IS NULL;

ALTER TABLE erp_contract_rates
    MODIFY param1 VARCHAR(255) NOT NULL DEFAULT '-',
    MODIFY param2 VARCHAR(255) NOT NULL DEFAULT '-',
    MODIFY param3 VARCHAR(255) NOT NULL DEFAULT '-',
    MODIFY param4 VARCHAR(255) NOT NULL DEFAULT '-',
    MODIFY price_m2 DECIMAL(15,2) NOT NULL DEFAULT 0,
    MODIFY price_ton DECIMAL(15,2) NOT NULL DEFAULT 0;
