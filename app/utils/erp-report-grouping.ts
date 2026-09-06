import type {ErpReportRow} from '~/utils/erp-api'

export type ErpReportGroupMode = 'contract' | 'site' | 'customer'

/**
 * Метрики строки группы.
 *
 * Первые три — за месяц («Отчёт месяца»), последние две — за весь период
 * работы («Полный отчёт»). Экраны берут свою половину: группировка у них
 * общая, а вот метрики по ТЗ разные, и складывать месяц с периодом нельзя.
 */
export interface ErpReportGroupTotals {
  productionRub: number
  shippedTons: number
  shippedSquareMeters: number
  productionTotalRub: number
  shippedTotalTons: number
}

export interface ErpReportGroupLine extends ErpReportGroupTotals {
  label: string
}

export interface ErpReportGroup {
  key: string
  title: string
  subtitle?: string
  rows: ErpReportGroupLine[]
  totals: ErpReportGroupTotals
}

const METRIC_KEYS = [
  'productionRub',
  'shippedTons',
  'shippedSquareMeters',
  'productionTotalRub',
  'shippedTotalTons',
] as const

function emptyTotals(): ErpReportGroupTotals {
  return {
    productionRub: 0,
    shippedTons: 0,
    shippedSquareMeters: 0,
    productionTotalRub: 0,
    shippedTotalTons: 0,
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
        totals: emptyTotals(),
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

    let line = group.rows.find(existing => existing.label === label)
    if (!line) {
      line = {label, ...emptyTotals()}
      group.rows.push(line)
    }

    for (const metric of METRIC_KEYS) {
      line[metric] += row[metric]
      group.totals[metric] += row[metric]
    }
  }

  return groups
}
