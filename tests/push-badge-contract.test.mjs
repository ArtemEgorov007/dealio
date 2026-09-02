import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
const appBadge = await readFile(new URL('../app/utils/erp-app-badge.ts', import.meta.url), 'utf8')
const broadcast = await readFile(new URL('../scripts/push-broadcast.php', import.meta.url), 'utf8')
const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'))
const nuxtConfig = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8')

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

test('отчёт рассылки показывает, на какие устройства ушло', () => {
    // «Принято push-сервисом» — это ещё не «показано на экране»: сервис
    // принимает сообщение и для устройства, где уведомления потом выключили.
    // Без разбивки по устройствам «отправлено 5» ничего не даёт.
    assert.match(broadcast, /'devices' => \$devices/)
    assert.match(broadcast, /function erp_broadcast_device/)
    assert.match(broadcast, /s\.user_agent, s\.created_at/)
    assert.match(broadcast, /'подписке дней'/)
})
