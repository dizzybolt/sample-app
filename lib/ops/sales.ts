import { createClient } from '@/lib/supabase/client'

export type OpsSalesRow = {
  id: string
  order_date: string
  channel_type: string | null
  shop: string | null
  warehouse: string | null
  sku: string
  qty: number
  amount: number
  source: string | null
}

export type SalesSearchParams = {
  startDate: string
  endDate: string
  keyword?: string
  shop?: string
}

export type SalesPeriodType = 'week' | 'month' | 'quarter' | 'year'

const PAGE_SIZE = 1000

export function toDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getPeriodRange(type: SalesPeriodType, baseDate = new Date()) {
  const date = new Date(baseDate)
  const year = date.getFullYear()
  const month = date.getMonth()

  if (type === 'week') {
    const day = date.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day

    const start = new Date(date)
    start.setDate(date.getDate() + diffToMonday)

    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    return {
      label: '이번주',
      startDate: toDateString(start),
      endDate: toDateString(end),
    }
  }

  if (type === 'month') {
    return {
      label: '이번달',
      startDate: toDateString(new Date(year, month, 1)),
      endDate: toDateString(new Date(year, month + 1, 0)),
    }
  }

  if (type === 'quarter') {
    const quarterStartMonth = Math.floor(month / 3) * 3

    return {
      label: '이번분기',
      startDate: toDateString(new Date(year, quarterStartMonth, 1)),
      endDate: toDateString(new Date(year, quarterStartMonth + 3, 0)),
    }
  }

  return {
    label: '올해',
    startDate: toDateString(new Date(year, 0, 1)),
    endDate: toDateString(new Date(year, 11, 31)),
  }
}

export function getPreviousMonthRange(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)

  start.setMonth(start.getMonth() - 1)
  end.setMonth(end.getMonth() - 1)

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
  }
}

export function getPreviousPeriodRange(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const diffDays =
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  const prevEnd = new Date(start)
  prevEnd.setDate(start.getDate() - 1)

  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevEnd.getDate() - diffDays + 1)

  return {
    startDate: toDateString(prevStart),
    endDate: toDateString(prevEnd),
  }
}

export async function fetchOpsSalesRowsByRange(params: SalesSearchParams) {
  const supabase = createClient()

  const allRows: OpsSalesRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('ops_sales_daily_all')
      .select('*')
      .gte('order_date', params.startDate)
      .lte('order_date', params.endDate)
      .range(from, from + PAGE_SIZE - 1)

    if (params.shop && params.shop !== 'ALL') {
      query = query.eq('shop', params.shop)
    }

    const { data, error } = await query

    if (error) throw error

    if (!data || data.length === 0) break

    allRows.push(...((data || []) as OpsSalesRow[]))

    if (data.length < PAGE_SIZE) break
  }

  const keyword = (params.keyword || '').trim().toUpperCase()

  if (!keyword) return allRows

  return allRows.filter((row) => {
    const sku = row.sku?.toUpperCase() || ''
    const model = sku.split('_')[0] || ''

    return sku.includes(keyword) || model.includes(keyword)
  })
}

export async function fetchOpsSalesRows(days = 30) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)

  return fetchOpsSalesRowsByRange({
    startDate: toDateString(start),
    endDate: toDateString(end),
  })
}

export function sumSalesQty(rows: OpsSalesRow[]) {
  return rows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
}

export function sumSalesAmount(rows: OpsSalesRow[]) {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
}

export function calcAverageOrderAmount(rows: OpsSalesRow[]) {
  const qty = sumSalesQty(rows)
  const amount = sumSalesAmount(rows)

  if (qty === 0) return 0

  return amount / qty
}

export function calcGrowthRate(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100
  }

  return ((current - previous) / previous) * 100
}

export function groupSalesByDate(rows: OpsSalesRow[]) {
  const map = new Map<string, { date: string; qty: number; amount: number }>()

  rows.forEach((row) => {
    const date = row.order_date
    const prev = map.get(date) || { date, qty: 0, amount: 0 }

    prev.qty += Number(row.qty || 0)
    prev.amount += Number(row.amount || 0)

    map.set(date, prev)
  })

  return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
}

export function groupSalesByModel(rows: OpsSalesRow[]) {
  const map = new Map<string, { model: string; qty: number; amount: number }>()

  rows.forEach((row) => {
    const model = row.sku?.split('_')[0] || '-'
    const prev = map.get(model) || { model, qty: 0, amount: 0 }

    prev.qty += Number(row.qty || 0)
    prev.amount += Number(row.amount || 0)

    map.set(model, prev)
  })

  return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
}

export function groupSalesBySku(rows: OpsSalesRow[]) {
  const map = new Map<string, { sku: string; qty: number; amount: number }>()

  rows.forEach((row) => {
    const sku = row.sku || '-'
    const prev = map.get(sku) || { sku, qty: 0, amount: 0 }

    prev.qty += Number(row.qty || 0)
    prev.amount += Number(row.amount || 0)

    map.set(sku, prev)
  })

  return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
}

export function groupSalesByShop(rows: OpsSalesRow[]) {
  const map = new Map<string, { shop: string; qty: number; amount: number }>()

  rows.forEach((row) => {
    const shop = row.shop || '-'
    const prev = map.get(shop) || { shop, qty: 0, amount: 0 }

    prev.qty += Number(row.qty || 0)
    prev.amount += Number(row.amount || 0)

    map.set(shop, prev)
  })

  return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
}

export function getUniqueShops(rows: OpsSalesRow[]) {
  return Array.from(new Set(rows.map((row) => row.shop || '-'))).sort()
}