import type {WarehouseStockItem} from '~~/types/warehouse.types'
import {erpApiRequest, getErpBackendMode} from '~/utils/erp-api'

// Склад работает через тот же переключатель бэкенда, что и остальные модули:
// в режиме sql идём в PHP API, в gas — в исторический Apps Script.
// Остаток в SQL не хранится полем, его считает представление на сервере.

interface WarehouseConfig {
    gasUrl: string
}

function getConfig(): WarehouseConfig {
    const config = useRuntimeConfig()
    return {gasUrl: config.public.warehouseGasUrl || ''}
}

interface WarehouseGasResponse {
    ok?: boolean
    error?: string
    categories?: string[]
    platforms?: string[]
    items?: string[] | WarehouseStockItem[]
}

function buildUrl(gasUrl: string, params: Record<string, string>): string {
    const url = new URL(gasUrl)
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
    }
    return url.toString()
}

async function requestGet(params: Record<string, string>): Promise<WarehouseGasResponse> {
    const config = getConfig()
    if (!config.gasUrl) throw new Error('Склад не подключён')

    let response: Response
    try {
        response = await fetch(buildUrl(config.gasUrl, params))
    } catch {
        throw new Error('Нет связи с сервером. Проверьте интернет и повторите.')
    }

    if (!response.ok) throw new Error('Ошибка связи со складом')

    try {
        return await response.json() as WarehouseGasResponse
    } catch {
        throw new Error('Неверный ответ от сервера.')
    }
}

async function requestPost(payload: Record<string, string | number>): Promise<WarehouseGasResponse> {
    const config = getConfig()
    if (!config.gasUrl) throw new Error('Склад не подключён')

    let response: Response
    try {
        response = await fetch(config.gasUrl, {
            method: 'POST',
            headers: {'Content-Type': 'text/plain;charset=utf-8'},
            body: JSON.stringify(payload),
            redirect: 'follow',
        })
    } catch {
        throw new Error('Нет связи с сервером. Проверьте интернет и повторите.')
    }

    if (!response.ok) throw new Error('Ошибка связи со складом')

    try {
        return await response.json() as WarehouseGasResponse
    } catch {
        throw new Error('Неверный ответ от сервера. Обновите страницу и попробуйте снова.')
    }
}

export async function fetchWarehouseCategories(): Promise<string[]> {
    if (getErpBackendMode() === 'sql') {
        const data = await erpApiRequest<{categories: string[]}>('warehouse/categories')
        return data.categories ?? []
    }

    const result = await requestGet({action: 'categories'})
    if (!result.ok) throw new Error(result.error || 'Не удалось загрузить категории')
    return (result.categories as string[]) ?? []
}

export async function fetchWarehousePlatforms(): Promise<string[]> {
    if (getErpBackendMode() === 'sql') {
        const data = await erpApiRequest<{platforms: string[]}>('warehouse/platforms')
        return data.platforms ?? []
    }

    const result = await requestGet({action: 'platforms'})
    if (!result.ok) throw new Error(result.error || 'Не удалось загрузить список площадок')
    return (result.platforms as string[]) ?? []
}

export async function fetchWarehouseItems(category: string): Promise<string[]> {
    if (getErpBackendMode() === 'sql') {
        const data = await erpApiRequest<{items: string[]}>(`warehouse/items?category=${encodeURIComponent(category)}`)
        return data.items ?? []
    }

    const result = await requestGet({action: 'items', category})
    if (!result.ok) throw new Error(result.error || 'Не удалось загрузить список товаров')
    return (result.items as string[]) ?? []
}

export async function fetchWarehouseStock(platform: string, category?: string): Promise<WarehouseStockItem[]> {
    if (getErpBackendMode() === 'sql') {
        const query = new URLSearchParams({platform})
        if (category) query.set('category', category)
        const data = await erpApiRequest<{items: WarehouseStockItem[]}>(`warehouse/stock?${query.toString()}`)
        return data.items ?? []
    }

    const params: Record<string, string> = {action: 'stock', platform}
    if (category) params.category = category
    const result = await requestGet(params)
    if (!result.ok) throw new Error(result.error || 'Не удалось загрузить остатки')
    return (result.items as WarehouseStockItem[]) ?? []
}

export interface ReceiveItemPayload {
    platform: string
    cell: string
    name: string
    type: string
    qty: number
    unit: string
    fio: string
    requestId: string
}

export async function receiveWarehouseItem(payload: ReceiveItemPayload): Promise<void> {
    if (getErpBackendMode() === 'sql') {
        await erpApiRequest('warehouse/receive', {method: 'POST', body: JSON.stringify(payload)})
        return
    }

    const result = await requestPost({action: 'receiveItem', ...payload})
    if (!result.ok) throw new Error(result.error || 'Не удалось оформить приём')
}

export interface IssueItemPayload {
    platform: string
    cell: string
    name: string
    type: string
    qty: number
    unit: string
    fio: string
    recipientFio: string
    requestId: string
}

export async function issueWarehouseItem(payload: IssueItemPayload): Promise<void> {
    if (getErpBackendMode() === 'sql') {
        await erpApiRequest('warehouse/issue', {method: 'POST', body: JSON.stringify(payload)})
        return
    }

    const result = await requestPost({action: 'issueItem', ...payload})
    if (!result.ok) throw new Error(result.error || 'Не удалось оформить выдачу')
}
