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

export async function fetchOpsSalesRows(days = 30) {
  const supabase = createClient()

  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - days)

  const from = fromDate.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('ops_sales_daily_all')
    .select('*')
    .gte('order_date', from)

  if (error) throw error

  return (data || []) as OpsSalesRow[]
}

export async function fetchOpsSalesRowsByRange(params: SalesSearchParams) {
  const supabase = createClient()

  let query = supabase
    .from('ops_sales_daily_all')
    .select('*')
    .gte('order_date', params.startDate)
    .lte('order_date', params.endDate)

  if (params.shop && params.shop !== 'ALL') {
    query = query.eq('shop', params.shop)
  }

  const { data, error } = await query

  if (error) throw error

  const keyword = (params.keyword || '').trim().toUpperCase()

  const rows = ((data || []) as OpsSalesRow[]).filter((row) => {
    if (!keyword) return true

    const sku = row.sku?.toUpperCase() || ''
    const model = sku.split('_')[0] || ''

    return sku.includes(keyword) || model.includes(keyword)
  })

  return rows
}

export function getPreviousMonthRange(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)

  start.setMonth(start.getMonth() - 1)
  end.setMonth(end.getMonth() - 1)

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

export function calcGrowthRate(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100
  }

  return ((current - previous) / previous) * 100
}

export function sumSalesQty(rows: OpsSalesRow[]) {
  return rows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
}

export function sumSalesAmount(rows: OpsSalesRow[]) {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
}

export function filterSalesFromDays(rows: OpsSalesRow[], days: number) {
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - days)

  const from = fromDate.toISOString().slice(0, 10)

  return rows.filter((row) => row.order_date >= from)
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

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
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