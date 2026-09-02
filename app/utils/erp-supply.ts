import {erpApiRequest} from '~/utils/erp-api'

/**
 * Ссылка на PDF счёта. Была локальной функцией на экране «Все счета» —
 * согласующему на экране «Согласования» нужна та же ссылка на тот же
 * маршрут, и второй копии эта строка не заслуживала.
 */
export function invoiceFileUrl(id: number): string {
    return `${useRuntimeConfig().public.erpApiBase || '/api'}/supply-work/invoices/${id}/file`
}

/** Позиция справочника номенклатуры. */
export interface ErpSupplyCatalogItem {
    id: number
    name: string
    category: string
    /** Единица измерения. Пустая, пока снабженец её не проставил. */
    unit: string
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

/**
 * Договор в выпадающем списке при заведении счёта.
 *
 * Счёт связывается с договором по внутреннему номеру — он и попадает в поле,
 * а заказчик показывается подписью, чтобы номер не приходилось помнить.
 */
export interface ErpInvoiceContractOption {
    internalNumber: string
    customer: string
}

/** Заявка в выпадающем списке при заведении счёта. */
export interface ErpInvoiceRequestOption {
    requestCode: string
    platform: string
    department: string
    category: string
    employeeFio: string
    requestedAt: string
    status: string
}

/** Всё, что нужно форме счёта, одним запросом. */
export interface ErpInvoiceFormData {
    requests: ErpInvoiceRequestOption[]
    contracts: ErpInvoiceContractOption[]
    approvers: string[]
    /** Сколько байт реально примет сервер: настройки PHP бывают ниже нашей границы. */
    maxFileBytes: number
    /** Часто используемые единицы измерения — подсказки в справочнике ТМЦ. */
    units: string[]
}

/** Счёт в списке «Все счета». */
export interface ErpInvoice {
    id: number
    invoice: string
    contract: string
    requestCode: string
    department: string
    platform: string
    status: string
    amount: number
    category: string
    approverFio: string
    /** ФИО сотрудника снабжения, завёдшего счёт. */
    authorFio: string
    /** Заказчик по договору. Пусто, если договор не указан или не из справочника. */
    customer: string
    approvedRoAt: string
    approvedGdAt: string
    /** Кто согласовал на этапе ГД — не привязано к одному человеку, любой директор. */
    approvedGdFio: string
    cancelledAt: string
    /** Кто отклонил — РО или ГД, оба могут. */
    rejectedByFio: string
    hasFile: boolean
}

export async function fetchInvoiceFormData(): Promise<ErpInvoiceFormData> {
    return erpApiRequest<ErpInvoiceFormData>('supply-work/form')
}

export async function fetchInvoices(): Promise<ErpInvoice[]> {
    const data = await erpApiRequest<{invoices: ErpInvoice[]}>('supply-work/invoices')
    return data.invoices ?? []
}

/**
 * Заведение счёта.
 *
 * Отправляем FormData, а не JSON: PDF в JSON пришлось бы кодировать base64,
 * это плюс треть к размеру при и без того низком лимите загрузки на хостинге.
 */
export async function createInvoice(payload: {
    invoice: string
    contract: string
    requestCode: string
    amount: string
    approverFio: string
    file: File
}): Promise<{id: number; invoice: string}> {
    const body = new FormData()
    body.append('invoice', payload.invoice)
    body.append('contract', payload.contract)
    body.append('requestCode', payload.requestCode)
    body.append('amount', payload.amount)
    body.append('approverFio', payload.approverFio)
    body.append('file', payload.file)

    // Content-Type не задаём: браузер сам проставит boundary для multipart.
    // Минута с запасом: 8 МБ по мобильной связи в общий таймаут не влезают.
    return erpApiRequest<{id: number; invoice: string}>('supply-work/invoices', {
        method: 'POST',
        body,
        timeoutMs: 120_000,
    })
}

/** Остаток позиции на одной складской ячейке. */
export interface ErpItemStockRow {
    platform: string
    cell: string
    itemType: string
    unit: string
    balance: number
}

export interface ErpItemStock {
    name: string
    unit: string
    total: number
    stock: ErpItemStockRow[]
}

export async function createCatalogItem(item: {name: string; category: string; unit: string}): Promise<ErpSupplyCatalogItem> {
    return erpApiRequest<ErpSupplyCatalogItem>('supply-work/items', {
        method: 'POST',
        body: JSON.stringify(item),
    })
}

/**
 * Правка позиции справочника.
 *
 * Переименование сервер переносит на складские строки в своей транзакции:
 * остаток хранится с составным ключом, куда входит наименование.
 */
export async function updateCatalogItem(
    id: number,
    item: {name: string; category: string; unit: string},
): Promise<ErpSupplyCatalogItem> {
    return erpApiRequest<ErpSupplyCatalogItem>(`supply-work/items/${id}`, {
        method: 'POST',
        body: JSON.stringify(item),
    })
}

export async function deleteCatalogItem(id: number): Promise<void> {
    await erpApiRequest(`supply-work/items/${id}`, {method: 'DELETE'})
}

/** Остатки позиции по площадкам. */
export async function fetchItemStock(id: number): Promise<ErpItemStock> {
    return erpApiRequest<ErpItemStock>(`supply-work/items/${id}/stock`)
}
