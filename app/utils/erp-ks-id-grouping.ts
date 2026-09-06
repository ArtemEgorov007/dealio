import type {ErpIdRow, ErpKsRow} from '~/utils/erp-api'

/**
 * Группировка листов «КС»/«ИД» по договору — проще, чем groupReportRows для
 * «Лист 15»: тут ровно одно измерение группировки (договор), без выбора
 * между несколькими, и строка листа уже сама по себе строка группы, а не
 * пара «объект + измерение».
 */
export interface ErpKsGroup {
    contract: string
    rows: Array<{number: string; amountWithVat: number; status: string}>
    totalAmountWithVat: number
}

export function groupKsByContract(rows: ErpKsRow[]): ErpKsGroup[] {
    const groups: ErpKsGroup[] = []
    const indexByContract = new Map<string, number>()

    for (const row of rows) {
        let index = indexByContract.get(row.contract)
        if (index === undefined) {
            index = groups.length
            indexByContract.set(row.contract, index)
            groups.push({contract: row.contract, rows: [], totalAmountWithVat: 0})
        }
        groups[index].rows.push({number: row.number, amountWithVat: row.amountWithVat, status: row.status})
        groups[index].totalAmountWithVat += row.amountWithVat
    }

    return groups
}

export interface ErpIdGroup {
    contract: string
    rows: Array<{status: string; area: number; amountWithVat: number}>
}

/**
 * Строка листа «ИД» — отдельный акт (АОСР), а на экране договор
 * разворачивается строками статусов: «Подписана — столько-то площади на
 * столько-то рублей». Актов в договоре под две сотни, поэтому показывать их
 * поштучно бессмысленно — складываем площадь и стоимость по статусу.
 *
 * Порядок статусов — по первому появлению в источнике: он отражает порядок
 * листа, а не алфавит, и не переставляется от выгрузки к выгрузке.
 */
export function groupIdByContract(rows: ErpIdRow[]): ErpIdGroup[] {
    const groups: ErpIdGroup[] = []
    const indexByContract = new Map<string, number>()

    for (const row of rows) {
        let index = indexByContract.get(row.contract)
        if (index === undefined) {
            index = groups.length
            indexByContract.set(row.contract, index)
            groups.push({contract: row.contract, rows: []})
        }

        const lines = groups[index].rows
        const line = lines.find(existing => existing.status === row.status)
        if (line) {
            line.area += row.area
            line.amountWithVat += row.amountWithVat
        } else {
            lines.push({status: row.status, area: row.area, amountWithVat: row.amountWithVat})
        }
    }

    return groups
}
