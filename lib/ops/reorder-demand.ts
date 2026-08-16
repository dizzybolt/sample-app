import {
  getModelFromReorderSku,
  normalizeReorderSku,
} from '@/lib/ops/reorder'

export const DEMAND_ANALYSIS_MONTHS = 24
export const DEMAND_LOW_VOLUME_TOTAL_QTY = 100
export const DEMAND_SEASON_START_RATIO = 0.1
export const DEMAND_SEASON_END_RATIO = 0.15
export const DEMAND_RECENT_SEASON_RATIO = 0.65
export const DEMAND_MAX_SEASON_MONTHS = 8
export const DEMAND_SAFETY_RATE = 0.1
export const DEMAND_ROUND_UNIT = 10
export const DEMAND_CONDITIONAL_MAX_QTY = 200
export const DEMAND_RAMP_UP_LOOKBACK_MONTHS = 2

export type DemandSalesRow = {
  order_date: string
  sku: string
  qty: number
}

export type DemandClaimRow = {
  claim_date: string
  sku: string
  qty: number
}

export type DemandStockRow = {
  snapshot_date: string
  sku: string
  qty: number
}

export type DemandCalculationMethod =
  | 'season'
  | 'low_volume'
  | 'normalized_8m'
  | 'insufficient_data'

export type DemandDecision =
  | '재발주'
  | '소량/조건부'
  | '미발주'
  | '자료보완'

export type DemandUrgency = '긴급' | '높음' | '보통' | '낮음' | '-'

export type DemandMonthlyRow = {
  month: string
  salesQty: number
  claimQty: number
  netSalesQty: number
  isSelected: boolean
}

export type DemandPeriodCandidate = {
  startMonth: string
  endMonth: string
  totalNetSalesQty: number
  peakMonth: string
  peakQty: number
  monthCount: number
}

export type DemandSkuSummary = {
  sku: string
  model: string
  colorCode: string
  size: string
  periodSalesQty: number
  periodClaimQty: number
  periodNetSalesQty: number
  salesShare: number
  currentStockQty: number
  targetDemandQty: number
  recommendedQty: number
}

export type DemandModelSummary = {
  model: string
  calculationMethod: DemandCalculationMethod
  demandStartMonth: string
  demandEndMonth: string
  demandSalesQty: number
  currentStockQty: number
  stockCoverageRate: number
  minimumReorderQty: number
  recommendedReorderQty: number
  decision: DemandDecision
  urgency: DemandUrgency
  monthlyRows: DemandMonthlyRow[]
  candidates: DemandPeriodCandidate[]
  skuRows: DemandSkuSummary[]
}

export type DemandManualPeriod = {
  startMonth: string
  endMonth: string
}

export type DemandOptions = {
  startDate: string
  endDate: string
  lowVolumeTotalQty?: number
  seasonStartRatio?: number
  seasonEndRatio?: number
  recentSeasonRatio?: number
  maxSeasonMonths?: number
  safetyRate?: number
  roundUnit?: number
  conditionalMaxQty?: number
  rampUpLookbackMonths?: number
  manualPeriods?: Record<string, DemandManualPeriod>
}

function toDateOnly(value?: string | null) {
  return String(value || '').slice(0, 10)
}

function toMonthKey(value?: string | null) {
  return toDateOnly(value).slice(0, 7)
}

function parseMonthKey(month: string) {
  const [year, monthValue] = month.split('-').map(Number)
  return new Date(year, monthValue - 1, 1)
}

