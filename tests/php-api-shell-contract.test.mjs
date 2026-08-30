import assert from 'node:assert/strict'
import {readFile, stat} from 'node:fs/promises'
import test from 'node:test'

const rewrite = await readFile(new URL('../public/api/.htaccess', import.meta.url), 'utf8').catch(() => '')
const index = await readFile(new URL('../public/api/index.php', import.meta.url), 'utf8').catch(() => '')
const source = await readFile(new URL('../public/api/src/Database.php', import.meta.url), 'utf8').catch(() => '')

test('API routes non-file requests through one PHP entry point', () => {
  assert.match(rewrite, /RewriteEngine On/)
  assert.match(rewrite, /RewriteCond %{REQUEST_FILENAME} !-f/)
  assert.match(rewrite, /RewriteCond %{REQUEST_FILENAME} !-d/)
  assert.match(rewrite, /RewriteRule \^ index\.php/)
})

test('API rejects unsafe database configuration before opening PDO', () => {
  assert.match(index, /erp_load_config/)
  assert.match(source, /PDO::ATTR_ERRMODE/)
  assert.match(source, /PDO::ERRMODE_EXCEPTION/)
  assert.match(source, /PDO::ATTR_EMULATE_PREPARES/)
})

test('deployment contains no public SQL bootstrap endpoint', async () => {
  await assert.rejects(stat(new URL('../public/api/_bootstrap_sql.php', import.meta.url)))
})
