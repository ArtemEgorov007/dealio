import {erpApiRequest} from '~/utils/erp-api'

/**
 * Сводка по договору.
 *
 * Аванс, СМР, ИД и КС считаются из таблиц, которых ещё нет: сервер отдаёт
 * нули явными полями, чтобы строки на экране существовали и было видно, что
 * они ждут данных.
 */
export interface ErpContractSummary {
    limitAmount: number
    advance: number
    construction: number
    executiveDocs: number
    acts: number
}

export interface ErpContract {
    id: number
    internalNumber: string
    contractNumber: string
    customer: string
    subject: string
    summary: ErpContractSummary
    ratesCount: number
}

/**
 * Расценка договора. Смысл параметров задаёт сам договор.
 *
 * Пустых значений здесь не бывает: незаполненный параметр хранится прочерком,
 * незаполненная цена — нулём. Параметры участвуют в подборе расценки для
 * журнала работ, и пустая строка совпадала бы с чужой расценкой.
 */
export interface ErpContractRate {
    id: number
    param1: string
    param2: string
    param3: string
    param4: string
    priceM2: number
    priceTon: number
}

export async function fetchContracts(): Promise<ErpContract[]> {
    const data = await erpApiRequest<{contracts: ErpContract[]}>('contracts')
    return data.contracts ?? []
}

export async function fetchContract(id: number): Promise<{contract: ErpContract; rates: ErpContractRate[]}> {
    return erpApiRequest<{contract: ErpContract; rates: ErpContractRate[]}>(`contracts/${id}`)
}

export async function createContract(payload: {
    internalNumber: string
    contractNumber: string
    customer: string
    subject: string
    limitAmount: string
}): Promise<{id: number; internalNumber: string}> {
    return erpApiRequest<{id: number; internalNumber: string}>('contracts', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

/**
 * Сохранение набора расценок.
 *
 * Отправляем весь набор, который экран открыл: строки с id правятся на месте,
 * новые добавляются, пропавшие удаляются. Отдельные ручки «изменить» и
 * «удалить» дали бы тот же результат ценой рассинхрона, если часть запросов
 * не дойдёт.
 *
 * `id: 0` — новая расценка.
 */
export async function saveContractRates(
    id: number,
    rates: Array<{
        id: number
        param1: string
        param2: string
        param3: string
        param4: string
        priceM2: string
        priceTon: string
    }>,
): Promise<{saved: number; removed: number}> {
    return erpApiRequest<{saved: number; removed: number}>(`contracts/${id}/rates`, {
        method: 'POST',
        body: JSON.stringify({rates}),
    })
}

/** Деньги в списках и карточках показываем одинаково. */
export const contractMoney = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
})
