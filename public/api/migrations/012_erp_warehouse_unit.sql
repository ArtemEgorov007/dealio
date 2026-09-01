-- Единица измерения в номенклатуре: справочник ТМЦ показывает её третьей
-- колонкой, а заполняют снабженцы прямо в приложении — в исходной таблице
-- этих данных нет вовсе.
ALTER TABLE erp_warehouse_items
    ADD COLUMN unit VARCHAR(32) NOT NULL DEFAULT '' AFTER category;
