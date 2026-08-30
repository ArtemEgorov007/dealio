-- Склад: номенклатура, позиции остатков и неизменяемый лог движений.
-- Схема и обоснование решений — docs/superpowers/specs/2026-08-30-warehouse-supply-sql-design.md

CREATE TABLE IF NOT EXISTS erp_warehouse_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_warehouse_items_name_unique (name),
    KEY erp_warehouse_items_category_idx (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Позиция склада = площадка + ячейка + наименование + тип + категория.
-- Именно этот составной ключ используется в листах «Склад» и «Лог» как «ID».
--
-- Колонок «Поступление», «Выдача» и «Остаток» здесь намеренно нет: остаток
-- вычисляется из лога поверх opening_balance (см. erp_warehouse_balance ниже).
-- Два независимых источника одного числа расходятся, а расхождение по остаткам
-- ТМЦ дороже лишнего запроса.
CREATE TABLE IF NOT EXISTS erp_warehouse_stock (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    stock_key VARCHAR(512) NOT NULL,
    platform VARCHAR(255) NOT NULL,
    cell VARCHAR(255) NOT NULL DEFAULT '',
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(64) NOT NULL DEFAULT '',
    category VARCHAR(255) NOT NULL DEFAULT '',
    unit VARCHAR(32) NOT NULL DEFAULT '',
    -- Остаток на момент переноса из таблицы. Нужен потому, что текущие остатки
    -- в лог никогда не писались: там только строки первичного импорта с
    -- нулевым количеством. Без этого поля переход на расчёт из лога обнулил бы
    -- реальный склад.
    opening_balance DECIMAL(15,3) NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_warehouse_stock_key_unique (stock_key),
    KEY erp_warehouse_stock_platform_idx (platform, category),
    KEY erp_warehouse_stock_item_idx (item_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Лог только пополняется. Исправление ошибочной операции — компенсирующая
-- запись, а не UPDATE/DELETE: по логу должно быть можно восстановить остаток
-- на любую дату и расследовать расхождение.
--
-- quantity всегда положительное, направление задаёт action.
CREATE TABLE IF NOT EXISTS erp_warehouse_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    occurred_at DATETIME(6) NOT NULL,
    platform VARCHAR(255) NOT NULL,
    action ENUM('receipt', 'issue', 'transfer') NOT NULL,
    cell VARCHAR(255) NOT NULL DEFAULT '',
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(64) NOT NULL DEFAULT '',
    category VARCHAR(255) NOT NULL DEFAULT '',
    quantity DECIMAL(15,3) NOT NULL,
    unit VARCHAR(32) NOT NULL DEFAULT '',
    received_by VARCHAR(255) NOT NULL DEFAULT '',
    issued_by VARCHAR(255) NOT NULL DEFAULT '',
    recipient VARCHAR(255) NOT NULL DEFAULT '',
    stock_key VARCHAR(512) NOT NULL,
    -- Ключ идемпотентности от клиента. NULL допускается для строк первичного
    -- импорта из таблицы, у которых его нет. В листе колонка «ID» на эту роль
    -- не годится: там лежит ключ позиции, и он повторяется.
    request_id VARCHAR(64) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_warehouse_log_request_id_unique (request_id),
    KEY erp_warehouse_log_stock_idx (stock_key, occurred_at),
    KEY erp_warehouse_log_platform_date_idx (platform, occurred_at),
    KEY erp_warehouse_log_action_idx (action, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Текущий остаток: начальный плюс движения по логу.
-- Перемещение (transfer) на баланс не влияет: оно пишется парой строк
-- issue + receipt, каждая со своим stock_key.
CREATE OR REPLACE VIEW erp_warehouse_balance AS
SELECT
    s.id,
    s.stock_key,
    s.platform,
    s.cell,
    s.item_name,
    s.item_type,
    s.category,
    s.unit,
    s.opening_balance,
    COALESCE(SUM(CASE WHEN l.action = 'receipt' THEN l.quantity ELSE 0 END), 0) AS total_received,
    COALESCE(SUM(CASE WHEN l.action = 'issue' THEN l.quantity ELSE 0 END), 0) AS total_issued,
    s.opening_balance
        + COALESCE(SUM(CASE WHEN l.action = 'receipt' THEN l.quantity ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN l.action = 'issue' THEN l.quantity ELSE 0 END), 0) AS balance
FROM erp_warehouse_stock s
LEFT JOIN erp_warehouse_log l ON l.stock_key = s.stock_key
GROUP BY s.id;
