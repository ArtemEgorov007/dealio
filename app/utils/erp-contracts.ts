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

/** Расценка договора. Смысл параметров задаёт сам договор. */
export interface ErpContractRate {
    id?: number
    param1: string
    param2: string
    param3: string
    param4: string
    priceM2: number | null
    priceTon: number | null
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
 * Сохранение расценок целиком.
 *
 * Экран правит набор целиком, поэтому и отправляем целиком: отдельные ручки
 * «изменить строку» и «удалить строку» дали бы тот же результат ценой
 * рассинхрона, если часть запросов не дойдёт.
 */
export async function saveContractRates(
    id: number,
    rates: Array<{param1: string; param2: string; param3: string; param4: string; priceM2: string; priceTon: string}>,
): Promise<{saved: number}> {
    return erpApiRequest<{saved: number}>(`contracts/${id}/rates`, {
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
