/** Appwrite `price` — legacy CRM range 10_000–1_000_000; в UI это приоритет 1–5 */

const PRIORITY_TO_PRICE: Record<number, number> = {
    1: 10_000,
    2: 30_000,
    3: 50_000,
    4: 70_000,
    5: 1_000_000,
}

export function priorityToAppwritePrice(priority: number): number {
    return PRIORITY_TO_PRICE[priority] ?? PRIORITY_TO_PRICE[3]
}

export function appwritePriceToPriority(price: number): number {
    if (price <= 10_000) return 1
    if (price <= 30_000) return 2
    if (price <= 50_000) return 3
    if (price <= 70_000) return 4
    return 5
}
