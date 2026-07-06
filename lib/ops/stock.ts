import { createClient } from '@/lib/supabase/client'

export type OpsStockRow = {
  id: string
  snapshot_date: string
  warehouse: string | null
  sku: string
  model: string | null
  color: string | null
  size: string | null
  qty: number
  source_file: string | null
  source_type: string | null
}

export async function fetchOpsStockRows() {
  const supabase = createClient()

  const rows: OpsStockRow[] = []
  const chunkSize = 1000

  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await supabase
      .from('ops_stock_snapshot')
      .select('*')
      .range(from, from + chunkSize - 1)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) break

    rows.push(...((data || []) as OpsStockRow[]))

    if (data.length < chunkSize) break
  }

  return rows
}

export function sumOpsStockQty(rows: OpsStockRow[]) {
  return rows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
}

export function groupStockByModel(rows: OpsStockRow[]) {
  const map = new Map<string, { model: string; qty: number }>()

  rows.forEach((row) => {
    const model = row.model || row.sku?.split('_')[0] || '-'
    const prev = map.get(model) || { model, qty: 0 }

    prev.qty += Number(row.qty || 0)

    map.set(model, prev)
  })

  return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
}

export function groupStockByWarehouse(rows: OpsStockRow[]) {
  const map = new Map<string, { warehouse: string; qty: number }>()

  rows.forEach((row) => {
    const warehouse = row.warehouse || '-'
    const prev = map.get(warehouse) || { warehouse, qty: 0 }

    prev.qty += Number(row.qty || 0)

    map.set(warehouse, prev)
  })

  return Array.from(map.values()).sort((a, b) => b.qty - a.qty)
}

export function getStockQtyBySku(rows: OpsStockRow[], sku: string) {
  const normalizedSku = sku.trim().toUpperCase().replace(/_FREE$/, '_F')

  return rows
    .filter(
      (row) =>
        row.sku.trim().toUpperCase().replace(/_FREE$/, '_F') === normalizedSku
    )
    .reduce((sum, row) => sum + Number(row.qty || 0), 0)
}