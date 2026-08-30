import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const workflow = await readFile(new URL('../.github/workflows/nuxtjs.yml', import.meta.url), 'utf8')

test('точечные файлы попадают в артефакт', () => {
    // upload-artifact@v4 по умолчанию выбрасывает скрытые файлы, и
    // public/api/.htaccess не доезжал до сервера ни разу. API продолжал
    // работать на копии, залитой когда-то вручную, поэтому пропажа ничем
    // себя не проявляла — пока правка в .htaccess просто не применилась.
    assert.match(workflow, /include-hidden-files: true/)
})

test('сборка без .htaccess не выкладывается', () => {
    assert.match(workflow, /test -f \.output\/public\/api\/\.htaccess/)
})

test('после выкладки проверяется, что выложилось именно оно', () => {
    assert.match(workflow, /name: Verify deployed site/)
    assert.match(workflow, /release\.txt/)
    assert.match(workflow, /test "\$actual" = "\$EXPECTED_SHA"/)
})

test('после выкладки проверяется, что внутренности API закрыты', () => {
    const step = workflow.slice(workflow.indexOf('name: Verify deployed site'))
    for (const path of ['api/composer.json', 'api/src/Auth.php', 'api/vendor/autoload.php']) {
        assert.ok(step.includes(path), `не проверяется ${path}`)
    }
    assert.match(step, /api\/migrations\//)
    assert.match(step, /exit \$fail/)
})
