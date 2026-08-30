import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const profile = await readFile(new URL('../app/pages/register.vue', import.meta.url), 'utf8')
const personnelForm = await readFile(new URL('../app/components/erp/ErpPersonnelForm.vue', import.meta.url), 'utf8')

test('home profile keeps department and position in its details list', () => {
  assert.doesNotMatch(profile, /const profileSubtitle = computed\(/)
  assert.match(profile, /:subtitle="employeeStore\.position \|\| undefined"/)
})

test('home profile keeps department and position outside its greeting', () => {
  const profileSection = profile.slice(profile.indexOf('<ErpSectionLabel>Профиль</ErpSectionLabel>'), profile.indexOf('<ErpSectionLabel>Помощь</ErpSectionLabel>'))
  assert.match(profileSection, />Отдел</)
  assert.match(profileSection, />Должность</)
})

test('employee card presents immutable identity as a header', () => {
  assert.match(personnelForm, /const employeeSubtitle = computed\(/)
  assert.match(personnelForm, /props\.employee\?\.department, props\.employee\?\.position/)
  assert.match(personnelForm, /class="personnel-card-head"/)
  assert.match(personnelForm, /\{\{ employee\?\.fio \}\}/)
  assert.match(personnelForm, /\{\{ employeeSubtitle \}\}/)
  assert.doesNotMatch(personnelForm, /personnel-kv__label/)
})

test('employee card identity header uses the profile-blue treatment with white text', () => {
  assert.match(personnelForm, /\.personnel-card-head[\s\S]*?background: #016ED7/)
  assert.match(personnelForm, /\.personnel-card-head__title[\s\S]*?color: #fff/)
  assert.match(personnelForm, /\.personnel-card-head__subtitle[\s\S]*?color: rgba\(255, 255, 255, 0\.82\)/)
})

test('employee rights keep their full labels in the familiar access-card layout', () => {
  assert.match(personnelForm, /Права и доступы/)
  assert.match(personnelForm, /\{\{ right\.name \}\}/)
  assert.match(personnelForm, /personnel-form__rights/)
  assert.match(personnelForm, /personnel-form__right/)
  assert.doesNotMatch(personnelForm, /shortRightLabel/)
})

test('role and rights use the same section-heading component in an employee card', () => {
  assert.match(personnelForm, /<ErpSectionLabel>Роль<\/ErpSectionLabel>/)
  assert.match(personnelForm, /<ErpSectionLabel>Права и доступы<\/ErpSectionLabel>/)
})

test('editable personnel field labels share the section-heading typography', () => {
  assert.match(personnelForm, /<ErpSectionLabel>Площадка<\/ErpSectionLabel>/)
  assert.match(personnelForm, /<ErpSectionLabel>Логин<\/ErpSectionLabel>/)
  assert.match(personnelForm, /<ErpSectionLabel>Пароль<\/ErpSectionLabel>/)
  assert.doesNotMatch(personnelForm, /:deep\(\.ui-select__label\)/)
})
