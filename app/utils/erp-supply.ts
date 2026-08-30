import {erpApiRequest} from '~/utils/erp-api'

/** Позиция справочника номенклатуры для подсказки в форме заявки. */
export interface ErpSupplyCatalogItem {
    name: string
    category: string
}

/** Строка заявки: что и сколько заказал сотрудник. */
export interface ErpSupplyRequestItem {
    name: string
    quantity: number
    unit: string
    category: string
}

/**
 * Заявка целиком. Позиции сгруппированы по номеру: одна заявка «Колпино-9»
 * может содержать несколько строк номенклатуры.
 */
export interface ErpSupplyRequest {
    requestCode: string
    requestedAt: string
    status: string
    invoice: string
    items: ErpSupplyRequestItem[]
}

export async function fetchSupplyCatalog(): Promise<ErpSupplyCatalogItem[]> {
    const data = await erpApiRequest<{items: ErpSupplyCatalogItem[]}>('supply/catalog')
    return data.items ?? []
}

export async function fetchMySupplyRequests(): Promise<ErpSupplyRequest[]> {
    const data = await erpApiRequest<{requests: ErpSupplyRequest[]}>('supply/my-requests')
    return data.requests ?? []
}

export async function createSupplyRequest(
    items: Array<{name: string; quantity: number}>,
): Promise<{requestCode: string; positions: number}> {
    return erpApiRequest<{requestCode: string; positions: number}>('supply/requests', {
        method: 'POST',
        body: JSON.stringify({items}),
    })
}
