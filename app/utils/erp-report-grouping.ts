import type {ErpReportRow} from '~/utils/erp-api'

export type ErpReportGroupMode = 'contract' | 'site' | 'customer'

export interface ErpReportGroupLine {
  label: string
  productionRub: number
  shippedTons: number
}

export interface ErpReportGroup {
  key: string
  title: string
  subtitle?: string
  rows: ErpReportGroupLine[]
  totals: {
    productionRub: number
    shippedTons: number
  }
}

function displayKey(value: string): string {
  const trimmed = value.trim()
  return trimmed === '' ? '—' : trimmed
}

/**
 * Группирует строки детализации отчёта для табов «Договор» / «Площадка» /
 * «Заказчик». Порядок групп и строк — по первому появлению в источнике.
 *
 * Строка внутри группы всегда — договор, кроме режима «Договор» (там сама
 * группа — договор, а строка — площадка): у заказчика и площадки нет
 * единого «третьего измерения» настолько же естественного, как договор.
 */
export function groupReportRows(rows: ErpReportRow[], mode: ErpReportGroupMode): ErpReportGroup[] {
  const groups: ErpReportGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const row of rows) {
    const groupRaw = mode === 'contract' ? row.contract : mode === 'site' ? row.site : row.customer
    const lineRaw = mode === 'contract' ? row.site : row.contract
    const key = displayKey(groupRaw)
    const label = displayKey(lineRaw)

    let groupIndex = indexByKey.get(key)
    if (groupIndex === undefined) {
      groupIndex = groups.length
      indexByKey.set(key, groupIndex)
      groups.push({
        key,
        title: key,
        subtitle: mode === 'contract' && row.customer.trim() !== '' ? row.customer.trim() : undefined,
        rows: [],
        totals: {productionRub: 0, shippedTons: 0},
      })
    }

    const group = groups[groupIndex]
    if (mode === 'contract') {
      // Пустого заказчика подписью не считаем — это отсутствие данных, а
      // не значение «—», расходящееся с другими строками группы.
      const customer = row.customer.trim() === '' ? undefined : row.customer.trim()
      if (group.subtitle !== customer) {
        group.subtitle = undefined
      }
    }

    const existing = group.rows.find(line => line.label === label)
    if (existing) {
      existing.productionRub += row.productionRub
      existing.shippedTons += row.shippedTons
    } else {
      group.rows.push({
        label,
        productionRub: row.productionRub,
        shippedTons: row.shippedTons,
      })
    }

    group.totals.productionRub += row.productionRub
    group.totals.shippedTons += row.shippedTons
  }

  return groups
}
