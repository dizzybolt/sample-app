import type { SampleEntry, SampleGroup, OrderDateGroup } from '@/lib/types'
import { formatKoreaDate, toKoreaDate } from '@/lib/date-utils'

export function normalizeDateKey(dateString?: string | null) {
  if (!dateString) return 'NO_DATE'

  return toKoreaDate(dateString) || 'NO_DATE'
}

export function formatDateLabel(dateString?: string | null) {
  if (!dateString || dateString === 'NO_DATE') return '발주일 없음'

  return formatKoreaDate(dateString) || dateString || ''
}

export function groupSamplesByChinaCode(items: SampleEntry[]): SampleGroup[] {
  const map = new Map<string, SampleEntry[]>()

  for (const item of items) {
    const key = item.china_code || 'NO_CHINA_CODE'
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(item)
  }

  return Array.from(map.entries()).map(([china_code, rows]) => {
    const sorted = [...rows].sort((a, b) => {
      const aTime = new Date(a.created_at || a.checked_at || 0).getTime()
      const bTime = new Date(b.created_at || b.checked_at || 0).getTime()
      return aTime - bTime
    })

    return {
      china_code,
      representative: sorted[0],
      items: sorted,
    }
  })
}

export function groupOrdersByDate(items: SampleEntry[]): OrderDateGroup[] {
  const map = new Map<string, SampleEntry[]>()

  for (const item of items) {
    const key = normalizeDateKey(item.ordered_at)
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(item)
  }

  return Array.from(map.entries())
    .map(([ordered_date, rows]) => {
      const china_codes = Array.from(
        new Set(rows.map((r) => r.china_code).filter(Boolean))
      )

      return {
        ordered_date,
        items: rows,
        china_codes,
      }
    })
    .sort((a, b) => {
      if (a.ordered_date === 'NO_DATE') return 1
      if (b.ordered_date === 'NO_DATE') return -1
      return b.ordered_date.localeCompare(a.ordered_date)
    })
}