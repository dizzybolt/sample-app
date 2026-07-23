export const REORDER_DEPLETION_THRESHOLD = 70

export type ReorderInboundRow = {
  inbound_date: string
  sku: string
  korea_code: string
  color_code: string
  color_name: string | null
  size: string
  inbound_qty: number
}

export type ReorderSalesRow = {
  order_date: string
  sku: string
  qty: number
}

export type ReorderClaimRow = {
  claim_date: string
  sku: string
  qty: number
}

export type ReorderStockRow = {
  snapshot_date: string
  sku: string
  qty: number
}

export type ReorderDayBasis = 'active' | 'calendar'
export type ReorderInboundBasis = 'within-period' | 'previous' | 'next'

export type ReorderOptions = {
  startDate: string
  endDate: string
  targetDays: number
  applicationRate: number
  depletionThreshold?: number
  dayBasis: ReorderDayBasis
  excludedDates?: string[]
}

export type ReorderSkuSummary = {
  sku: string
  model: string
  colorCode: string
  colorName: string
  size: string
  firstInboundDate: string
  lastInboundDate: string
  lastOutboundDate: string
  inboundQty: number
  salesQty: number
  claimQty: number
  netSalesQty: number
  currentStockQty: number
  depletionRate: number
  dailyAverageQty: number
  expectedSalesQty: number
  recommendedQty: number
}

export type ReorderModelSummary = {
  model: string
  inboundBasis: ReorderInboundBasis
  firstInboundDate: string
  lastInboundDate: string
  lastOutboundDate: string
  analysisDays: number
  inboundQty: number
  salesQty: number
  claimQty: number
  netSalesQty: number
  currentStockQty: number
  depletionRate: number
  dailyAverageQty: number
  expectedSalesQty: number
  recommendedQty: number
  skuCount: number
  skuRows: ReorderSkuSummary[]
}

export function normalizeReorderSku(value?: string | null) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/_FREE$/, '_F')
}

export function getModelFromReorderSku(value?: string | null) {
  return normalizeReorderSku(value).split('_')[0] || '-'
}

function toDateOnly(value?: string | null) {
  return String(value || '').slice(0, 10)
}

function getRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return (numerator / denominator) * 100
}

function getEarlierDate(current: string, candidate: string) {
  if (!current) return candidate
  if (!candidate) return current
  return candidate < current ? candidate : current
}

function getLaterDate(current: string, candidate: string) {
  if (!current) return candidate
  if (!candidate) return current
  return candidate > current ? candidate : current
}

function getCalendarDays(
  startDate: string,
  endDate: string,
  excludedDates: Set<string>
) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0

  const inclusiveDays =
    Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
  const excludedDayCount = Array.from(excludedDates).filter(
    (date) => date >= startDate && date <= endDate
  ).length

  return Math.max(inclusiveDays - excludedDayCount, 0)
}

function selectInboundRows(
  rows: ReorderInboundRow[],
  startDate: string,
  endDate: string
) {
  const withinPeriod = rows.filter((row) => {
    const date = toDateOnly(row.inbound_date)
    return date >= startDate && date <= endDate
  })

  if (withinPeriod.length > 0) {
    return {
      basis: 'within-period' as const,
      rows: withinPeriod,
    }
  }

  const previousDate = rows.reduce((latest, row) => {
    const date = toDateOnly(row.inbound_date)
    if (!date || date >= startDate) return latest
    return date > latest ? date : latest
  }, '')

  const nextDate = rows.reduce((earliest, row) => {
    const date = toDateOnly(row.inbound_date)
    if (!date || date <= endDate) return earliest
    if (!earliest) return date
    return date < earliest ? date : earliest
  }, '')

  if (previousDate && nextDate) {
    const previousDistance =
      new Date(`${startDate}T00:00:00`).getTime() -
      new Date(`${previousDate}T00:00:00`).getTime()
    const nextDistance =
      new Date(`${nextDate}T00:00:00`).getTime() -
      new Date(`${endDate}T00:00:00`).getTime()

    if (previousDistance <= nextDistance) {
      return {
        basis: 'previous' as const,
        rows: rows.filter(
          (row) => toDateOnly(row.inbound_date) === previousDate
        ),
      }
    }
  }

  if (previousDate && !nextDate) {
    return {
      basis: 'previous' as const,
      rows: rows.filter(
        (row) => toDateOnly(row.inbound_date) === previousDate
      ),
    }
  }

  return {
    basis: 'next' as const,
    rows: rows.filter((row) => toDateOnly(row.inbound_date) === nextDate),
  }
}

