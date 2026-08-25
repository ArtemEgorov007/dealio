export interface ShiftCounterScope {
    fio?: string
}

export function getShiftCounterScope(role: string, fio: string): ShiftCounterScope {
    if (role.trim().toLocaleLowerCase('ru-RU') === 'менеджер') return {}

    return {fio}
}
