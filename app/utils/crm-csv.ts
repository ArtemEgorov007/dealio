/** Парсер CSV с поддержкой кавычек и переносов строк внутри ячеек. */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = []
    let row: string[] = []
    let field = ''
    let inQuotes = false

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index]
        const nextChar = text[index + 1]

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                field += '"'
                index += 1
            } else if (char === '"') {
                inQuotes = false
            } else {
                field += char
            }
            continue
        }

        if (char === '"') {
            inQuotes = true
        } else if (char === ',') {
            row.push(field)
            field = ''
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
            if (char === '\r') index += 1
            row.push(field)
            field = ''
            if (row.some(cell => cell.length > 0)) rows.push(row)
            row = []
        } else if (char !== '\r') {
            field += char
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field)
        if (row.some(cell => cell.length > 0)) rows.push(row)
    }

    return rows
}

/**
 * В исходной таблице часть бирок набрана без пробела между словами
 * (например «Не краситьВес:1,57») — это только для отображения,
 * сама строка бирки (для поиска/выдачи) остаётся нетронутой.
 */
export function formatBadgeDisplay(badge: string): string {
    return badge.replace(/([a-zа-яё])([A-ZА-ЯЁ])/g, '$1 $2')
}
