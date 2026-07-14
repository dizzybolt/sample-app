import { createClient } from '@/lib/supabase/client'
import type { OpsSalesRow } from '@/lib/ops/sales'

const PAGE_SIZE = 1000

export type OpsClaimRow = {
  id: number
  claim_date: string
  shop: string | null
  warehouse: string | null
  model_no: string | null
  single_no: string | null
  order_amount: number
  qty: number
  logistics_message: string | null
  claim_type: string | null
  reason: string | null
  order_status: string | null
  received_at: string | null
  completed_at: string | null
  sku: string
  source_file: string | null
  source_month: string | null
}

export type NetSalesSummaryRow = {
  key: string
  label: string

  orderQty: number
  orderAmount: number

  cancelQty: number
  cancelAmount: number

  returnQty: number
  returnAmount: number

  netQty: number
  netAmount: number
  avgNetAmount: number
}

export type ClaimSearchParams = {
  startDate: string
  endDate: string
  shop?: string
  keyword?: string
}

function normalizeText(value?: string | null) {
  return String(value || '').trim()
}

export function normalizeSalesKey(value?: string | null) {
  return normalizeText(value).toUpperCase()
}

export function getModelFromSku(sku?: string | null) {
  return normalizeSalesKey(String(sku || '').split('_')[0])
}

export function isCancelCompleted(status?: string | null) {
  return normalizeText(status).includes('취소완료')
}

export function isReturnCompleted(status?: string | null) {
  return normalizeText(status).includes('반품완료')
}

export function isDeductibleClaim(row: OpsClaimRow) {
  return (
    isCancelCompleted(row.order_status) ||
    isReturnCompleted(row.order_status)
  )
}

export async function fetchOpsClaimRowsByRange(
  params: ClaimSearchParams
) {
  const supabase = createClient()
  const allRows: OpsClaimRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('ops_claims_daily')
      .select('*')
      .gte('claim_date', params.startDate)
      .lte('claim_date', params.endDate)
      .order('claim_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (params.shop && params.shop !== 'ALL') {
      query = query.eq('shop', params.shop)
    }

    const { data, error } = await query

    if (error) throw error
    if (!data || data.length === 0) break

    allRows.push(...(data as OpsClaimRow[]))

    if (data.length < PAGE_SIZE) break
  }

  const keyword = normalizeSalesKey(params.keyword)

  const filteredRows = keyword
    ? allRows.filter((row) => {
        const sku = normalizeSalesKey(row.sku)
        const model = getModelFromSku(row.sku)

        return sku.includes(keyword) || model.includes(keyword)
      })
    : allRows

  return filteredRows.filter(isDeductibleClaim)
}

export function excludeGiftClaimRows(
  rows: OpsClaimRow[],
  giftModelNames: Set<string>
) {
  return rows.filter(
    (row) => !giftModelNames.has(getModelFromSku(row.sku))
  )
}

export function sumClaimQty(rows: OpsClaimRow[]) {
  return rows.reduce(
    (sum, row) => sum + Number(row.qty || 0),
    0
  )
}

export function sumClaimAmount(rows: OpsClaimRow[]) {
  return rows.reduce(
    (sum, row) => sum + Number(row.order_amount || 0),
    0
  )
}

export function getCancelRows(rows: OpsClaimRow[]) {
  return rows.filter((row) => isCancelCompleted(row.order_status))
}

export function getReturnRows(rows: OpsClaimRow[]) {
  return rows.filter((row) => isReturnCompleted(row.order_status))
}

export function buildNetSalesSummary(
  salesRows: OpsSalesRow[],
  claimRows: OpsClaimRow[],
  salesKey: (row: OpsSalesRow) => string,
  claimKey: (row: OpsClaimRow) => string,
  salesLabel?: (row: OpsSalesRow) => string,
  claimLabel?: (row: OpsClaimRow) => string
) {
  const map = new Map<string, NetSalesSummaryRow>()

  salesRows.forEach((row) => {
    const key = normalizeText(salesKey(row)) || '-'
    const label = normalizeText(salesLabel?.(row)) || key

    const previous = map.get(key) || {
      key,
      label,
      orderQty: 0,
      orderAmount: 0,
      cancelQty: 0,
      cancelAmount: 0,
      returnQty: 0,
      returnAmount: 0,
      netQty: 0,
      netAmount: 0,
      avgNetAmount: 0,
    }

    previous.orderQty += Number(row.qty || 0)
    previous.orderAmount += Number(row.amount || 0)

    map.set(key, previous)
  })

  claimRows.forEach((row) => {
    const key = normalizeText(claimKey(row)) || '-'
    const label = normalizeText(claimLabel?.(row)) || key

    const previous = map.get(key) || {
      key,
      label,
      orderQty: 0,
      orderAmount: 0,
      cancelQty: 0,
      cancelAmount: 0,
      returnQty: 0,
      returnAmount: 0,
      netQty: 0,
      netAmount: 0,
      avgNetAmount: 0,
    }

    const qty = Number(row.qty || 0)
    const amount = Number(row.order_amount || 0)

    if (isCancelCompleted(row.order_status)) {
      previous.cancelQty += qty
      previous.cancelAmount += amount
    }

    if (isReturnCompleted(row.order_status)) {
      previous.returnQty += qty
      previous.returnAmount += amount
    }

    map.set(key, previous)
  })

  return Array.from(map.values()).map((row) => {
    const netQty =
      row.orderQty - row.cancelQty - row.returnQty

    const netAmount =
      row.orderAmount - row.cancelAmount - row.returnAmount

    return {
      ...row,
      netQty,
      netAmount,
      avgNetAmount: netQty > 0 ? netAmount / netQty : 0,
    }
  })
}