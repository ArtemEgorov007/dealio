import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

import {loadTsModule} from './helpers/load-ts.mjs'

const sectionsSource = await readFile(new URL('../app/utils/erp-sections.ts', import.meta.url), 'utf8')
const types = await readFile(new URL('../types/erp.types.ts', import.meta.url), 'utf8')
const middleware = await readFile(new URL('../app/middleware/erp-flow.global.ts', import.meta.url), 'utf8')
const tabbar = await readFile(new URL('../app/components/erp/ErpTabBar.vue', import.meta.url), 'utf8')
const register = await readFile(new URL('../app/pages/register.vue', import.meta.url), 'utf8')
const auth = await readFile(new URL('../public/api/src/Auth.php', import.meta.url), 'utf8')

const {ERP_SECTIONS, erpSectionsFor, erpSectionForRoute} = await loadTsModule(
    new URL('../app/utils/erp-sections.ts', import.meta.url),
)

/** Права из ErpAccessFlags — то, чем реально владеет сотрудник. */
const accessKeys = [...types.matchAll(/^\s{4}(\w+): boolean$/gm)].map(m => m[1])

/** Разделы, закрытые правом в middleware: '/путь': 'право'. */
const guarded = [...middleware.matchAll(/'(\/[\w-]+)': '(\w+)'/g)].map(m => ({route: m[1], key: m[2]}))

test('разделы перечислены в одном месте', () => {
    // Список жил в таб-баре и на плитках отдельно и разошёлся: «Договоры»
    // появились на плитках, а в нижнем меню их не было — раздел существовал,
    // но добраться до него оттуда было нельзя.
    assert.match(tabbar, /erpSectionsFor\(employeeStore\.access\)/)
    assert.match(register, /erpSectionsFor\(employeeStore\.access\)/)
    assert.doesNotMatch(tabbar, /v-if="!employeeStore\.hasFio \|\| access\./, 'вкладки не перечисляются поимённо')
    assert.doesNotMatch(register, /\{key: '\w+', to: '/, 'плитки не перечисляются поимённо')
})

test('вкладки рисуются перебором, а не по одной', () => {
    // Новый раздел должен появляться сам, без правки разметки.
    assert.match(tabbar, /v-for="section in sections"/)
    assert.match(tabbar, /:name="section\.icon"/)
    assert.match(tabbar, /\{\{ section\.tabLabel \}\}/)
})

test('каждый раздел закрыт существующим правом', () => {
    for (const section of ERP_SECTIONS) {
        assert.ok(accessKeys.includes(section.key), `право «${section.key}» не объявлено в ErpAccessFlags`)
        assert.match(auth, new RegExp(`'${section.key}'`), `права «${section.key}» нет на сервере`)
    }
})

test('у каждого права с разделами есть свой раздел', () => {
    // Иначе право выдаётся, а войти в раздел неоткуда.
    const guardedKeys = [...new Set(guarded.map(g => g.key))]
    const sectionKeys = ERP_SECTIONS.map(s => s.key)
    for (const key of guardedKeys) {
        assert.ok(sectionKeys.includes(key), `право «${key}» закрывает маршруты, но раздела для него нет`)
    }
})

test('каждый закрытый маршрут принадлежит своему разделу', () => {
    // Так активная вкладка подсвечивается на всех экранах раздела, а не
    // только на первом.
    for (const {route, key} of guarded) {
        const section = erpSectionForRoute(route)
        assert.ok(section, `маршрут ${route} не принадлежит ни одному разделу`)
        assert.equal(section.key, key, `маршрут ${route} закрыт правом «${key}», а числится за «${section.key}»`)
    }
})

test('стартовый путь раздела входит в его же маршруты', () => {
    for (const section of ERP_SECTIONS) {
        assert.ok(section.routes.includes(section.to),
            `«${section.label}» ведёт на ${section.to}, но этого пути нет в его routes`)
    }
})

test('маршруты разделов не пересекаются', () => {
    // Иначе один и тот же экран подсвечивал бы две вкладки.
    const seen = new Map()
    for (const section of ERP_SECTIONS) {
        for (const route of section.routes) {
            assert.ok(!seen.has(route), `маршрут ${route} принадлежит и «${seen.get(route)}», и «${section.label}»`)
            seen.set(route, section.label)
        }
    }
})

test('у раздела есть короткое название для таб-бара', () => {
    // В баре помещается одно слово: длинное название ломает вёрстку.
    for (const section of ERP_SECTIONS) {
        assert.ok(section.tabLabel.length > 0, `у «${section.label}» нет tabLabel`)
        assert.ok(section.tabLabel.length <= 12, `«${section.tabLabel}» не поместится в таб-бар`)
    }
})

test('сотрудник видит только свои разделы', () => {
    const access = Object.fromEntries(accessKeys.map(key => [key, false]))
    assert.deepEqual(erpSectionsFor(access), [], 'без прав разделов быть не должно')

    const visible = erpSectionsFor({...access, warehouse: true, contracts: true})
    assert.deepEqual(visible.map(s => s.key), ['warehouse', 'contracts'])
})

test('до входа бар не пустой', () => {
    // Иначе на экране входа нижнее меню выглядит сломанным.
    assert.match(tabbar, /employeeStore\.hasFio \? erpSectionsFor\(employeeStore\.access\) : ERP_SECTIONS/)
})

test('все разделы перечислены в исходнике реестра', () => {
    // Проверяем сам файл, а не только загруженный модуль: так видно, что
    // реестр — это данные, а не собранный на лету список.
    for (const section of ERP_SECTIONS) {
        assert.match(sectionsSource, new RegExp(`key: '${section.key}'`))
    }
})
