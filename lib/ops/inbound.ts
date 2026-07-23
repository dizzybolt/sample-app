export type OpsInboundRow = {
  id: number
  inbound_year: number
  inbound_month: number
  china_code: string | null
  korea_code: string
  color_code: string
  color_name: string | null
  size: string
  inbound_qty: number
  inbound_date: string
  warehouse: string | null
  note: string | null
  sku: string
  source_file: string
  source_month: string
  created_at: string
  updated_at: string
}

export type InboundFilters = {
  startDate: string
  endDate: string
  keyword: string
  colorCode: string
  size: string
  warehouse: string
}

export type InboundFilterOptions = {
  colorCodes: string[]
  sizes: string[]
  warehouses: string[]
}

export function toLocalDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getDefaultInboundRange(baseDate = new Date()) {
  const end = new Date(baseDate)
  const start = new Date(baseDate)

  start.setDate(end.getDate() - 29)

  return {
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(end),
  }
}

export function getCurrentMonthRange(baseDate = new Date()) {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()

  return {
    startDate: toLocalDateString(new Date(year, month, 1)),
    endDate: toLocalDateString(new Date(year, month + 1, 0)),
  }
}

export function normalizeInboundKeyword(value: string) {
  return value.trim().replace(/[,%()]/g, '').toUpperCase()
}

export function sortInboundOptionValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    })
  )
}