export function buildReorderRecommendations(
  inboundRows: ReorderInboundRow[],
  salesRows: ReorderSalesRow[],
  claimRows: ReorderClaimRow[],
  stockRows: ReorderStockRow[],
  options: ReorderOptions
) {
  const excludedDates = new Set(
    (options.excludedDates || []).map(toDateOnly).filter(Boolean)
  )
  const applicationRate = Math.max(options.applicationRate, 0) / 100
  const targetDays = Math.max(Math.round(options.targetDays), 0)
  const depletionThreshold =
    options.depletionThreshold ?? REORDER_DEPLETION_THRESHOLD

  const inboundByModel = new Map<string, ReorderInboundRow[]>()
  inboundRows.forEach((row) => {
    const sku = normalizeReorderSku(row.sku)
    const model =
      String(row.korea_code || '').trim().toUpperCase() ||
      getModelFromReorderSku(sku)

    if (!sku || !model || model === '-') return

    const values = inboundByModel.get(model) || []
    values.push({ ...row, sku })
    inboundByModel.set(model, values)
  })

  const salesBySku = new Map<string, ReorderSalesRow[]>()
  salesRows.forEach((row) => {
    const date = toDateOnly(row.order_date)
    const sku = normalizeReorderSku(row.sku)

    if (
      !sku ||
      !date ||
      date < options.startDate ||
      date > options.endDate ||
      excludedDates.has(date)
    ) {
      return
    }

    const values = salesBySku.get(sku) || []
    values.push({ ...row, order_date: date, sku })
    salesBySku.set(sku, values)
  })

  const claimQtyBySku = new Map<string, number>()
  claimRows.forEach((row) => {
    const date = toDateOnly(row.claim_date)
    const sku = normalizeReorderSku(row.sku)

    if (
      !sku ||
      !date ||
      date < options.startDate ||
      date > options.endDate ||
      excludedDates.has(date)
    ) {
      return
    }

    claimQtyBySku.set(
      sku,
      (claimQtyBySku.get(sku) || 0) + Number(row.qty || 0)
    )
  })

  const stockBySku = new Map<string, number>()
  stockRows.forEach((row) => {
    const sku = normalizeReorderSku(row.sku)
    if (!sku) return
    stockBySku.set(
      sku,
      (stockBySku.get(sku) || 0) + Number(row.qty || 0)
    )
  })

  const allModels: ReorderModelSummary[] = []

  inboundByModel.forEach((modelInboundRows, model) => {
    const selectedInbound = selectInboundRows(
      modelInboundRows,
      options.startDate,
      options.endDate
    )
    if (selectedInbound.rows.length === 0) return

    const inboundBySku = new Map<string, ReorderInboundRow[]>()
    selectedInbound.rows.forEach((row) => {
      const values = inboundBySku.get(row.sku) || []
      values.push(row)
      inboundBySku.set(row.sku, values)
    })

    const modelSalesByDate = new Map<string, number>()
    inboundBySku.forEach((_, sku) => {
      ;(salesBySku.get(sku) || []).forEach((row) => {
        modelSalesByDate.set(
          row.order_date,
          (modelSalesByDate.get(row.order_date) || 0) + Number(row.qty || 0)
        )
      })
    })

    const activeDays = Array.from(modelSalesByDate.values()).filter(
      (qty) => qty !== 0
    ).length
    const analysisDays =
      options.dayBasis === 'active'
        ? activeDays
        : getCalendarDays(options.startDate, options.endDate, excludedDates)

    const skuRows: ReorderSkuSummary[] = Array.from(
      inboundBySku.entries()
    ).map(([sku, rows]) => {
      const firstRow = rows[0]
      const skuSales = salesBySku.get(sku) || []
      const inboundQty = rows.reduce(
        (sum, row) => sum + Number(row.inbound_qty || 0),
        0
      )
      const salesQty = skuSales.reduce(
        (sum, row) => sum + Number(row.qty || 0),
        0
      )
      const claimQty = claimQtyBySku.get(sku) || 0
      const netSalesQty = salesQty - claimQty
      const currentStockQty = stockBySku.get(sku) || 0
      const dailyAverageQty =
        analysisDays > 0 ? netSalesQty / analysisDays : 0
      const expectedSalesQty = Math.max(
        Math.round(dailyAverageQty * targetDays * applicationRate),
        0
      )

      return {
        sku,
        model,
        colorCode: String(firstRow.color_code || '').trim(),
        colorName: String(firstRow.color_name || '').trim(),
        size: String(firstRow.size || '').trim(),
        firstInboundDate: rows.reduce(
          (date, row) => getEarlierDate(date, toDateOnly(row.inbound_date)),
          ''
        ),
        lastInboundDate: rows.reduce(
          (date, row) => getLaterDate(date, toDateOnly(row.inbound_date)),
          ''
        ),
        lastOutboundDate: skuSales.reduce(
          (date, row) => getLaterDate(date, row.order_date),
          ''
        ),
        inboundQty,
        salesQty,
        claimQty,
        netSalesQty,
        currentStockQty,
        depletionRate: getRate(netSalesQty, inboundQty),
        dailyAverageQty,
        expectedSalesQty,
        recommendedQty: Math.max(expectedSalesQty - currentStockQty, 0),
      }
    })

    const inboundQty = skuRows.reduce((sum, row) => sum + row.inboundQty, 0)
    const salesQty = skuRows.reduce(
      (sum, row) => sum + row.salesQty,
      0
    )
    const claimQty = skuRows.reduce(
      (sum, row) => sum + row.claimQty,
      0
    )
    const netSalesQty = skuRows.reduce(
      (sum, row) => sum + row.netSalesQty,
      0
    )
    const currentStockQty = skuRows.reduce(
      (sum, row) => sum + row.currentStockQty,
      0
    )

    allModels.push({
      model,
      inboundBasis: selectedInbound.basis,
      firstInboundDate: skuRows.reduce(
        (date, row) => getEarlierDate(date, row.firstInboundDate),
        ''
      ),
      lastInboundDate: skuRows.reduce(
        (date, row) => getLaterDate(date, row.lastInboundDate),
        ''
      ),
      lastOutboundDate: skuRows.reduce(
        (date, row) => getLaterDate(date, row.lastOutboundDate),
        ''
      ),
      analysisDays,
      inboundQty,
      salesQty,
      claimQty,
      netSalesQty,
      currentStockQty,
      depletionRate: getRate(netSalesQty, inboundQty),
      dailyAverageQty: analysisDays > 0 ? netSalesQty / analysisDays : 0,
      expectedSalesQty: skuRows.reduce(
        (sum, row) => sum + row.expectedSalesQty,
        0
      ),
      recommendedQty: skuRows.reduce(
        (sum, row) => sum + row.recommendedQty,
        0
      ),
      skuCount: skuRows.length,
      skuRows: skuRows.sort((a, b) =>
        a.sku.localeCompare(b.sku, 'ko-KR', { numeric: true })
      ),
    })
  })

  const recommendations = allModels
    .filter(
      (row) =>
        row.inboundQty > 0 &&
        row.netSalesQty > 0 &&
        row.recommendedQty > 0 &&
        row.depletionRate >= depletionThreshold
    )
    .sort(
      (a, b) =>
        b.recommendedQty - a.recommendedQty ||
        b.depletionRate - a.depletionRate ||
        a.model.localeCompare(b.model, 'ko-KR', { numeric: true })
    )

  return {
    allModels,
    recommendations,
  }
}
