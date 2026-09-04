import {erpApiRequest} from '~/utils/erp-api'

/** Данные первого экрана: титулы, ждущие приход, сотрудники ПТО для сценария 2. */
export interface ErpIntakeFormData {
    titles: string[]
    ptoEmployees: string[]
    maxFileBytes: number
}

export async function fetchIntakeForm(): Promise<ErpIntakeFormData> {
    return erpApiRequest<ErpIntakeFormData>('intake/form')
}

export type ErpIntakeDeliveryStatus = 'pending' | 'matched' | 'unmatched'

export interface ErpIntakeDelivery {
    id: number
    title: string | null
    status: ErpIntakeDeliveryStatus
}

/**
 * Создание поставки: титул, накладная, вес, фото. Отправляем FormData, а не
 * JSON — тот же приём, что у счетов: фото в base64 весило бы на треть больше
 * при и без того низком лимите загрузки на хостинге.
 */
export async function createIntakeDelivery(payload: {
    title: string
    waybillNumber: string
    weightTons: string
    photo: File
    idempotencyKey: string
}): Promise<ErpIntakeDelivery> {
    const body = new FormData()
    body.append('title', payload.title)
    body.append('waybillNumber', payload.waybillNumber)
    body.append('weightTons', payload.weightTons)
    body.append('photo', payload.photo)
    body.append('idempotencyKey', payload.idempotencyKey)

    return erpApiRequest<ErpIntakeDelivery>('intake/deliveries', {
        method: 'POST',
        body,
        timeoutMs: 120_000,
    })
}

/** Марка («объект выполнения работ»), ещё не принятая ни на одной площадке. */
export interface ErpIntakeObjectOption {
    id: number
    workObject: string
    contractInternalNumber: string
    area: number | null
    weight: number | null
}

export async function fetchIntakeObjects(title: string): Promise<ErpIntakeObjectOption[]> {
    const data = await erpApiRequest<{objects: ErpIntakeObjectOption[]}>(`intake/objects?title=${encodeURIComponent(title)}`)
    return data.objects ?? []
}

/**
 * skippedIds — марки, которые кто-то другой принял между тем, как список
 * показался пользователю, и этим запросом. Поставка не зависает из-за этого,
 * но эти конкретные марки этой накладной уже не достанутся: показываем,
 * какие именно, а не молчим о расхождении.
 */
export async function completeIntakeMatched(
    deliveryId: number,
    objectIds: number[],
): Promise<{matched: number; skippedIds: number[]}> {
    return erpApiRequest<{matched: number; skippedIds: number[]}>(`intake/deliveries/${deliveryId}/objects`, {
        method: 'POST',
        body: JSON.stringify({objectIds}),
    })
}

export async function completeIntakeUnmatched(
    deliveryId: number,
    payload: {title: string; ptoFio: string},
): Promise<void> {
    await erpApiRequest(`intake/deliveries/${deliveryId}/unmatched`, {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}
