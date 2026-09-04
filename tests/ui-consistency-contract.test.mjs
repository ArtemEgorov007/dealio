import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const button = await readFile(new URL('../app/components/ui/button/Button.vue', import.meta.url), 'utf8')
// reports.vue — хаб из плиток без своих данных и без кнопки «Обновить»;
// реальный экран с обновлением переехал на reports-month.vue.
const reports = await readFile(new URL('../app/pages/reports-month.vue', import.meta.url), 'utf8')
const reportsFull = await readFile(new URL('../app/pages/reports-full.vue', import.meta.url), 'utf8')
const reportsKs = await readFile(new URL('../app/pages/reports-ks.vue', import.meta.url), 'utf8')
const reportsId = await readFile(new URL('../app/pages/reports-id.vue', import.meta.url), 'utf8')
const approvals = await readFile(new URL('../app/pages/approvals.vue', import.meta.url), 'utf8')
const personnelForm = await readFile(new URL('../app/components/erp/ErpPersonnelForm.vue', import.meta.url), 'utf8')
const sectionLabel = await readFile(new URL('../app/components/erp/ErpSectionLabel.vue', import.meta.url), 'utf8')
const erpTheme = await readFile(new URL('../app/assets/css/erp-theme.css', import.meta.url), 'utf8')

test('ERP supports a dedicated inverse system action for blue screen headers', () => {
  assert.match(button, /'inverse'/)
  assert.match(button, /&--inverse/)
  assert.match(button, /border-color:\s*rgba\(255, 255, 255, 0\.72\)/)
  assert.match(button, /color:\s*#fff/)
})

test('reports and approvals use the shared inverse header action instead of page-specific styling', () => {
  assert.match(reports, /variant="inverse"/)
  assert.match(reportsFull, /variant="inverse"/)
  assert.match(reportsKs, /variant="inverse"/)
  assert.match(reportsId, /variant="inverse"/)
  assert.match(approvals, /variant="inverse"/)
})

test('employee form reuses the single ERP section-label component for every editable group', () => {
  for (const label of ['Площадка', 'Роль', 'Логин', 'Пароль', 'Права и доступы']) {
    assert.match(personnelForm, new RegExp(`<ErpSectionLabel>${label}</ErpSectionLabel>`))
  }
  assert.match(sectionLabel, /font-size:\s*13px/)
  assert.match(sectionLabel, /font-weight:\s*600/)
  assert.match(sectionLabel, /color:\s*var\(--color-text-secondary\)/)
})

test('ERP input labels inherit the same heading weight and tracking as employee access sections', () => {
  const inputLabelRule = erpTheme.match(/\.erp-layout \.ui-input__label \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(inputLabelRule, /font-weight:\s*600/)
  assert.match(inputLabelRule, /letter-spacing:\s*-0\.1px/)
  assert.match(inputLabelRule, /color:\s*var\(--color-text-secondary\)/)
})
