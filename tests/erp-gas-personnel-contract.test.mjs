import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../scripts/erp-gas-webapp.js', import.meta.url), 'utf8')

test('personnel endpoints require staff-management access and handle dynamic rights', () => {
  for (const action of [
    'personnelDepartments',
    'personnelEmployees',
    'personnelEmployee',
    'personnelSave',
    'personnelCreate',
    'personnelDismiss',
  ]) {
    assert.match(source, new RegExp(`payload\\.action === '${action}'`))
  }

  assert.match(source, /header\.indexOf\('Управление кадрами'\)/)
  assert.match(source, /getSheetByName\('Площадки'\)/)
  assert.match(source, /rightsHeaders: header\.slice\(PERSONNEL_RIGHTS_START_INDEX\)/)
  assert.match(source, /'Уволен'/)
  assert.match(source, /LockService\.getScriptLock\(\)/)
})

test('personnel rights always start at column K and include badge access', () => {
  assert.match(source, /const PERSONNEL_RIGHTS_START_INDEX = 10/)
  assert.match(source, /rightsHeaders: header\.slice\(PERSONNEL_RIGHTS_START_INDEX\)/)
  assert.match(source, /for \(let index = PERSONNEL_RIGHTS_START_INDEX;/)
  assert.match(source, /'Доступ к биркам'/)
})

test('уволенные сотрудники скрыты и в списке отдела, и внутри отдела (personnelEmployees_)', () => {
  // 2026-08-26 (e6cd637) добавил фильтр в обе функции; при переносе всего
  // бэкенда под git 2026-08-29 (fc8fa03) фильтр в personnelEmployees_ выпал
  // молча — обнаружилось только при сверке с уже задеплоенным прод-GAS
  // перед деплоем этой задачи. Фиксируем явно, чтобы не потерять снова.
  const start = source.indexOf('function personnelEmployees_(')
  assert.ok(start > -1, 'personnelEmployees_ не найдена')
  const body = source.slice(start, source.indexOf('\n}\n', start) + 3)
  assert.match(body, /if \(normalizeCell_\(row\[context\.schema\.statusIndex\]\) !== ACTIVE_STATUS\) continue/)
})