function addMonths(month: string, amount: number) {
  const date = parseMonthKey(month)
  date.setMonth(date.getMonth() + amount)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function listMonths(startDate: string, endDate: string) {
  const startMonth = toMonthKey(startDate)
  const endMonth = toMonthKey(endDate)
  if (!startMonth || !endMonth || startMonth > endMonth) return []

  const months: string[] = []
  let current = startMonth

  while (current <= endMonth) {
    months.push(current)
    current = addMonths(current, 1)
  }

  return months
}

function ceilToUnit(value: number, unit: number) {
  if (value <= 0) return 0
  const safeUnit = Math.max(Math.round(unit), 1)
  return Math.ceil(value / safeUnit) * safeUnit
}

function getColorAndSizeFromSku(sku: string) {
  const parts = normalizeReorderSku(sku).split('_')
  return {
    colorCode: parts[1] || '',
    size: parts.slice(2).join('_') || '',
  }
}

function getDecision(
  method: DemandCalculationMethod,
  recommendedQty: number,
  conditionalMaxQty: number
): DemandDecision {
  if (method === 'insufficient_data') return '자료보완'
  if (method === 'low_volume') return recommendedQty > 0 ? '소량/조건부' : '미발주'
  if (recommendedQty <= 0) return '미발주'
  if (recommendedQty <= conditionalMaxQty) return '소량/조건부'
  return '재발주'
}

function getUrgency(
  method: DemandCalculationMethod,
  stockCoverageRate: number,
  recommendedQty: number
): DemandUrgency {
  if (method === 'insufficient_data') return '-'
  if (method === 'low_volume') return '낮음'
  if (recommendedQty <= 0) return '낮음'
  if (stockCoverageRate <= 20) return '긴급'
  if (stockCoverageRate <= 60) return '높음'
  if (stockCoverageRate <= 80) return '보통'
  return '낮음'
}

function detectSeasonCandidates(
  monthlyRows: Omit<DemandMonthlyRow, 'isSelected'>[],
  seasonStartRatio: number,
  seasonEndRatio: number,
  maxSeasonMonths: number
): DemandPeriodCandidate[] {
  if (monthlyRows.length === 0) return []

  const localPeakIndexes = monthlyRows
    .map((row, index) => {
      const qty = row.netSalesQty
      if (qty <= 0) return -1
      const previousQty = index > 0 ? monthlyRows[index - 1].netSalesQty : -1
      const nextQty = index < monthlyRows.length - 1 ? monthlyRows[index + 1].netSalesQty : -1
      return qty >= previousQty && qty >= nextQty ? index : -1
    })
    .filter((index) => index >= 0)

  const candidates: DemandPeriodCandidate[] = []

  localPeakIndexes.forEach((peakIndex) => {
    const peakQty = monthlyRows[peakIndex].netSalesQty
    const leftThreshold = Math.max(peakQty * seasonStartRatio, 1)
    const rightThreshold = Math.max(peakQty * seasonEndRatio, 1)

    let firstSignificantIndex = peakIndex
    let lastSignificantIndex = peakIndex
    let lowRun = 0

    for (let index = peakIndex - 1; index >= 0; index -= 1) {
      const qty = monthlyRows[index].netSalesQty
      if (qty > peakQty * 1.25) break

      if (qty >= leftThreshold) {
        firstSignificantIndex = index
        lowRun = 0
      } else {
        lowRun += 1
        if (lowRun >= 2) break
      }
    }

    lowRun = 0
    for (let index = peakIndex + 1; index < monthlyRows.length; index += 1) {
      const qty = monthlyRows[index].netSalesQty
      if (qty > peakQty * 1.25) break

      if (qty >= rightThreshold) {
        lastSignificantIndex = index
        lowRun = 0
      } else {
        lowRun += 1
        if (lowRun >= 2) break
      }
    }

    let startIndex = Math.max(firstSignificantIndex - 1, 0)
    const endIndex = lastSignificantIndex

    if (endIndex - startIndex + 1 > maxSeasonMonths) {
      startIndex = Math.max(endIndex - maxSeasonMonths + 1, 0)
    }

    if (peakIndex < startIndex || peakIndex > endIndex) return

    const selectedRows = monthlyRows.slice(startIndex, endIndex + 1)
    const totalNetSalesQty = selectedRows.reduce(
      (sum, row) => sum + Math.max(row.netSalesQty, 0),
      0
    )

    if (totalNetSalesQty <= 0) return

    candidates.push({
      startMonth: monthlyRows[startIndex].month,
      endMonth: monthlyRows[endIndex].month,
      totalNetSalesQty,
      peakMonth: monthlyRows[peakIndex].month,
      peakQty,
      monthCount: selectedRows.length,
    })
  })

  const unique = new Map<string, DemandPeriodCandidate>()
  candidates.forEach((candidate) => {
    const key = `${candidate.startMonth}_${candidate.endMonth}`
    const existing = unique.get(key)
    if (!existing || candidate.totalNetSalesQty > existing.totalNetSalesQty) {
      unique.set(key, candidate)
    }
  })

  return Array.from(unique.values()).sort(
    (a, b) =>
      b.endMonth.localeCompare(a.endMonth) ||
      b.totalNetSalesQty - a.totalNetSalesQty ||
      b.peakQty - a.peakQty
  )
}

function selectSeasonCandidate(
  candidates: DemandPeriodCandidate[],
  recentSeasonRatio: number
) {
  if (candidates.length === 0) return null

  const maxTotal = Math.max(...candidates.map((candidate) => candidate.totalNetSalesQty))
  const threshold = maxTotal * recentSeasonRatio

  const recentQualified = candidates.find(
    (candidate) => candidate.totalNetSalesQty >= threshold
  )

  if (recentQualified) return recentQualified

  return [...candidates].sort(
    (a, b) =>
      b.totalNetSalesQty - a.totalNetSalesQty ||
      b.endMonth.localeCompare(a.endMonth)
  )[0]
}

function expandCandidateWithRampUp(
  candidate: DemandPeriodCandidate,
  monthlyRows: Omit<DemandMonthlyRow, 'isSelected'>[],
  rampUpLookbackMonths: number,
  maxSeasonMonths: number
): DemandPeriodCandidate {
  if (rampUpLookbackMonths <= 0) return candidate

  const startIndex = monthlyRows.findIndex(
    (row) => row.month === candidate.startMonth
  )
  const endIndex = monthlyRows.findIndex(
    (row) => row.month === candidate.endMonth
  )

  if (startIndex <= 0 || endIndex < startIndex) return candidate

  const currentStartQty = monthlyRows[startIndex].netSalesQty
  if (currentStartQty <= 0) return candidate

  let expandedStartIndex = startIndex
  let comparisonQty = currentStartQty
  let included = 0

  for (
    let index = startIndex - 1;
    index >= 0 && included < rampUpLookbackMonths;
    index -= 1
  ) {
    const qty = monthlyRows[index].netSalesQty

    // 램프업은 실제 순판매가 존재하고, 본판매 시작점으로 갈수록 판매가 같거나 증가할 때만 인정한다.
    if (qty <= 0 || qty > comparisonQty) break

    if (endIndex - index + 1 > maxSeasonMonths) break

    expandedStartIndex = index
    comparisonQty = qty
    included += 1
  }

  if (expandedStartIndex === startIndex) return candidate

  const selectedRows = monthlyRows.slice(expandedStartIndex, endIndex + 1)
  const totalNetSalesQty = selectedRows.reduce(
    (sum, row) => sum + Math.max(row.netSalesQty, 0),
    0
  )

  return {
    ...candidate,
    startMonth: monthlyRows[expandedStartIndex].month,
    totalNetSalesQty,
    monthCount: selectedRows.length,
  }
}

function pickFallbackPeriod(monthlyRows: Omit<DemandMonthlyRow, 'isSelected'>[]) {
  const positiveRows = monthlyRows.filter((row) => row.netSalesQty > 0)
  if (positiveRows.length < 4) {
    return {
      method: 'insufficient_data' as const,
      startMonth: '',
      endMonth: '',
      demandSalesQty: 0,
    }
  }

  const recentRows = monthlyRows.slice(-18)
  const recentTotal = recentRows.reduce(
    (sum, row) => sum + Math.max(row.netSalesQty, 0),
    0
  )

  if (recentTotal <= 0) {
    return {
      method: 'insufficient_data' as const,
      startMonth: '',
      endMonth: '',
      demandSalesQty: 0,
    }
  }

  const normalizedQty = Math.round((recentTotal * 8) / Math.max(recentRows.length, 1))

  return {
    method: 'normalized_8m' as const,
    startMonth: recentRows[0]?.month || '',
    endMonth: recentRows[recentRows.length - 1]?.month || '',
    demandSalesQty: normalizedQty,
  }
}

export function buildDemandRecommendations(
  salesRows: DemandSalesRow[],
  claimRows: DemandClaimRow[],
  stockRows: DemandStockRow[],
  options: DemandOptions
) {
  const lowVolumeTotalQty = Math.max(
    Math.round(options.lowVolumeTotalQty ?? DEMAND_LOW_VOLUME_TOTAL_QTY),
    0
  )
  const seasonStartRatio = Math.min(
    Math.max(options.seasonStartRatio ?? DEMAND_SEASON_START_RATIO, 0),
    1
  )
  const seasonEndRatio = Math.min(
    Math.max(options.seasonEndRatio ?? DEMAND_SEASON_END_RATIO, 0),
    1
  )
  const recentSeasonRatio = Math.min(
    Math.max(options.recentSeasonRatio ?? DEMAND_RECENT_SEASON_RATIO, 0),
    1
  )
  const maxSeasonMonths = Math.max(
    Math.round(options.maxSeasonMonths ?? DEMAND_MAX_SEASON_MONTHS),
    2
  )
  const safetyRate = Math.max(options.safetyRate ?? DEMAND_SAFETY_RATE, 0)
  const roundUnit = Math.max(
    Math.round(options.roundUnit ?? DEMAND_ROUND_UNIT),
    1
  )
  const conditionalMaxQty = Math.max(
    Math.round(options.conditionalMaxQty ?? DEMAND_CONDITIONAL_MAX_QTY),
    0
  )
  const rampUpLookbackMonths = Math.max(
    Math.round(options.rampUpLookbackMonths ?? DEMAND_RAMP_UP_LOOKBACK_MONTHS),
    0
  )

  const months = listMonths(options.startDate, options.endDate)
  const salesByModelMonth = new Map<string, Map<string, number>>()
  const claimsByModelMonth = new Map<string, Map<string, number>>()
  const salesByModelSkuMonth = new Map<string, Map<string, Map<string, number>>>()
  const claimsByModelSkuMonth = new Map<string, Map<string, Map<string, number>>>()
  const stockByModelSku = new Map<string, Map<string, number>>()

  salesRows.forEach((row) => {
    const date = toDateOnly(row.order_date)
    const month = toMonthKey(date)
    const sku = normalizeReorderSku(row.sku)
    const model = getModelFromReorderSku(sku)
    if (!date || date < options.startDate || date > options.endDate) return
    if (!month || !sku || !model || model === '-') return

    const qty = Number(row.qty || 0)

    const modelMonth = salesByModelMonth.get(model) || new Map<string, number>()
    modelMonth.set(month, (modelMonth.get(month) || 0) + qty)
    salesByModelMonth.set(model, modelMonth)

    const modelSku = salesByModelSkuMonth.get(model) || new Map()
    const skuMonth = modelSku.get(sku) || new Map<string, number>()
    skuMonth.set(month, (skuMonth.get(month) || 0) + qty)
    modelSku.set(sku, skuMonth)
    salesByModelSkuMonth.set(model, modelSku)
  })

  claimRows.forEach((row) => {
    const date = toDateOnly(row.claim_date)
    const month = toMonthKey(date)
    const sku = normalizeReorderSku(row.sku)
    const model = getModelFromReorderSku(sku)
    if (!date || date < options.startDate || date > options.endDate) return
    if (!month || !sku || !model || model === '-') return

    const qty = Math.abs(Number(row.qty || 0))

    const modelMonth = claimsByModelMonth.get(model) || new Map<string, number>()
    modelMonth.set(month, (modelMonth.get(month) || 0) + qty)
    claimsByModelMonth.set(model, modelMonth)

    const modelSku = claimsByModelSkuMonth.get(model) || new Map()
    const skuMonth = modelSku.get(sku) || new Map<string, number>()
    skuMonth.set(month, (skuMonth.get(month) || 0) + qty)
    modelSku.set(sku, skuMonth)
    claimsByModelSkuMonth.set(model, modelSku)
  })

  stockRows.forEach((row) => {
    const sku = normalizeReorderSku(row.sku)
    const model = getModelFromReorderSku(sku)
    if (!sku || !model || model === '-') return

    const modelStock = stockByModelSku.get(model) || new Map<string, number>()
    modelStock.set(sku, (modelStock.get(sku) || 0) + Number(row.qty || 0))
    stockByModelSku.set(model, modelStock)
  })

  const modelNames = Array.from(
    new Set([
      ...salesByModelMonth.keys(),
      ...claimsByModelMonth.keys(),
      ...stockByModelSku.keys(),
    ])
  )

  const models: DemandModelSummary[] = modelNames.map((model) => {
    const modelSales = salesByModelMonth.get(model) || new Map<string, number>()
    const modelClaims = claimsByModelMonth.get(model) || new Map<string, number>()

    const baseMonthlyRows = months.map((month) => {
      const salesQty = modelSales.get(month) || 0
      const claimQty = modelClaims.get(month) || 0
      return {
        month,
        salesQty,
        claimQty,
        netSalesQty: Math.max(salesQty - claimQty, 0),
      }
    })

    const totalNetSalesQty = baseMonthlyRows.reduce(
      (sum, row) => sum + Math.max(row.netSalesQty, 0),
      0
    )

    const isLowVolume = totalNetSalesQty > 0 && totalNetSalesQty < lowVolumeTotalQty
    const candidates = isLowVolume
      ? []
      : detectSeasonCandidates(
          baseMonthlyRows,
          seasonStartRatio,
          seasonEndRatio,
          maxSeasonMonths
        )

    const rawSelectedCandidate = isLowVolume
      ? null
      : selectSeasonCandidate(candidates, recentSeasonRatio)
    const selectedCandidate = rawSelectedCandidate
      ? expandCandidateWithRampUp(
          rawSelectedCandidate,
          baseMonthlyRows,
          rampUpLookbackMonths,
          maxSeasonMonths
        )
      : null
    const fallback = selectedCandidate || isLowVolume
      ? null
      : pickFallbackPeriod(baseMonthlyRows)

    const calculationMethod: DemandCalculationMethod = isLowVolume
      ? 'low_volume'
      : selectedCandidate
        ? 'season'
        : fallback?.method || 'insufficient_data'

    const recentRowsForLowVolume = baseMonthlyRows.slice(-18)
    const lowVolumeDemandQty = isLowVolume
      ? Math.round((recentRowsForLowVolume.reduce(
          (sum, row) => sum + Math.max(row.netSalesQty, 0),
          0
        ) * 8) / Math.max(recentRowsForLowVolume.length, 1))
      : 0

    const automaticStartMonth = selectedCandidate?.startMonth || fallback?.startMonth || ''
    const automaticEndMonth = selectedCandidate?.endMonth || fallback?.endMonth || ''
    const manualPeriod = options.manualPeriods?.[model]
    const hasValidManualPeriod = Boolean(
      manualPeriod?.startMonth &&
      manualPeriod?.endMonth &&
      manualPeriod.startMonth <= manualPeriod.endMonth &&
      months.includes(manualPeriod.startMonth) &&
      months.includes(manualPeriod.endMonth)
    )
    const demandStartMonth = hasValidManualPeriod
      ? manualPeriod!.startMonth
      : automaticStartMonth
    const demandEndMonth = hasValidManualPeriod
      ? manualPeriod!.endMonth
      : automaticEndMonth
    const demandSalesQty = hasValidManualPeriod
      ? baseMonthlyRows
          .filter((row) => row.month >= demandStartMonth && row.month <= demandEndMonth)
          .reduce((sum, row) => sum + Math.max(row.netSalesQty, 0), 0)
      : isLowVolume
        ? lowVolumeDemandQty
        : selectedCandidate?.totalNetSalesQty || fallback?.demandSalesQty || 0

    const monthlyRows: DemandMonthlyRow[] = baseMonthlyRows.map((row) => ({
      ...row,
      isSelected:
        Boolean(demandStartMonth && demandEndMonth) &&
        row.month >= demandStartMonth &&
        row.month <= demandEndMonth,
    }))

    const modelStock = stockByModelSku.get(model) || new Map<string, number>()
    const currentStockQty = Array.from(modelStock.values()).reduce(
      (sum, qty) => sum + qty,
      0
    )

    const stockCoverageRate =
      demandSalesQty > 0 ? (currentStockQty / demandSalesQty) * 100 : 0
    const minimumReorderQty = ceilToUnit(
      Math.max(demandSalesQty - currentStockQty, 0),
      roundUnit
    )
    const recommendedReorderQty = ceilToUnit(
      Math.max(demandSalesQty * (1 + safetyRate) - currentStockQty, 0),
      roundUnit
    )

    const skuSet = new Set<string>([
      ...Array.from(salesByModelSkuMonth.get(model)?.keys() || []),
      ...Array.from(claimsByModelSkuMonth.get(model)?.keys() || []),
      ...Array.from(modelStock.keys()),
    ])

    const rawSkuRows = Array.from(skuSet).map((sku) => {
      const skuSalesMonths =
        salesByModelSkuMonth.get(model)?.get(sku) || new Map<string, number>()
      const skuClaimMonths =
        claimsByModelSkuMonth.get(model)?.get(sku) || new Map<string, number>()

      let periodSalesQty = 0
      let periodClaimQty = 0

      months.forEach((month) => {
        if (!demandStartMonth || !demandEndMonth) return
        if (month < demandStartMonth || month > demandEndMonth) return
        periodSalesQty += skuSalesMonths.get(month) || 0
        periodClaimQty += skuClaimMonths.get(month) || 0
      })

      const periodNetSalesQty = Math.max(periodSalesQty - periodClaimQty, 0)
      const currentSkuStockQty = modelStock.get(sku) || 0
      const { colorCode, size } = getColorAndSizeFromSku(sku)

      return {
        sku,
        model,
        colorCode,
        size,
        periodSalesQty,
        periodClaimQty,
        periodNetSalesQty,
        salesShare: 0,
        currentStockQty: currentSkuStockQty,
        targetDemandQty: 0,
        recommendedQty: 0,
      }
    })

    const skuPeriodTotal = rawSkuRows.reduce(
      (sum, row) => sum + row.periodNetSalesQty,
      0
    )

    const skuRows: DemandSkuSummary[] = rawSkuRows
      .map((row) => {
        const salesShare =
          skuPeriodTotal > 0 ? row.periodNetSalesQty / skuPeriodTotal : 0

        const targetDemandQty =
          calculationMethod === 'season'
            ? row.periodNetSalesQty * (1 + safetyRate)
            : demandSalesQty * salesShare * (1 + safetyRate)

        const recommendedQty = ceilToUnit(
          Math.max(targetDemandQty - row.currentStockQty, 0),
          roundUnit
        )

        return {
          ...row,
          salesShare,
          targetDemandQty: Math.round(targetDemandQty),
          recommendedQty,
        }
      })
      .sort(
        (a, b) =>
          b.recommendedQty - a.recommendedQty ||
          b.periodNetSalesQty - a.periodNetSalesQty ||
          a.sku.localeCompare(b.sku, 'ko-KR', { numeric: true })
      )

    return {
      model,
      calculationMethod,
      demandStartMonth,
      demandEndMonth,
      demandSalesQty,
      currentStockQty,
      stockCoverageRate,
      minimumReorderQty,
      recommendedReorderQty,
      decision: getDecision(
        calculationMethod,
        recommendedReorderQty,
        conditionalMaxQty
      ),
      urgency: getUrgency(
        calculationMethod,
        stockCoverageRate,
        recommendedReorderQty
      ),
      monthlyRows,
      candidates: candidates.slice(0, 3),
      skuRows,
    }
  })

  models.sort(
    (a, b) =>
      b.recommendedReorderQty - a.recommendedReorderQty ||
      a.stockCoverageRate - b.stockCoverageRate ||
      a.model.localeCompare(b.model, 'ko-KR', { numeric: true })
  )

  return models
}
