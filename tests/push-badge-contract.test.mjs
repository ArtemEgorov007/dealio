import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
const appBadge = await readFile(new URL('../app/utils/erp-app-badge.ts', import.meta.url), 'utf8')
const broadcast = await readFile(new URL('../scripts/push-broadcast.php', import.meta.url), 'utf8')
const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'))
const nuxtConfig = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
const push = await readFile(new URL('../public/api/src/Push.php', import.meta.url), 'utf8')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')
const migration = await readFile(
    new URL('../public/api/migrations/018_erp_push_deliveries.sql', import.meta.url),
    'utf8',
)

test('значок непрочитанного ставится через navigator', () => {
    // Badging API живёт на navigator, а не на ServiceWorkerRegistration.
    // Проверка стояла на self.registration, где такого метода нет вовсе:
    // она всегда была ложной, и значок не ставился ни разу ни на одном
    // устройстве — а выглядело это как «пуш не пришёл».
    assert.match(sw, /'setAppBadge' in navigator/)
    assert.match(sw, /navigator\.setAppBadge\(/)
    assert.doesNotMatch(
        sw,
        /self\.registration\.setAppBadge|'setAppBadge' in self\.registration/,
        'у ServiceWorkerRegistration нет setAppBadge',
    )

    // Клиентская утилита обращалась к navigator с самого начала — воркер
    // должен пользоваться тем же API, а не своим.
    assert.match(appBadge, /'setAppBadge' in navigator/)
})

test('значок не мешает показу уведомления', () => {
    // Значок — дополнение к уведомлению, а не его условие: отказ Badging
    // (или отсутствие разрешения) не должен ронять весь обработчик push и
    // оставлять человека вообще без уведомления.
    assert.match(sw, /navigator\.setAppBadge\([^)]*\)\.catch\(/)

    // Само уведомление показывается всегда, вне зависимости от значка.
    const show = sw.slice(sw.indexOf('function showPushNotification'))
    assert.match(show.slice(0, show.indexOf('setAppBadge')), /self\.registration\.showNotification\(/)
})

test('уведомление подписано именем продукта, а не одним экраном', () => {
    // Эту строку браузер показывает как источник уведомления. Она успела
    // устареть: приложение называлось «выдача бирок», когда в нём уже были
    // склад, снабжение, договоры и согласования.
    assert.equal(manifest.name, 'Морфлот Технология')
    assert.equal(manifest.short_name, 'Морфлот')
    assert.match(nuxtConfig, /title: 'Морфлот Технология'/)

    // Название раздела в имени продукта — как раз тот способ устареть.
    for (const value of [manifest.name, manifest.short_name]) {
        assert.doesNotMatch(value, /бирк|выдача/i, `«${value}» называет один экран, а не продукт`)
    }

    // Всё, что видит сотрудник, — по-русски.
    assert.doesNotMatch(manifest.name, /[A-Za-z]/, 'имя приложения должно быть на русском')
    assert.equal(manifest.lang, 'ru')
})

test('воркер подтверждает показ уведомления', () => {
    // «Принято push-сервисом» и «показано человеку» — разные события: Apple и
    // FCM отвечают успехом и для устройства, где уведомления выключили.
    assert.match(sw, /function confirmDelivery\(token\)/)
    assert.match(sw, /fetch\('\/api\/push\/delivered'/)
    assert.match(sw, /deliveryToken: token/)

    // Подтверждение идёт ПОСЛЕ показа: не показали — не подтверждаем, иначе
    // отчёт врал бы ровно в том случае, ради которого он и заводился.
    assert.match(sw, /showPushNotification\(payload\)\.then\(\(\) => confirmDelivery\(payload\.deliveryToken\)\)/)

    // Отказ сети не должен ронять обработчик push: на iOS упавший обработчик
    // ведёт к отзыву подписки, то есть к молчанию навсегда.
    assert.match(sw, /\.catch\(\(\) => undefined\)/)
})

test('подтверждение доставки доступно без сессии, но по токену', () => {
    // Подтверждение приходит из воркера, где сессии может уже не быть:
    // уведомление переживает истёкший вход. Правом служит сам токен.
    assert.match(router, /\$path === '\/push\/delivered'/)
    assert.match(push, /function erp_push_confirm_delivery/)
    assert.doesNotMatch(
        push.slice(push.indexOf('function erp_push_confirm_delivery')),
        /erp_require_user|erp_require_permission/,
        'ручка намеренно без сессии — иначе подтверждать будет некому',
    )

    // Токен обязан быть 32 шестнадцатеричными знаками: угадать нельзя.
    assert.match(push, /\^\[0-9a-f\]\{32\}\$/)
    assert.match(push, /bin2hex\(random_bytes\(16\)\)/)

    // Повторное подтверждение не сдвигает время первого показа.
    assert.match(push, /SET delivered_at = CURRENT_TIMESTAMP\(6\)\s+WHERE delivery_token = :token AND delivered_at IS NULL/)
})

test('неизвестный токен неотличим от повторного подтверждения', () => {
    // Иначе по ответу можно было бы перебирать токены.
    const confirm = push.slice(
        push.indexOf('function erp_push_confirm_delivery'),
        push.indexOf('function erp_push_delivery_report'),
    )
    assert.doesNotMatch(confirm, /rowCount\(\)/, 'ответ не должен зависеть от того, нашлась ли строка')
    assert.match(confirm, /'confirmed' => true/)
})

test('отчёт рассылки показывает, на какие устройства ушло', () => {
    // «Принято push-сервисом» — это ещё не «показано на экране»: сервис
    // принимает сообщение и для устройства, где уведомления потом выключили.
    // Без разбивки по устройствам «отправлено 5» ничего не даёт.
    assert.match(broadcast, /'устройства' => \$devices/)
    assert.match(broadcast, /erp_push_device_label\(/)
    assert.match(broadcast, /s\.user_agent, s\.created_at/)
    assert.match(broadcast, /'подписке дней'/)

    // Разбор устройства живёт в Push.php: у рассылки была своя копия той же
    // функции, и две копии одного разбора разошлись бы при первой правке.
    assert.match(push, /function erp_push_device_label/)
    assert.doesNotMatch(broadcast, /function erp_broadcast_device/, 'дубль разбора устройства')

    // Отчёт различает «принято сервисом» и «показано».
    assert.match(broadcast, /'принято сервисом' => \$sent/)
    assert.match(broadcast, /erp_push_delivery_report\(/)
    assert.match(broadcast, /'доставка' => \$delivery\['подробно'\]/)
})

test('строка доставки хранит токен и время показа', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_push_deliveries/)
    assert.match(migration, /delivery_token CHAR\(32\) NOT NULL/)
    assert.match(migration, /UNIQUE KEY erp_push_deliveries_token_unique/)
    // NULL значит «подтверждения не было» — отличать спящее устройство от
    // отброшенного уведомления мы не умеем и не притворяемся.
    assert.match(migration, /delivered_at DATETIME\(6\) NULL/)
    // Адрес подписки целиком не храним: он длинный и в отчёте не нужен.
    assert.doesNotMatch(migration, /endpoint /)
})

test('выбывшие из рассылки видны, а не исчезают молча', () => {
    // Человек пропадает из получателей бесшумно: подписку отозвали или
    // сотрудника перевели в неработающие — счётчик просто становится меньше.
    // Заметить это можно, только помня прошлый прогон наизусть.
    assert.match(broadcast, /'не в рассылке'/)
    assert.match(broadcast, /s\.revoked_at IS NOT NULL OR u\.status <> 'Работает'/)
    assert.match(broadcast, /'подписка отозвана'/)
})
