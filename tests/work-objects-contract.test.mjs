import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
    new URL('../public/api/migrations/016_erp_work_objects.sql', import.meta.url),
    'utf8',
)
const workLog = await readFile(
    new URL('../public/api/migrations/014_erp_work_log.sql', import.meta.url),
    'utf8',
)
const rateDefaults = await readFile(
    new URL('../public/api/migrations/015_erp_contract_rates_defaults.sql', import.meta.url),
    'utf8',
)
// Формат бирки задаёт 017: 016 создала колонку, 017 переопределила выражение.
// Проверяем действующее определение, а не историческое.
const badgeLines = await readFile(
    new URL('../public/api/migrations/017_erp_work_objects_badge_lines.sql', import.meta.url),
    'utf8',
)

test('объект работы не может сослаться на несуществующий договор', () => {
    // Ссылка на внутренний номер, а не на суррогатный id: им договор называют
    // в разговоре, по нему же сцеплены расценки.
    assert.match(
        migration,
        /FOREIGN KEY \(contract_internal_number\) REFERENCES erp_contracts \(internal_number\)/,
    )
    // RESTRICT, а не CASCADE: договор с заведёнными объектами удалять нельзя,
    // иначе проектные данные исчезли бы вместе с ним.
    assert.match(migration, /ON DELETE RESTRICT ON UPDATE CASCADE/)
})

