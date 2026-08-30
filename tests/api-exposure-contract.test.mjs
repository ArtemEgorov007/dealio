import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const htaccess = await readFile(new URL('../public/api/.htaccess', import.meta.url), 'utf8')

test('внутренности API закрыты от прямого доступа', () => {
    // public/ целиком выкладывается статикой, поэтому без явного запрета
    // /api/migrations/*.sql скачивался как файл, а /api/src/*.php выполнялся
    // напрямую — в обход Bootstrap, Router и проверки прав.
    assert.match(htaccess, /RewriteRule \^\(src\|migrations\|vendor\)\(\/\|\$\) - \[R=404,L\]/)
    assert.match(htaccess, /RewriteRule \^composer\\\.\(json\|lock\)\$ - \[R=404,L\]/)
})

test('запрет стоит выше правила, пропускающего существующие файлы', () => {
    // Порядок здесь и есть защита: ниже по файлу !-f отдаёт любой
    // существующий файл как статику.
    const deny = htaccess.indexOf('(src|migrations|vendor)')
    const passthrough = htaccess.indexOf('!-f')
    assert.ok(deny > -1 && passthrough > -1, 'оба правила должны быть в файле')
    assert.ok(deny < passthrough, 'запрет должен идти раньше passthrough')
})

test('точка входа одна', () => {
    assert.match(htaccess, /RewriteRule \^ index\.php \[QSA,L\]/)
})
