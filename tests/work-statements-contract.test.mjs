import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
    new URL('../public/api/migrations/022_erp_work_statements.sql', import.meta.url),
    'utf8',
)
const auth = await readFile(new URL('../public/api/src/Auth.php', import.meta.url), 'utf8')
const intake = await readFile(new URL('../public/api/src/Intake.php', import.meta.url), 'utf8')
const personnel = await readFile(new URL('../public/api/src/Personnel.php', import.meta.url), 'utf8')
const types = await readFile(new URL('../types/erp.types.ts', import.meta.url), 'utf8')

test('ведомость работ хранит проектные данные и связана с договором', () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_work_statements/i)

    for (const column of [
        'contract_internal_number',
        'work_description',
        'tag',
        'material',
        'thickness',
        'fire_resistance',
        'theoretical_consumption',
        'param1',
        'param2',
        'created_at',
        'updated_at',
    ]) {
        assert.match(migration, new RegExp(`\\b${column}\\b`), `нет колонки ${column}`)
    }

    assert.match(
        migration,
        /FOREIGN KEY \(contract_internal_number\) REFERENCES erp_contracts \(internal_number\)\s+ON DELETE RESTRICT ON UPDATE CASCADE/,
    )
    assert.match(migration, /KEY erp_work_statements_contract_idx \(contract_internal_number\)/)
})

test('право внесения проектных данных выдано работающим сотрудникам ПТО', () => {
    assert.match(
        migration,
        /INSERT INTO erp_user_permissions \(user_id, permission_code, allowed\)\s+SELECT id, 'project_data', 1\s+FROM erp_users\s+WHERE status = 'Работает'/,
    )
    assert.match(migration, /ON DUPLICATE KEY UPDATE allowed = 1/)
})

test('ПТО ищется тем же фильтром, что и в «Приходе» — по отделу ИЛИ должности', () => {
    // department — свободный текст без справочника: часть карточек завела
    // отдел иначе, а должность «Инженер ПТО» — нет. Фильтр только по отделу
    // молча оставил бы половину отдела без права, и заметили бы это уже на
    // жалобе «мне не выдали доступ».
    assert.match(migration, /\(department = 'ПТО' OR position LIKE '%ПТО%'\)/)
    assert.match(intake, /\(department = 'ПТО' OR position LIKE '%ПТО%'\) AND status = 'Работает'/)
})

test('право проектных данных видно в существующей модели прав', () => {
    assert.match(auth, /'project_data'/)
    assert.match(personnel, /'project_data' => 'Внесение проектных данных'/)
    assert.match(types, /project_data: boolean/)
    assert.match(types, /project_data: false/)
})
