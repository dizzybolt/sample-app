import type { OpsSalesRow } from '@/lib/ops/sales'

export type GiftModel = {
  id: string
  model_name: string
  gift_name: string | null
  is_active: boolean
  note: string | null
  created_at: string | null
  updated_at: string | null
}

export function normalizeModelName(value?: string | null) {
  return String(value || '').trim().toUpperCase()
}

export function getModelFromSalesSku(sku?: string | null) {
  return normalizeModelName(String(sku || '').split('_')[0])
}

export function createGiftModelSet(giftModels: GiftModel[]) {
  return new Set(
    giftModels
      .filter((item) => item.is_active)
      .map((item) => normalizeModelName(item.model_name))
      .filter(Boolean)
  )
}

export function isGiftSalesRow(
  row: OpsSalesRow,
  giftModelSet: Set<string>
) {
  return giftModelSet.has(getModelFromSalesSku(row.sku))
}

export function excludeGiftSalesRows(
  rows: OpsSalesRow[],
  giftModels: GiftModel[]
) {
  const giftModelSet = createGiftModelSet(giftModels)

  return rows.filter(
    (row) => !isGiftSalesRow(row, giftModelSet)
  )
}

export function filterGiftSalesRows(
  rows: OpsSalesRow[],
  giftModels: GiftModel[]
) {
  const giftModelSet = createGiftModelSet(giftModels)

  return rows.filter(
    (row) => isGiftSalesRow(row, giftModelSet)
  )
}

export type GiftShipmentSummary = {
  date: string
  model: string
  shop: string
  warehouse: string
  qty: number
}

export function groupGiftShipments(
  rows: OpsSalesRow[],
  giftModels: GiftModel[]
) {
  const map = new Map<string, GiftShipmentSummary>()
  const giftRows = filterGiftSalesRows(rows, giftModels)

  giftRows.forEach((row) => {
    const date = row.order_date
    const model = getModelFromSalesSku(row.sku)
    const shop = String(row.shop || '-').trim() || '-'
    const warehouse = String(row.warehouse || '-').trim() || '-'

    const key = [date, model, shop, warehouse].join('__')

    const previous = map.get(key) || {
      date,
      model,
      shop,
      warehouse,
      qty: 0,
    }

    previous.qty += Number(row.qty || 0)
    map.set(key, previous)
  })

  return Array.from(map.values()).sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date)
    if (dateCompare !== 0) return dateCompare

    const modelCompare = a.model.localeCompare(b.model, 'ko')
    if (modelCompare !== 0) return modelCompare

    const shopCompare = a.shop.localeCompare(b.shop, 'ko')
    if (shopCompare !== 0) return shopCompare

    return a.warehouse.localeCompare(b.warehouse, 'ko')
  })
}