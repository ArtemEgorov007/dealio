import assert from 'node:assert/strict'
import {existsSync, readdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import test from 'node:test'

// Миграции применяет PHP-рантайм на сервере (Approvals.php / Push.php ->
// erp_apply_migrations(__DIR__ . '/../migrations')), а деплой заливает только
// public/api/. Значит единственное место, где миграции обязаны лежать, —
// public/api/migrations. Любая вторая копия в репозитории рано или поздно
// разъезжается: так уже пропала 004_erp_catalog_sync.sql, и таблица
// erp_catalog_sync_runs не создавалась на чистой базе.

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const canonicalDir = `${repoRoot}public/api/migrations`

const migrationFiles = () =>
    readdirSync(canonicalDir)
        .filter(name => /^\d{3}_.*\.sql$/.test(name))
        .sort()

test('канонический каталог миграций существует и не пуст', () => {
    assert.ok(existsSync(canonicalDir), 'нет public/api/migrations — рантайму нечего применять')
    assert.ok(migrationFiles().length > 0, 'в каноническом каталоге нет ни одной миграции')
})

test('нумерация миграций сплошная, без пропусков', () => {
    const numbers = migrationFiles().map(name => Number(name.slice(0, 3)))

    numbers.forEach((number, index) => {
        assert.equal(
            number,
            index + 1,
            `разрыв в нумерации миграций: после ${String(index).padStart(3, '0')} ожидалась ` +
            `${String(index + 1).padStart(3, '0')}, а найдена ${String(number).padStart(3, '0')}. ` +
            'Пропущенная миграция не применится на чистой базе.',
        )
    })
})

test('второго каталога миграций в репозитории нет', () => {
    // database/migrations был дублем public/api/migrations и разъехался с ним.
    // Возврат такой копии снова приведёт к ручной синхронизации и потере файлов.
    assert.ok(
        !existsSync(`${repoRoot}database/migrations`),
        'database/migrations вернулся: миграции должны жить только в public/api/migrations',
    )
})
