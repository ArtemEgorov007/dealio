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
    rows: Array<{status: string; volume: number; amountWithVat: number}>
}

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
        groups[index].rows.push({status: row.status, volume: row.volume, amountWithVat: row.amountWithVat})
    }

    return groups
}
