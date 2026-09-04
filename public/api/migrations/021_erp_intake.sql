-- Приход: приёмка объектов выполнения работ на площадку.
-- ТЗ — «Приход: функционал для фиксации поступления на площадку объектов
-- выполнения работ», две ветки сценария.

-- Заголовок поставки: то, что вводится на первом экране обоих сценариев —
-- титул (может быть пустым до второго экрана сценария 2), номер накладной,
-- вес, площадка и автор. Фото — отдельной таблицей ниже, тем же приёмом,
-- что erp_invoice_files: BLOB не должен утяжелять список поставок.
--
-- Одна и та же таблица закрывает обе ветки: «Данные» в ТЗ называют «новую
-- таблицу для объектов работы без проектных данных» отдельно от
-- erp_work_objects, но по сценарию 2 пользователь не перечисляет объекты
-- построчно вовсе — сама строка поставки со status='unmatched' и есть эта
-- запись, без отдельной таблицы под несуществующие ещё объекты.
CREATE TABLE IF NOT EXISTS erp_intake_deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    -- NULL до подтверждения: сценарий 2 сохраняет фото раньше, чем титул
    -- становится известен (титул с первого экрана не подошёл, вводится на
    -- втором экране вручную).
    title VARCHAR(128) NULL,
    waybill_number VARCHAR(64) NOT NULL,
    weight_tons DECIMAL(12,3) NOT NULL,
    platform VARCHAR(255) NOT NULL,
    -- 'pending' — фото сохранено, вторая часть сценария ещё не пройдена;
    -- 'matched' — сценарий 1, объекты внесены на приход;
    -- 'unmatched' — сценарий 2, титула нет в системе, ушло уведомление ПТО.
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_by BIGINT UNSIGNED NULL,
    author_fio VARCHAR(255) NOT NULL DEFAULT '',
    -- Снимок ФИО согласующего ПТО — тот же приём, что approver_fio у счетов:
    -- запись переживает и увольнение автора, и увольнение выбранного ПТО.
    pto_user_id BIGINT UNSIGNED NULL,
    pto_fio VARCHAR(255) NULL,
    notified_at DATETIME(6) NULL,
    idempotency_key VARCHAR(64) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_intake_deliveries_idempotency_unique (idempotency_key),
    KEY erp_intake_deliveries_status_idx (status, created_at),
    KEY erp_intake_deliveries_title_idx (title),
    CONSTRAINT erp_intake_deliveries_author_fk FOREIGN KEY (created_by)
        REFERENCES erp_users (id) ON DELETE SET NULL,
    CONSTRAINT erp_intake_deliveries_pto_fk FOREIGN KEY (pto_user_id)
        REFERENCES erp_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Фото накладной. Отдельной таблицей, а не BLOB-колонкой в erp_intake_deliveries
-- — тот же приём и то же обоснование, что у erp_invoice_files (011): BLOB вне
-- списковых запросов, хранение в БД, а не на файловой системе (всё под
-- вебрутом HTTP-доступно, в БД — только через авторизованный обработчик).
CREATE TABLE IF NOT EXISTS erp_intake_delivery_files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    delivery_id BIGINT UNSIGNED NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
    byte_size INT UNSIGNED NOT NULL,
    content LONGBLOB NOT NULL,
    uploaded_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_intake_delivery_files_delivery_unique (delivery_id),
    CONSTRAINT erp_intake_delivery_files_delivery_fk FOREIGN KEY (delivery_id)
        REFERENCES erp_intake_deliveries (id) ON DELETE CASCADE,
    CONSTRAINT erp_intake_delivery_files_uploader_fk FOREIGN KEY (uploaded_by)
        REFERENCES erp_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Какие именно строки erp_work_objects пришли в этой поставке (сценарий 1
-- только). Отдельная таблица, а не колонка delivery_id на erp_work_objects:
-- одна и та же марка теоретически видна в нескольких местах кода как
-- «сколько раз/когда её принимали», а не только «последний раз».
CREATE TABLE IF NOT EXISTS erp_intake_delivery_objects (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    delivery_id BIGINT UNSIGNED NOT NULL,
    work_object_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY erp_intake_delivery_objects_unique (delivery_id, work_object_id),
    KEY erp_intake_delivery_objects_object_idx (work_object_id),
    CONSTRAINT erp_intake_delivery_objects_delivery_fk FOREIGN KEY (delivery_id)
        REFERENCES erp_intake_deliveries (id) ON DELETE CASCADE,
    CONSTRAINT erp_intake_delivery_objects_object_fk FOREIGN KEY (work_object_id)
        REFERENCES erp_work_objects (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Журнал работ впервые получает внутренний номер договора (014 завела
-- колонку заранее — «сценариев её получения ещё нет»; это первый сценарий).
-- Значение читаем из самой строки erp_work_objects, которую приняли на
-- приход — у каждой марки свой договор, выбирать его пользователю не нужно.
