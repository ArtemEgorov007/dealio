# Deploy ERP

Сайт собирается в GitHub Actions и загружается на хостинг по SFTP. Публикация на GitHub Pages не используется. SFTP автоматически доступен на виртуальном хостинге Рег.ру и использует порт 22. [Документация Рег.ру](https://help.reg.ru/support/hosting/dostupy-i-podklyucheniye-panel-upravleniya-ftp-ssh/protokol-peredachi-dannykh-sftp)

## Окружения GitHub

В **Settings → Environments** создать `staging` и `production`. Для каждого окружения задать одинаковые имена секретов:

- `SFTP_HOST` — хост SFTP хостинга;
- `SFTP_USERNAME` и `SFTP_PASSWORD` — учётная запись SFTP;
- `SFTP_KNOWN_HOSTS` — проверенный публичный ключ сервера в формате `known_hosts`;
- `NUXT_PUBLIC_ERP_GAS_URL` — URL основного GAS web app;
- `NUXT_PUBLIC_WAREHOUSE_GAS_URL` — URL складского GAS web app.

В переменных окружения задать:

- `SFTP_PORT`: `22`;
- `SFTP_SERVER_DIR`: `/www/erp-mt.online/` для staging, `/www/erp-mt.ru/` для production;
- `DEPLOY_URL`: соответственно `https://erp-mt.online` и `https://erp-mt.ru`.

Для обоих окружений включить правило **Selected branches and tags → main**: staging-секреты не должны быть доступны коду из произвольной ветки. Для `production` дополнительно включить **Required reviewers**. Без этих ограничений GitHub Environment допускает запуск с другой ветки, а без reviewers production не требует ручного подтверждения.

`NUXT_PUBLIC_*` попадают в статический клиентский bundle. Их можно хранить в GitHub Secrets, чтобы не класть URL в репозиторий, но в них нельзя передавать логины, пароли и другие приватные данные.

## Процесс

1. Push в `main` автоматически собирает приложение и выкладывает его в `staging`.
2. Проверить `https://erp-mt.online` вручную.
3. В Actions выбрать **Build and deploy ERP static site** → **Run workflow** → `production`.
4. Подтвердить deployment в GitHub Environment и проверить `https://erp-mt.ru`.

Деплой выполняет только `scp` новых файлов и никогда не удаляет существующие файлы на хостинге. Это защищает от случайной потери файлов при первой настройке. После нескольких успешных релизов можно отдельно согласовать стратегию удаления устаревших assets.
