export const WAREHOUSE_UNITS = ['шт.', 'пар', 'кг', 'м', 'компл.'] as const
export type WarehouseUnit = typeof WAREHOUSE_UNITS[number]

export const WAREHOUSE_TYPES = ['Новый', 'Б/у'] as const
export type WarehouseItemType = typeof WAREHOUSE_TYPES[number]

export interface WarehouseStockItem {
    cell: string
    name: string
    type: string
    category: string
    balance: number
    unit: string
}
