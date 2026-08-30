import assert from 'node:assert/strict'
import {readdir, readFile} from 'node:fs/promises'
import test from 'node:test'

const srcDir = new URL('../public/api/src/', import.meta.url)
const database = await readFile(new URL('Database.php', srcDir), 'utf8')
const migrations = await readFile(new URL('Migrations.php', srcDir), 'utf8')

test('схему получает каждый, кто получил соединение', () => {
    // Вызов стоял в согласованиях и push-подписках, и новый раздел работал
    // только потому, что пользователь до него успевал открыть экран, который
    // этот вызов задевал.
    const factory = database.slice(database.indexOf('function erp_database'))
    assert.match(factory, /erp_apply_migrations\(\$pdo, __DIR__ \. '\/\.\.\/migrations'\)/)
    assert.match(factory, /return \$pdo;/)
})

test('вызов ровно один — в фабрике соединения', async () => {
    const names = (await readdir(srcDir)).filter(name => name.endsWith('.php'))
    const callers = []
    for (const name of names) {
        const source = await readFile(new URL(name, srcDir), 'utf8')
        // Объявление функции в Migrations.php вызовом не считаем.
        if (/erp_apply_migrations\(\$pdo/.test(source)) {
            callers.push(name)
        }
    }
    assert.deepEqual(callers, ['Database.php'], `лишние вызовы: ${callers.join(', ')}`)
})

test('применённые миграции читаются одним запросом', () => {
    // Проверка идёт на каждом обращении к базе, а миграции меняются раз в
    // релиз: SELECT на каждый файл — это N лишних round-trip'ов на запрос.
    assert.match(migrations, /SELECT migration_name FROM erp_schema_migrations/)
    assert.doesNotMatch(migrations, /WHERE migration_name = :migration_name/)
})

test('когда применять нечего — файлы не читаются', () => {
    const applyBody = migrations.slice(migrations.indexOf('function erp_apply_migrations'))
    const earlyReturn = applyBody.indexOf('return 0;')
    const firstRead = applyBody.indexOf('file_get_contents')
    assert.ok(earlyReturn > -1, 'должен быть ранний выход')
    assert.ok(earlyReturn < firstRead, 'ранний выход должен стоять до чтения файлов')
})
