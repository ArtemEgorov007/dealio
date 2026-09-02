-- Подтверждение доставки уведомлений.
--
-- До сих пор про рассылку было известно только то, что push-сервис принял
-- сообщение. Это не «показано на экране»: Apple и FCM отвечают успехом и для
-- устройства, где уведомления потом выключили. Дважды подряд приходилось
-- гадать, дошло ли, — вместо того чтобы посмотреть.
--
-- Теперь на каждую отправку заводится строка с одноразовым токеном. Воркер,
-- показав уведомление, отстукивает этим токеном обратно, и строка получает
-- время доставки. Разница между «отправлено» и «доставлено» становится видна.
CREATE TABLE IF NOT EXISTS erp_push_deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    -- Токен, который уезжает в уведомлении и возвращается из воркера. Он же
    -- и есть право пометить строку доставленной: подтверждение приходит из
    -- service worker, где сессии может уже не быть, а угадать 32 случайных
    -- шестнадцатеричных знака нельзя.
    delivery_token CHAR(32) NOT NULL,

    -- Одна рассылка — много строк, по одной на подписку. По этому номеру
    -- собирается отчёт «сколько из скольких».
    broadcast_id VARCHAR(64) NOT NULL,

    user_id BIGINT UNSIGNED NULL,

    -- Адрес подписки не храним целиком: он длинный, содержит идентификатор
    -- устройства и в отчёте не нужен. Хватает сервиса и устройства, чтобы
    -- отличить телефон от рабочего компьютера.
    push_service VARCHAR(128) NOT NULL DEFAULT '',
    device VARCHAR(128) NOT NULL DEFAULT '',

    title VARCHAR(255) NOT NULL DEFAULT '',

    sent_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    -- NULL значит «подтверждения не было»: устройство могло быть выключено,
    -- а могло и отбросить уведомление молча. Отличать одно от другого мы не
    -- умеем и не притворяемся, что умеем.
    delivered_at DATETIME(6) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY erp_push_deliveries_token_unique (delivery_token),
    KEY erp_push_deliveries_broadcast_idx (broadcast_id, delivered_at),
    KEY erp_push_deliveries_sent_idx (sent_at),
    CONSTRAINT erp_push_deliveries_user_fk
        FOREIGN KEY (user_id) REFERENCES erp_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