test('индекс и бирка вычисляются, а не заполняются руками', () => {
    // Сцепка, которую можно ввести отдельно от своих частей, рано или поздно
    // с ними разойдётся.
    assert.match(migration, /index_code VARCHAR\(512\)\s+GENERATED ALWAYS AS \(CONCAT\(title, '-', work_object\)\) STORED/)
    assert.match(migration, /badge VARCHAR\(512\)\s+GENERATED ALWAYS AS \(/)
})

test('бирка собирается по формату ТЗ', () => {
    // Титул, объект работы, «Вес: <вес> <цвет>», система покрытия — по строке.
    assert.match(badgeLines, /CONCAT\(\s*title, '\\n',\s*work_object, '\\n',/)
    assert.match(badgeLines, /'Вес: '/)
    // Вес по-русски: запятая и без хвостовых нулей, иначе DECIMAL дал бы
    // «1.570» там, где на существующих бирках стоит «1,57».
    assert.match(badgeLines, /TRIM\(TRAILING '\.' FROM TRIM\(TRAILING '0' FROM weight\)\)/)
    assert.match(badgeLines, /REPLACE\(/)
    // Прочерк — «параметра нет», печатать его незачем.
    assert.match(badgeLines, /WHEN coating_system IN \('', '-'\) THEN ''/)
})

test('строки бирки не съезжают', () => {
    // Смотрим само выражение, а не пояснения к нему: в комментариях
    // отвергнутый CONCAT_WS упоминается по имени.
    const expression = badgeLines.slice(badgeLines.indexOf('ALTER TABLE'))

    // CONCAT_WS выбрасывает пустые части вместе с разделителями: у объекта без
    // веса «Система покрытия» уезжала с четвёртой строки на третью, и номер
    // строки переставал что-либо значить.
    assert.doesNotMatch(expression, /CONCAT_WS/, 'разделители должны стоять явно')

    // Три разделителя — всегда четыре строки, сколько бы частей ни пустовало.
    const separators = expression.match(/'\\n'/g) ?? []
    assert.equal(separators.length, 3, 'в бирке должно быть ровно четыре строки')

    // Отсутствующая часть даёт пустую строку, а не исчезает.
    assert.match(expression, /WHEN weight IS NULL THEN ''/)
    assert.match(expression, /WHEN color = '' THEN ''/)
})

test('формат бирки правится отдельной миграцией, а не задним числом', () => {
    // 016 уже применена, повторно её никто не выполнит: правка на месте
    // разошлась бы с базами, где таблица уже создана.
    assert.match(badgeLines, /ALTER TABLE erp_work_objects\s+MODIFY COLUMN badge/)
    assert.match(migration, /badge VARCHAR\(512\)\s+GENERATED ALWAYS AS \(/, '016 остаётся историей')
})

test('бирка помещается в журнал работ', () => {
    // Бирку сканируют, и по её тексту работа попадает в журнал. Если объявить
    // её шире, чем erp_work_log.badge, длинная бирка обрезалась бы при записи
    // и перестала совпадать сама с собой.
    const logWidth = workLog.match(/badge VARCHAR\((\d+)\)/)
    assert.ok(logWidth, 'в журнале работ должна быть колонка badge')

    const limit = Number(logWidth[1])
    // Действующее объявление — из 017: она переопределила колонку последней.
    const declared = Number(badgeLines.match(/MODIFY COLUMN badge VARCHAR\((\d+)\)/)[1])
    assert.equal(declared, limit, 'ширина бирки должна совпадать с колонкой журнала')

    // Самая длинная возможная бирка складывается из полей-источников и
    // разделителей. Она обязана влезать в объявленную ширину — иначе сужать
    // надо источники, а не бирку.
    const width = name => Number(migration.match(new RegExp(`${name} VARCHAR\\((\\d+)\\)`))[1])
    const weightText = 'Вес: '.length + '999999999,999'.length
    const longest = width('title') + 1
        + width('work_object') + 1
        + weightText + 1 + width('color') + 1
        + width('coating_system')
    assert.ok(
        longest <= limit,
        `предельная бирка ${longest} символов не помещается в ${limit}`,
    )
})

test('дубль объекта в титуле не заводится', () => {
    // Справочник без этого правила молча набирает дубли, а по дублю нельзя
    // сказать, какую из строк описывает отсканированная бирка. Площадка в
    // ключе намеренно: один чертёж изготавливают на двух площадках.
    assert.match(
        migration,
        /UNIQUE KEY erp_work_objects_index_unique\s*\n?\s*\(contract_internal_number, platform, title, work_object\)/,
    )
})

test('уникальный ключ помещается в лимит InnoDB', () => {
    // 3072 байта на ключ, utf8mb4 — четыре байта на символ. Префиксный ключ
    // здесь не годится: он склеивал бы разные значения с одинаковым началом.
    const width = name => Number(migration.match(new RegExp(`${name} VARCHAR\\((\\d+)\\)`))[1])
    const bytes = 4 * (
        width('contract_internal_number')
        + width('platform')
        + width('title')
        + width('work_object')
    )
    assert.ok(bytes <= 3072, `ключ занимает ${bytes} байт при лимите 3072`)
})

test('автор записи переживает увольнение', () => {
    // Ссылка нужна для связи с сотрудником, ФИО — снимком рядом: по
    // ON DELETE SET NULL ссылка обнулится, и без снимка запись потеряла бы
    // автора совсем.
    assert.match(migration, /created_by BIGINT UNSIGNED NULL/)
    assert.match(migration, /author_fio VARCHAR\(255\) NOT NULL DEFAULT ''/)
    assert.match(migration, /FOREIGN KEY \(created_by\) REFERENCES erp_users \(id\) ON DELETE SET NULL/)
})

test('параметры объекта соответствуют параметрам расценки', () => {
    // Расценка договора подбирается по четырём параметрам (param1..param4 в
    // erp_contract_rates). Первые два уже имеют устоявшийся смысл и названы
    // прямо, третий и четвёртый договор назовёт сам.
    // «Нет значения» обе стороны подбора обязаны понимать одинаково: расценки
    // специально ушли с пустой строки на прочерк (015), потому что пустая
    // совпадала бы с любой другой пустой, то есть с чужой расценкой. Объект,
    // оставшийся на пустой строке, склеился бы не с той ценой.
    const rateDefault = rateDefaults.match(/DEFAULT '(-)'/)
    assert.ok(rateDefault, 'в 015 расценки должны иметь прочерк по умолчанию')

    for (const column of ['coating_system', 'coating_thickness', 'param3', 'param4']) {
        assert.match(
            migration,
            new RegExp(`${column} VARCHAR\\(\\d+\\) NOT NULL DEFAULT '${rateDefault[1]}'`),
            `${column} должен иметь то же «нет значения», что и расценка`,
        )
    }

    // Цвет в подборе расценки не участвует — он только печатается в бирке,
    // и прочерк ему поэтому не нужен.
    assert.match(migration, /color VARCHAR\(\d+\) NOT NULL DEFAULT ''/)
    assert.doesNotMatch(migration, /param5/)
})
