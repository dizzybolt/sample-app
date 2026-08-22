'use client'

import * as XLSX from 'xlsx'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  RefreshCw,
  Search,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListPagination } from '@/components/list-pagination'
import {
  buildDemandRecommendations,
  buildDemandDailyExportRows,
  DEMAND_ANALYSIS_MONTHS,
  DEMAND_LOW_VOLUME_TOTAL_QTY,
  DEMAND_MAX_SEASON_MONTHS,
  DEMAND_RECENT_SEASON_RATIO,
  DEMAND_SAFETY_RATE,
  DEMAND_SEASON_END_RATIO,
  DEMAND_SEASON_START_RATIO,
  type DemandClaimRow,
  type DemandModelSummary,
  type DemandSalesRow,
  type DemandStockRow,
} from '@/lib/ops/reorder-demand'
import {
  fetchProductImageMap,
  normalizeModelName,
  resolveProductImage,
} from '@/lib/product-images'
import {
  REORDER_DEMAND_REFERENCE,
  type DemandReferenceRow,
} from '@/lib/ops/reorder-demand-reference'

const FETCH_CHUNK_SIZE = 1000
const MODEL_PAGE_SIZE = 30

const MACRO_TEMPLATE_PATH = '/excel/order-sheet-template.xlsm'
const DEMAND_TEMPLATE_PATH = '/excel/reorder-demand-template.xlsm'
const DEMAND_FORMAT_TEMPLATE_PATH = '/excel/reorder-demand-format-template.xlsx'


type DemandSourceState = {
  salesRows: DemandSalesRow[]
  claimRows: DemandClaimRow[]
  stockRows: DemandStockRow[]
  startDate: string
  endDate: string
}

type PeriodSelectionDraft = {
  startMonth: string
  endMonth?: string
}

type ValidationUploadRow = {
  모델명?: string
  상품명?: string
  검증유형?: string
  기준시작월?: string
  기준종료월?: string
  비고?: string
}

function getSafeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_')
}

function normalizeMonthInput(value?: string | number | null) {
  const raw = String(value ?? '').trim().replace(/[./]/g, '-')
  const match = raw.match(/^(\d{4})-(\d{1,2})/)
  if (!match) return ''
  const month = Number(match[2])
  if (month < 1 || month > 12) return ''
  return `${match[1]}-${String(month).padStart(2, '0')}`
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('ko-KR')
}

function formatRate(value: number) {
  return `${value.toFixed(1)}%`
}

function formatMonth(value?: string | null) {
  if (!value) return '-'
  const [year, month] = value.split('-')
  if (!year || !month) return value
  return `${year.slice(2)}.${month}`
}


function getMonthStartDate(month: string) {
  return month ? `${month}-01` : ''
}

function getMonthEndDate(month: string) {
  if (!month) return ''
  const [year, monthValue] = month.split('-').map(Number)
  const lastDay = new Date(year, monthValue, 0).getDate()
  return `${year}-${String(monthValue).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

function listDatesInclusive(startDate: string, endDate: string) {
  if (!startDate || !endDate || startDate > endDate) return []
  const result: string[] = []
  const current = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  while (current <= end) {
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, '0')
    const day = String(current.getDate()).padStart(2, '0')
    result.push(`${year}-${month}-${day}`)
    current.setDate(current.getDate() + 1)
  }
  return result
}

function getKoreanWeekday(date: string) {
  const labels = ['일', '월', '화', '수', '목', '금', '토']
  const value = new Date(`${date}T00:00:00`)
  return labels[value.getDay()] || ''
}

function clampDate(value: string, minValue: string, maxValue: string) {
  if (!value) return value
  if (minValue && value < minValue) return minValue
  if (maxValue && value > maxValue) return maxValue
  return value
}

function getDateMonthsAgo(months: number) {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-01`
}

function getToday() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function getLatestDate<T>(
  rows: T[],
  getDate: (row: T) => string | null | undefined
) {
  return rows.reduce((latest, row) => {
    const value = String(getDate(row) || '').slice(0, 10)
    return value > latest ? value : latest
  }, '')
}

function getDecisionClass(value: string) {
  if (value === '재발주') return 'bg-red-100 text-red-700'
  if (value === '소량/조건부') return 'bg-amber-100 text-amber-700'
  if (value === '자료보완') return 'bg-gray-200 text-gray-700'
  return 'bg-green-100 text-green-700'
}

function getUrgencyClass(value: string) {
  if (value === '긴급') return 'bg-red-100 text-red-700'
  if (value === '높음') return 'bg-orange-100 text-orange-700'
  if (value === '보통') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}

function getMethodLabel(value: DemandModelSummary['calculationMethod']) {
  if (value === 'season') return '시즌구간'
  if (value === 'low_volume') return '소량/비정형'
  if (value === 'normalized_8m') return '18개월→8개월 환산'
  return '자료부족'
}


type ValidationStatus =
  | 'exact'
  | 'within1'
  | 'boundary_low'
  | 'different'
  | 'season_shift'
  | 'missing'
  | 'exception'
  | 'excluded'

function monthSerial(value: string) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return 0
  return year * 12 + month
}

function getPeriodCenter(startMonth: string, endMonth: string) {
  return (monthSerial(startMonth) + monthSerial(endMonth)) / 2
}

function getMonthsBetween(startMonth: string, endMonth: string) {
  const start = monthSerial(startMonth)
  const end = monthSerial(endMonth)
  const months: string[] = []

  for (let serial = start; serial <= end; serial += 1) {
    const year = Math.floor((serial - 1) / 12)
    const month = ((serial - 1) % 12) + 1
    months.push(`${year}-${String(month).padStart(2, '0')}`)
  }

  return months
}

function hasOnlyLowSalesInBoundaryDifference(
  reference: DemandReferenceRow,
  model: DemandModelSummary
) {
  if (!model.demandStartMonth || !model.demandEndMonth) return false

  const referenceMonths = new Set(
    getMonthsBetween(reference.startMonth, reference.endMonth)
  )
  const automaticMonths = new Set(
    getMonthsBetween(model.demandStartMonth, model.demandEndMonth)
  )
  const differingMonths = new Set<string>()

  referenceMonths.forEach((month) => {
    if (!automaticMonths.has(month)) differingMonths.add(month)
  })
  automaticMonths.forEach((month) => {
    if (!referenceMonths.has(month)) differingMonths.add(month)
  })

  if (differingMonths.size === 0) return false

  const peakQty = Math.max(
    ...model.monthlyRows.map((row) => Number(row.netSalesQty || 0)),
    0
  )
  const lowSalesThreshold = Math.max(5, Math.round(peakQty * 0.05))
  const monthlyMap = new Map(
    model.monthlyRows.map((row) => [row.month, Number(row.netSalesQty || 0)])
  )

  return Array.from(differingMonths).every(
    (month) => (monthlyMap.get(month) || 0) <= lowSalesThreshold
  )
}

function hasRampUpAtSelectedStart(model: DemandModelSummary) {
  if (!model.demandStartMonth) return false
  const index = model.monthlyRows.findIndex(
    (row) => row.month === model.demandStartMonth
  )
  if (index < 0 || index + 2 >= model.monthlyRows.length) return false

  const first = Number(model.monthlyRows[index].netSalesQty || 0)
  const second = Number(model.monthlyRows[index + 1].netSalesQty || 0)
  const third = Number(model.monthlyRows[index + 2].netSalesQty || 0)

  return first > 0 && first <= second && second <= third
}

function getValidationStatus(
  reference: DemandReferenceRow,
  model?: DemandModelSummary
): ValidationStatus {
  if (reference.excludeFromValidation) return 'exception'
  if (reference.kind !== 'period') return 'excluded'
  if (!model || model.calculationMethod !== 'season' || !model.demandStartMonth || !model.demandEndMonth) return 'missing'

  const startDiff = Math.abs(
    monthSerial(model.demandStartMonth) - monthSerial(reference.startMonth)
  )
  const endDiff = Math.abs(
    monthSerial(model.demandEndMonth) - monthSerial(reference.endMonth)
  )
  const centerDiff = Math.abs(
    getPeriodCenter(model.demandStartMonth, model.demandEndMonth) -
      getPeriodCenter(reference.startMonth, reference.endMonth)
  )

  if (startDiff === 0 && endDiff === 0) return 'exact'
  if (startDiff <= 1 && endDiff <= 1) return 'within1'
  if (centerDiff >= 4) return 'season_shift'
  if (hasOnlyLowSalesInBoundaryDifference(reference, model)) {
    return 'boundary_low'
  }
  return 'different'
}

function getValidationLabel(value: ValidationStatus) {
  if (value === 'exact') return '완전일치'
  if (value === 'within1') return '±1개월'
  if (value === 'boundary_low') return '저판매 경계차이'
  if (value === 'different') return '실제 경계오차'
  if (value === 'season_shift') return '다른 시즌 선택'
  if (value === 'missing') return '자동구간 없음'
  if (value === 'exception') return '예외 모델'
  return '비교제외'
}

function getValidationClass(value: ValidationStatus) {
  if (value === 'exact') return 'bg-green-100 text-green-700'
  if (value === 'within1') return 'bg-amber-100 text-amber-700'
  if (value === 'boundary_low') return 'bg-cyan-100 text-cyan-700'
  if (value === 'different') return 'bg-red-100 text-red-700'
  if (value === 'season_shift') return 'bg-purple-100 text-purple-700'
  if (value === 'exception') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}

export function ReorderDemandManager() {
  const supabase = useMemo(() => createClient(), [])
  const [models, setModels] = useState<DemandModelSummary[]>([])
  const [automaticModels, setAutomaticModels] = useState<DemandModelSummary[]>([])
  const [sourceState, setSourceState] = useState<DemandSourceState | null>(null)
  const [periodSelections, setPeriodSelections] = useState<Record<string, PeriodSelectionDraft>>({})
  const [keyword, setKeyword] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [exporting, setExporting] = useState(false)
  const [validationOpen, setValidationOpen] = useState(false)
  const [validationReferences, setValidationReferences] = useState<DemandReferenceRow[]>(
    REORDER_DEMAND_REFERENCE
  )
  const [validationFileName, setValidationFileName] = useState('기본 검증자료')
  const validationFileInputRef = useRef<HTMLInputElement>(null)
  const [dataDates, setDataDates] = useState({
    sales: '',
    claim: '',
    stock: '',
  })

  const filteredModels = useMemo(() => {
    const normalized = keyword.trim().toUpperCase()
    if (!normalized) return models

    return models.filter(
      (row) =>
        row.model.toUpperCase().includes(normalized) ||
        row.skuRows.some((skuRow) =>
          skuRow.sku.toUpperCase().includes(normalized)
        )
    )
  }, [keyword, models])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredModels.length / MODEL_PAGE_SIZE)
  )

  const pagedModels = useMemo(() => {
    const from = (currentPage - 1) * MODEL_PAGE_SIZE
    return filteredModels.slice(from, from + MODEL_PAGE_SIZE)
  }, [currentPage, filteredModels])

  const automaticModelMap = useMemo(
    () => new Map(automaticModels.map((row) => [row.model, row])),
    [automaticModels]
  )

  const validationRows = useMemo(() => {
    const modelMap = new Map(models.map((row) => [row.model, row]))

    return validationReferences.map((reference) => {
      const model = modelMap.get(reference.model)
      const status = getValidationStatus(reference, model)
      const startDiff =
        reference.kind === 'period' && model?.demandStartMonth
          ? monthSerial(model.demandStartMonth) - monthSerial(reference.startMonth)
          : null
      const endDiff =
        reference.kind === 'period' && model?.demandEndMonth
          ? monthSerial(model.demandEndMonth) - monthSerial(reference.endMonth)
          : null
      const centerDiff =
        reference.kind === 'period' &&
        model?.demandStartMonth &&
        model?.demandEndMonth
          ? getPeriodCenter(model.demandStartMonth, model.demandEndMonth) -
            getPeriodCenter(reference.startMonth, reference.endMonth)
          : null
      const maxAbsDiff = Math.max(
        Math.abs(startDiff ?? 0),
        Math.abs(endDiff ?? 0)
      )

      return {
        reference,
        model,
        status,
        startDiff,
        endDiff,
        centerDiff,
        maxAbsDiff,
      }
    }).sort((a, b) => {
      const statusRank = (value: ValidationStatus) => {
        if (value === 'season_shift') return 0
        if (value === 'different') return 1
        if (value === 'boundary_low') return 2
        if (value === 'missing') return 3
        if (value === 'exception') return 4
        if (value === 'within1') return 5
        if (value === 'exact') return 6
        return 7
      }

      return (
        statusRank(a.status) - statusRank(b.status) ||
        b.maxAbsDiff - a.maxAbsDiff ||
        a.reference.model.localeCompare(b.reference.model, 'ko-KR', { numeric: true })
      )
    })
  }, [models, validationReferences])

  const validationTotals = useMemo(() => {
    return validationRows.reduce(
      (acc, row) => {
        if (row.status === 'exact') acc.exact += 1
        if (row.status === 'within1') acc.within1 += 1
        if (row.status === 'boundary_low') acc.boundaryLow += 1
        if (row.status === 'different') acc.different += 1
        if (row.status === 'season_shift') acc.seasonShift += 1
        if (row.status === 'missing') acc.missing += 1
        if (row.status === 'exception') acc.exception += 1
        if (row.status !== 'excluded' && row.status !== 'exception') acc.comparable += 1
        return acc
      },
      {
        exact: 0,
        within1: 0,
        boundaryLow: 0,
        different: 0,
        seasonShift: 0,
        missing: 0,
        exception: 0,
        comparable: 0,
      }
    )
  }, [validationRows])

  const validationDiagnostics = useMemo(() => {
    const comparableRows = validationRows.filter(
      (row) =>
        row.reference.kind === 'period' &&
        row.status !== 'exception' &&
        row.startDiff !== null &&
        row.endDiff !== null
    )

    const startLate = comparableRows.filter((row) => (row.startDiff || 0) > 0).length
    const startEarly = comparableRows.filter((row) => (row.startDiff || 0) < 0).length
    const startExact = comparableRows.filter((row) => row.startDiff === 0).length
    const endLate = comparableRows.filter((row) => (row.endDiff || 0) > 0).length
    const endEarly = comparableRows.filter((row) => (row.endDiff || 0) < 0).length
    const endExact = comparableRows.filter((row) => row.endDiff === 0).length

    const average = (values: number[]) =>
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0

    return {
      count: comparableRows.length,
      startLate,
      startEarly,
      startExact,
      endLate,
      endEarly,
      endExact,
      avgStartDiff: average(comparableRows.map((row) => row.startDiff || 0)),
      avgEndDiff: average(comparableRows.map((row) => row.endDiff || 0)),
      avgAbsStartDiff: average(comparableRows.map((row) => Math.abs(row.startDiff || 0))),
      avgAbsEndDiff: average(comparableRows.map((row) => Math.abs(row.endDiff || 0))),
    }
  }, [validationRows])

  const totals = useMemo(
    () =>
      filteredModels.reduce(
        (acc, row) => {
          acc.demandSalesQty += row.demandSalesQty
          acc.currentStockQty += row.currentStockQty
          acc.recommendedQty += row.recommendedReorderQty
          if (row.decision === '재발주') acc.reorderCount += 1
          return acc
        },
        {
          demandSalesQty: 0,
          currentStockQty: 0,
          recommendedQty: 0,
          reorderCount: 0,
        }
      ),
    [filteredModels]
  )

  useEffect(() => {
    if (pagedModels.length === 0) {
      setImageUrls({})
      return
    }

    let cancelled = false
    const targets = pagedModels.map((row) => ({ modelName: row.model }))

    void fetchProductImageMap(supabase, targets)
      .then((imageMap) => {
        if (!cancelled) setImageUrls(Object.fromEntries(imageMap))
      })
      .catch(() => {
        if (!cancelled) setImageUrls({})
      })

    return () => {
      cancelled = true
    }
  }, [pagedModels, supabase])

  async function fetchAllRows<T>(
    tableName: string,
    columns: string,
    orderColumn: string,
    startDate?: string,
    endDate?: string
  ) {
    const rows: T[] = []

    for (let from = 0; ; from += FETCH_CHUNK_SIZE) {
      let query = supabase
        .from(tableName)
        .select(columns)
        .order(orderColumn, { ascending: true })
        .range(from, from + FETCH_CHUNK_SIZE - 1)

      if (startDate) query = query.gte(orderColumn, startDate)
      if (endDate) query = query.lte(orderColumn, endDate)

      const { data, error } = await query
      if (error) throw error
      if (!data || data.length === 0) break

      rows.push(...(data as T[]))
      if (data.length < FETCH_CHUNK_SIZE) break
    }

    return rows
  }


  async function writeMacroWorkbook(
    rows: Record<string, string | number>[],
    fileName: string,
    columnWidths: number[]
  ) {
    if (rows.length === 0) {
      window.alert('다운로드할 데이터가 없습니다.')
      return
    }

    setExporting(true)
    try {
      const response = await fetch(MACRO_TEMPLATE_PATH)
      if (!response.ok) {
        throw new Error('매크로 엑셀 템플릿을 불러오지 못했습니다.')
      }

      const buffer = await response.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', bookVBA: true })
      const sheetName = workbook.SheetNames[0]
      const worksheet = XLSX.utils.json_to_sheet(rows)
      worksheet['!cols'] = columnWidths.map((wch) => ({ wch }))
      workbook.Sheets[sheetName] = worksheet
      XLSX.writeFile(workbook, getSafeFileName(fileName), {
        bookType: 'xlsm',
      })
    } catch (error: any) {
      console.error(error)
      window.alert(
        `엑셀 다운로드에 실패했습니다.\\n\\n${error?.message || '알 수 없는 오류'}`
      )
    } finally {
      setExporting(false)
    }
  }

  function compareExportText(a: string, b: string) {
    return String(a || '').localeCompare(String(b || ''), 'ko-KR', {
      numeric: true,
      sensitivity: 'base',
    })
  }

  async function exportRecommendationList() {
    const sortedModels = [...filteredModels].sort((a, b) =>
      compareExportText(a.model, b.model)
    )
    const targets = sortedModels.map((row) => ({ modelName: row.model }))
    const imageMap = await fetchProductImageMap(supabase, targets, {
      modelOnly: true,
    })

    const rows = sortedModels.map((row) => ({
      이미지URL: imageMap.get(normalizeModelName(row.model)) || '',
      썸네일: '',
      모델명: row.model,
      산정방식: getMethodLabel(row.calculationMethod),
      적용기간:
        row.demandStartMonth && row.demandEndMonth
          ? `${row.demandStartMonth}~${row.demandEndMonth}`
          : '',
      산정판매량: row.demandSalesQty,
      현재고: row.currentStockQty,
      재고커버율: Number((row.stockCoverageRate / 100).toFixed(4)),
      최소발주: row.minimumReorderQty,
      권장발주: row.recommendedReorderQty,
      판단: row.decision,
      긴급도: row.urgency,
    }))

    await writeMacroWorkbook(
      rows,
      `시즌수요_발주추천_${getToday()}.xlsm`,
      [42, 14, 18, 18, 22, 14, 14, 14, 14, 14, 14, 12]
    )
  }

  async function exportModelRecommendation(model: DemandModelSummary) {
    if (!sourceState) {
      window.alert('원본 판매데이터가 없어 모델 상세 엑셀을 생성할 수 없습니다.')
      return
    }

    const periodStart = clampDate(
      getMonthStartDate(model.demandStartMonth),
      sourceState.startDate,
      sourceState.endDate
    )
    const periodEnd = clampDate(
      getMonthEndDate(model.demandEndMonth),
      sourceState.startDate,
      sourceState.endDate
    )

    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      window.alert('적용기간을 확인해 주세요.')
      return
    }

    const cloneStyle = (value: any) => {
      if (!value) return undefined
      return JSON.parse(JSON.stringify(value))
    }

    const copyCellStyle = (
      sheet: XLSX.WorkSheet,
      sourceAddress: string,
      targetAddress: string
    ) => {
      const source = sheet[sourceAddress] as any
      const target = (sheet[targetAddress] || { t: 's', v: '' }) as any
      if (source?.s !== undefined) target.s = cloneStyle(source.s)
      if (source?.z !== undefined) target.z = source.z
      sheet[targetAddress] = target
    }

    const setCellValue = (
      sheet: XLSX.WorkSheet,
      address: string,
      value: string | number | null | undefined,
      styleFrom?: string
    ) => {
      const source = (styleFrom ? sheet[styleFrom] : sheet[address]) as any
      const cell: any = {
        t: typeof value === 'number' ? 'n' : 's',
        v: value ?? '',
      }
      if (source?.s !== undefined) cell.s = cloneStyle(source.s)
      if (source?.z !== undefined) cell.z = source.z
      sheet[address] = cell
    }

    const setCellFormula = (
      sheet: XLSX.WorkSheet,
      address: string,
      formula: string,
      styleFrom?: string,
      cachedValue: number = 0
    ) => {
      const source = (styleFrom ? sheet[styleFrom] : sheet[address]) as any
      const cell: any = {
        t: 'n',
        f: formula,
        v: cachedValue,
      }
      if (source?.s !== undefined) cell.s = cloneStyle(source.s)
      if (source?.z !== undefined) cell.z = source.z
      sheet[address] = cell
    }

    const clearRangeValues = (
      sheet: XLSX.WorkSheet,
      startRow: number,
      endRow: number,
      startCol: number,
      endCol: number
    ) => {
      for (let row = startRow; row <= endRow; row += 1) {
        for (let col = startCol; col <= endCol; col += 1) {
          const address = XLSX.utils.encode_cell({ r: row - 1, c: col })
          const cell = sheet[address] as any
          if (!cell) continue
          delete cell.f
          delete cell.w
          delete cell.l
          cell.t = 's'
          cell.v = ''
        }
      }
    }

    const copyRowStyles = (
      sheet: XLSX.WorkSheet,
      sourceRow: number,
      targetRow: number,
      startCol: number,
      endCol: number
    ) => {
      for (let col = startCol; col <= endCol; col += 1) {
        const sourceAddress = XLSX.utils.encode_cell({
          r: sourceRow - 1,
          c: col,
        })
        const targetAddress = XLSX.utils.encode_cell({
          r: targetRow - 1,
          c: col,
        })
        copyCellStyle(sheet, sourceAddress, targetAddress)
      }
    }

    const groupDatesByMonth = (dates: string[]) => {
      const groups: { month: string; dates: string[] }[] = []
      dates.forEach((date) => {
        const month = date.slice(0, 7)
        const last = groups[groups.length - 1]
        if (last?.month === month) {
          last.dates.push(date)
        } else {
          groups.push({ month, dates: [date] })
        }
      })
      return groups
    }

    setExporting(true)
    try {
      const dailyRows = buildDemandDailyExportRows(
        sourceState.salesRows,
        sourceState.claimRows,
        sourceState.stockRows,
        model.model,
        periodStart,
        periodEnd
      )
      const dates = listDatesInclusive(periodStart, periodEnd)
      const monthGroups = groupDatesByMonth(dates)

      const sortedSkuRows = [...model.skuRows].sort(
        (a, b) =>
          compareExportText(a.model, b.model) ||
          compareExportText(a.colorCode, b.colorCode) ||
          compareExportText(a.size, b.size) ||
          compareExportText(a.sku, b.sku)
      )

      const dailyBySkuDate = new Map<string, number>()
      dailyRows.forEach((row) => {
        const key = `${row.convertedSku}\u0001${row.date}`
        dailyBySkuDate.set(
          key,
          (dailyBySkuDate.get(key) || 0) + Number(row.netSalesQty || 0)
        )
      })

      // The existing XLSM is used only as the VBA source.
      // The uploaded example workbook is used as the visible layout/formula source.
      const [macroResponse, formatResponse] = await Promise.all([
        fetch(DEMAND_TEMPLATE_PATH),
        fetch(DEMAND_FORMAT_TEMPLATE_PATH),
      ])

      if (!macroResponse.ok) {
        throw new Error('시즌수요 매크로 템플릿을 불러오지 못했습니다.')
      }
      if (!formatResponse.ok) {
        throw new Error('시즌수요 발주 양식 템플릿을 불러오지 못했습니다.')
      }

      const [macroBuffer, formatBuffer] = await Promise.all([
        macroResponse.arrayBuffer(),
        formatResponse.arrayBuffer(),
      ])

      const macroWorkbook = XLSX.read(macroBuffer, {
        type: 'array',
        bookVBA: true,
        cellStyles: true,
      })
      const workbook = XLSX.read(formatBuffer, {
        type: 'array',
        cellStyles: true,
      }) as XLSX.WorkBook & { vbaraw?: any }

      // Reuse the already-tested VBA project from reorder-demand-template.xlsm.
      const macroRaw = (macroWorkbook as any).vbaraw
      if (!macroRaw) {
        throw new Error(
          '기존 시즌수요 XLSM 템플릿에서 VBA 프로젝트를 찾지 못했습니다.'
        )
      }
      ;(workbook as any).vbaraw = macroRaw

      // Keep the workbook VBA CodeName paired with vbaProject.bin.
      const macroMeta = (macroWorkbook as any).Workbook
      const workbookMeta = ((workbook as any).Workbook ||= {})
      workbookMeta.WBProps ||= {}
      if (macroMeta?.WBProps?.CodeName) {
        workbookMeta.WBProps.CodeName = macroMeta.WBProps.CodeName
      }

      workbookMeta.Sheets ||= []
      workbook.SheetNames.forEach((_name, index) => {
        workbookMeta.Sheets[index] ||= {}
        workbookMeta.Sheets[index].CodeName = `Sheet${index + 1}`
      })
      workbookMeta.CalcPr = {
        ...(workbookMeta.CalcPr || {}),
        calcMode: 'auto',
        fullCalcOnLoad: '1',
        forceFullCalc: '1',
      }

      const orderSheet = workbook.Sheets['1_발주서']
      const dailySheet = workbook.Sheets['2_일자별판매']
      if (!orderSheet || !dailySheet) {
        throw new Error(
          '양식 템플릿에는 1_발주서 / 2_일자별판매 시트가 필요합니다.'
        )
      }

      // ============================================================
      // 2_일자별판매
      // Example structure:
      // A-C fixed SKU columns
      // [month total][daily columns] repeated by month
      // final columns: 계 / 누계 / 판매율 / 재고
      // ============================================================
      const dailyDataStartRow = 6
      const dailyDataEndRow = dailyDataStartRow + sortedSkuRows.length - 1
      const dailyTotalRow = Math.max(dailyDataEndRow + 1, dailyDataStartRow + 1)

      const templateDailyDataRow = 6
      const templateDailyTotalRow = 13
      const templateMonthTotalCol = 3 // D, zero-based
      const templateDateCol = 4 // E
      const templateSummaryCol = 161 // FF in the example template

      clearRangeValues(dailySheet, 1, Math.max(dailyTotalRow, 20), 0, 600)

      setCellValue(
        dailySheet,
        'A1',
        '일자별 판매분석 (참고자료 원본)',
        'A1'
      )
      setCellValue(
        dailySheet,
        'A2',
        `[기준일자 : ${periodStart} ~ ${periodEnd}] [품번 : ${model.model} ~ ${model.model}]`,
        'A2'
      )

      ;['A4', 'B4', 'C4'].forEach((address, index) => {
        setCellValue(
          dailySheet,
          address,
          ['품번', '칼라', 'SIZE'][index],
          address
        )
      })

      let currentCol = 3
      const monthLayouts: {
        month: string
        totalCol: number
        firstDateCol: number
        lastDateCol: number
      }[] = []

      monthGroups.forEach((group) => {
        const totalCol = currentCol
        const firstDateCol = totalCol + 1
        const lastDateCol = firstDateCol + group.dates.length - 1
        const [year, month] = group.month.split('-')

        monthLayouts.push({
          month: group.month,
          totalCol,
          firstDateCol,
          lastDateCol,
        })

        const totalColLetter = XLSX.utils.encode_col(totalCol)
        setCellValue(
          dailySheet,
          `${totalColLetter}3`,
          `${year.slice(2)}년`,
          'D3'
        )
        setCellValue(
          dailySheet,
          `${totalColLetter}4`,
          `${Number(month)}월`,
          'D4'
        )
        setCellFormula(
          dailySheet,
          `${totalColLetter}5`,
          `COUNTA(${XLSX.utils.encode_col(firstDateCol)}${dailyTotalRow}:${XLSX.utils.encode_col(lastDateCol)}${dailyTotalRow})`,
          'D5',
          group.dates.length
        )

        group.dates.forEach((date, index) => {
          const col = firstDateCol + index
          const colLetter = XLSX.utils.encode_col(col)
          setCellValue(
            dailySheet,
            `${colLetter}4`,
            Number(date.slice(8, 10)),
            'E4'
          )
          setCellValue(
            dailySheet,
            `${colLetter}5`,
            getKoreanWeekday(date),
            'E5'
          )
        })

        currentCol = lastDateCol + 1
      })

      const summaryStartCol = currentCol
      const summaryHeaders = ['계', '누계', '판매율', '재고']
      summaryHeaders.forEach((header, index) => {
        const col = summaryStartCol + index
        setCellValue(
          dailySheet,
          `${XLSX.utils.encode_col(col)}4`,
          header,
          XLSX.utils.encode_cell({
            r: 3,
            c: templateSummaryCol + index,
          })
        )
      })

      sortedSkuRows.forEach((row, index) => {
        const excelRow = dailyDataStartRow + index

        copyRowStyles(dailySheet, templateDailyDataRow, excelRow, 0, 2)

        setCellValue(dailySheet, `A${excelRow}`, model.model, 'A6')
        setCellValue(dailySheet, `B${excelRow}`, row.colorCode, 'B6')
        setCellValue(dailySheet, `C${excelRow}`, row.size, 'C6')

        monthLayouts.forEach((layout) => {
          const totalLetter = XLSX.utils.encode_col(layout.totalCol)
          const firstDateLetter = XLSX.utils.encode_col(layout.firstDateCol)
          const lastDateLetter = XLSX.utils.encode_col(layout.lastDateCol)

          copyCellStyle(dailySheet, 'D6', `${totalLetter}${excelRow}`)
          setCellFormula(
            dailySheet,
            `${totalLetter}${excelRow}`,
            `SUM(${firstDateLetter}${excelRow}:${lastDateLetter}${excelRow})`,
            'D6'
          )

          for (
            let col = layout.firstDateCol;
            col <= layout.lastDateCol;
            col += 1
          ) {
            const dateIndex =
              monthLayouts
                .filter((item) => item.totalCol < layout.totalCol)
                .reduce(
                  (sum, item) => sum + (item.lastDateCol - item.firstDateCol + 1),
                  0
                ) +
              (col - layout.firstDateCol)
            const date = dates[dateIndex]
            const qty = dailyBySkuDate.get(`${row.sku}\u0001${date}`) || 0
            const address = `${XLSX.utils.encode_col(col)}${excelRow}`
            copyCellStyle(dailySheet, 'E6', address)
            setCellValue(
              dailySheet,
              address,
              qty === 0 ? '' : qty,
              'E6'
            )
          }
        })

        const totalSalesCol = summaryStartCol
        const cumulativeCol = summaryStartCol + 1
        const shareCol = summaryStartCol + 2
        const stockCol = summaryStartCol + 3

        const monthTotalRefs = monthLayouts.map(
          (layout) => `${XLSX.utils.encode_col(layout.totalCol)}${excelRow}`
        )

        setCellFormula(
          dailySheet,
          `${XLSX.utils.encode_col(totalSalesCol)}${excelRow}`,
          monthTotalRefs.length ? `SUM(${monthTotalRefs.join(',')})` : '0',
          'FF6',
          row.periodNetSalesQty
        )
        setCellValue(
          dailySheet,
          `${XLSX.utils.encode_col(cumulativeCol)}${excelRow}`,
          row.periodNetSalesQty,
          'FG6'
        )
        setCellValue(
          dailySheet,
          `${XLSX.utils.encode_col(shareCol)}${excelRow}`,
          model.demandSalesQty > 0
            ? row.periodNetSalesQty / model.demandSalesQty
            : 0,
          'FH6'
        )
        setCellValue(
          dailySheet,
          `${XLSX.utils.encode_col(stockCol)}${excelRow}`,
          row.currentStockQty,
          'FI6'
        )
      })

      // Total row
      copyRowStyles(
        dailySheet,
        templateDailyTotalRow,
        dailyTotalRow,
        0,
        summaryStartCol + 3
      )
      setCellValue(dailySheet, `A${dailyTotalRow}`, '총    계', 'A13')

      monthLayouts.forEach((layout) => {
        const totalLetter = XLSX.utils.encode_col(layout.totalCol)
        setCellFormula(
          dailySheet,
          `${totalLetter}${dailyTotalRow}`,
          `SUM(${totalLetter}${dailyDataStartRow}:${totalLetter}${dailyDataEndRow})`,
          'D13'
        )

        for (
          let col = layout.firstDateCol;
          col <= layout.lastDateCol;
          col += 1
        ) {
          const letter = XLSX.utils.encode_col(col)
          setCellFormula(
            dailySheet,
            `${letter}${dailyTotalRow}`,
            `SUM(${letter}${dailyDataStartRow}:${letter}${dailyDataEndRow})`,
            'E13'
          )
        }
      })

      const totalSalesLetter = XLSX.utils.encode_col(summaryStartCol)
      const cumulativeLetter = XLSX.utils.encode_col(summaryStartCol + 1)
      const shareLetter = XLSX.utils.encode_col(summaryStartCol + 2)
      const stockLetter = XLSX.utils.encode_col(summaryStartCol + 3)

      setCellFormula(
        dailySheet,
        `${totalSalesLetter}${dailyTotalRow}`,
        `SUM(${totalSalesLetter}${dailyDataStartRow}:${totalSalesLetter}${dailyDataEndRow})`,
        'FF13',
        model.demandSalesQty
      )
      setCellFormula(
        dailySheet,
        `${cumulativeLetter}${dailyTotalRow}`,
        `SUM(${cumulativeLetter}${dailyDataStartRow}:${cumulativeLetter}${dailyDataEndRow})`,
        'FG13',
        model.demandSalesQty
      )
      setCellFormula(
        dailySheet,
        `${shareLetter}${dailyTotalRow}`,
        `SUM(${shareLetter}${dailyDataStartRow}:${shareLetter}${dailyDataEndRow})`,
        'FH13',
        1
      )
      setCellFormula(
        dailySheet,
        `${stockLetter}${dailyTotalRow}`,
        `SUM(${stockLetter}${dailyDataStartRow}:${stockLetter}${dailyDataEndRow})`,
        'FI13',
        model.currentStockQty
      )

      // Column widths from example template
      const fixedDailyWidths = [{ wch: 18.75 }, { wch: 5.5 }, { wch: 5.5 }]
      const monthTotalWidth = { wch: 6.5 }
      const dayWidth = { wch: 4.2 }
      const summaryWidths = [
        { wch: 8.5 },
        { wch: 8.5 },
        { wch: 9.5 },
        { wch: 8.5 },
      ]
      dailySheet['!cols'] = [
        ...fixedDailyWidths,
        ...monthLayouts.flatMap((layout) => [
          { ...monthTotalWidth },
          ...Array(layout.lastDateCol - layout.firstDateCol + 1)
            .fill(null)
            .map(() => ({ ...dayWidth })),
        ]),
        ...summaryWidths,
      ]
      dailySheet['!ref'] = `A1:${stockLetter}${dailyTotalRow}`

      // ============================================================
      // 1_발주서
      // Preserve the example formulas exactly where the source has formulas.
      // F4 is intentionally a user-editable input (default 120 days).
      // ============================================================
      const orderDataStartRow = 8
      const orderDataEndRow = orderDataStartRow + sortedSkuRows.length - 1
      const orderTotalRow = Math.max(orderDataEndRow + 1, orderDataStartRow + 1)
      const templateOrderDataRow = 8
      const templateOrderTotalRow = 15

      clearRangeValues(orderSheet, 1, Math.max(orderTotalRow, 20), 0, 12)

      setCellValue(orderSheet, 'A1', '발주서 (초안)', 'A1')
      setCellValue(orderSheet, 'A2', `[품번 : ${model.model}]`, 'A2')
      setCellValue(
        orderSheet,
        'A3',
        `[산정방식 : ${getMethodLabel(model.calculationMethod)}]`,
        'A3'
      )
      setCellValue(
        orderSheet,
        'A4',
        `[적용기간 : ${periodStart} ~ ${periodEnd} (${dates.length}일)]`,
        'A4'
      )

      setCellValue(orderSheet, 'E1', '판매수량', 'E1')
      setCellFormula(
        orderSheet,
        'F1',
        `'2_일자별판매'!${cumulativeLetter}${dailyTotalRow}`,
        'F1',
        model.demandSalesQty
      )
      setCellValue(orderSheet, 'E2', '판매일수', 'E2')
      setCellValue(orderSheet, 'F2', dates.length, 'F2')
      setCellValue(orderSheet, 'E3', '일판매', 'E3')
      setCellFormula(
        orderSheet,
        'F3',
        'IFERROR(F1/F2,0)',
        'F3',
        dates.length > 0 ? model.demandSalesQty / dates.length : 0
      )
      setCellValue(orderSheet, 'E4', '예상 판매일수', 'E4')
      setCellValue(orderSheet, 'F4', 120, 'F4')
      setCellValue(orderSheet, 'E5', '예상 판매수량', 'E5')
      setCellFormula(
        orderSheet,
        'F5',
        'F4*F3',
        'F5',
        dates.length > 0 ? (model.demandSalesQty / dates.length) * 120 : 0
      )

      setCellValue(orderSheet, 'H1', '목표수요', 'H1')
      // Keep the source example formula linkage as-is.
      setCellFormula(orderSheet, 'I1', `H${orderTotalRow}`, 'I1')
      setCellValue(orderSheet, 'H2', '발주수량', 'H2')
      setCellFormula(orderSheet, 'I2', `I${orderTotalRow}`, 'I2')

      const orderHeaders = [
        '품번',
        '칼라',
        'SIZE',
        '기간판매수량\n(순판매)',
        '비율(전체)',
        '현재고',
        '목표수요\n(예상수요)',
        '수량체크\n(목표수요-현재고)',
        '발주수량',
        '모델판단',
        '긴급도',
        '발주비율',
        '비율차이',
      ]
      orderHeaders.forEach((header, index) => {
        setCellValue(
          orderSheet,
          XLSX.utils.encode_cell({ r: 6, c: index }),
          header,
          XLSX.utils.encode_cell({ r: 6, c: index })
        )
      })

      sortedSkuRows.forEach((row, index) => {
        const excelRow = orderDataStartRow + index
        copyRowStyles(
          orderSheet,
          templateOrderDataRow,
          excelRow,
          0,
          12
        )

        setCellValue(orderSheet, `A${excelRow}`, model.model, 'A8')
        setCellValue(orderSheet, `B${excelRow}`, row.colorCode, 'B8')
        setCellValue(orderSheet, `C${excelRow}`, row.size, 'C8')
        setCellValue(
          orderSheet,
          `D${excelRow}`,
          row.periodNetSalesQty,
          'D8'
        )
        setCellValue(
          orderSheet,
          `E${excelRow}`,
          model.demandSalesQty > 0
            ? row.periodNetSalesQty / model.demandSalesQty
            : 0,
          'E8'
        )
        setCellValue(
          orderSheet,
          `F${excelRow}`,
          row.currentStockQty,
          'F8'
        )
        setCellFormula(
          orderSheet,
          `G${excelRow}`,
          `INT(F$5*E${excelRow})`,
          'G8'
        )
        setCellFormula(
          orderSheet,
          `H${excelRow}`,
          `G${excelRow}-F${excelRow}`,
          'H8'
        )
        setCellValue(
          orderSheet,
          `I${excelRow}`,
          row.recommendedQty,
          'I8'
        )
        setCellValue(
          orderSheet,
          `J${excelRow}`,
          model.decision,
          'J8'
        )
        setCellValue(
          orderSheet,
          `K${excelRow}`,
          model.urgency,
          'K8'
        )
        setCellFormula(
          orderSheet,
          `L${excelRow}`,
          `IFERROR(I${excelRow}/I$${orderTotalRow},0)`,
          'L8'
        )
        setCellFormula(
          orderSheet,
          `M${excelRow}`,
          `L${excelRow}-E${excelRow}`,
          'M8'
        )
      })

      copyRowStyles(
        orderSheet,
        templateOrderTotalRow,
        orderTotalRow,
        0,
        12
      )
      setCellValue(orderSheet, `A${orderTotalRow}`, '총    계', 'A15')
      setCellFormula(
        orderSheet,
        `D${orderTotalRow}`,
        `SUM(D${orderDataStartRow}:D${orderDataEndRow})`,
        'D15',
        model.demandSalesQty
      )
      setCellFormula(
        orderSheet,
        `E${orderTotalRow}`,
        `SUM(E${orderDataStartRow}:E${orderDataEndRow})`,
        'E15',
        1
      )
      setCellFormula(
        orderSheet,
        `F${orderTotalRow}`,
        `SUM(F${orderDataStartRow}:F${orderDataEndRow})`,
        'F15',
        model.currentStockQty
      )
      setCellFormula(
        orderSheet,
        `G${orderTotalRow}`,
        `SUM(G${orderDataStartRow}:G${orderDataEndRow})`,
        'G15'
      )
      setCellFormula(
        orderSheet,
        `H${orderTotalRow}`,
        `SUM(H${orderDataStartRow}:H${orderDataEndRow})`,
        'H15'
      )
      setCellFormula(
        orderSheet,
        `I${orderTotalRow}`,
        `SUM(I${orderDataStartRow}:I${orderDataEndRow})`,
        'I15',
        model.recommendedReorderQty
      )
      setCellFormula(
        orderSheet,
        `L${orderTotalRow}`,
        `SUM(L${orderDataStartRow}:L${orderDataEndRow})`,
        'L15',
        1
      )
      setCellFormula(
        orderSheet,
        `M${orderTotalRow}`,
        `IFERROR(AVERAGE(M${orderDataStartRow}:M${orderDataEndRow}),0)`,
        'M15'
      )

      orderSheet['!cols'] = [
        { wch: 18.75 },
        { wch: 5.5 },
        { wch: 5.5 },
        { wch: 22.5 },
        { wch: 15 },
        { wch: 7.5 },
        { wch: 11.625 },
        { wch: 15 },
        { wch: 9.5 },
        { wch: 12.75 },
        { wch: 7.5 },
        { wch: 10.75 },
        { wch: 10.25 },
      ]
      orderSheet['!autofilter'] = {
        ref: `A7:M${Math.max(orderDataEndRow, 7)}`,
      }
      orderSheet['!ref'] = `A1:M${orderTotalRow}`

      XLSX.writeFile(
        workbook,
        getSafeFileName(`발주서_${model.model}_초안_${getToday()}.xlsm`),
        {
          bookType: 'xlsm',
          bookVBA: true,
          cellStyles: true,
        }
      )
    } catch (error: any) {
      console.error(error)
      window.alert(
        `모델 상세 엑셀 다운로드에 실패했습니다.\n\n${
          error?.message || '알 수 없는 오류'
        }`
      )
    } finally {
      setExporting(false)
    }
  }
  function downloadValidationTemplate() {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        모델명: 'A40TK301J4',
        상품명: '남녀 베이직 반집업 니트',
        검증유형: '기간검증',
        기준시작월: '2025-08',
        기준종료월: '2026-03',
        비고: '',
      },
      {
        모델명: 'A40TK307M1',
        상품명: '여성 케이블 봄 가디건',
        검증유형: '예외',
        기준시작월: '2026-04',
        기준종료월: '2026-05',
        비고: '검증 통계 제외 사유 입력',
      },
      {
        모델명: 'A40TK151J4',
        상품명: '남녀 꽈배기 라운드 니트',
        검증유형: '비교제외',
        기준시작월: '',
        기준종료월: '',
        비고: '기간 검증 대상이 아닌 경우',
      },
    ])
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 32 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 36 },
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '검증양식')
    XLSX.writeFile(workbook, '시즌수요_검증업로드_양식.xlsx')
  }

  async function handleValidationFile(file: File) {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<ValidationUploadRow>(sheet, {
        defval: '',
      })

      const references: DemandReferenceRow[] = []
      const errors: string[] = []

      rawRows.forEach((raw, index) => {
        const model = String(raw.모델명 || '').trim().toUpperCase()
        if (!model) return

        const type = String(raw.검증유형 || '기간검증').trim()
        const productName = String(raw.상품명 || '').trim()
        const note = String(raw.비고 || '').trim()
        const startMonth = normalizeMonthInput(raw.기준시작월)
        const endMonth = normalizeMonthInput(raw.기준종료월)

        if (type === '기간검증') {
          if (!startMonth || !endMonth || startMonth > endMonth) {
            errors.push(`${index + 2}행 ${model}: 기준시작월/종료월 확인 필요`)
            return
          }
          references.push({
            model,
            productName,
            kind: 'period',
            startMonth,
            endMonth,
            sourceLabel: `${startMonth}~${endMonth}`,
            validationNote: note || undefined,
          })
          return
        }

        if (type === '예외') {
          references.push({
            model,
            productName,
            kind: startMonth && endMonth ? 'period' : 'no_data',
            startMonth,
            endMonth,
            sourceLabel:
              startMonth && endMonth ? `${startMonth}~${endMonth}` : '예외',
            excludeFromValidation: true,
            validationNote: note || '사용자 지정 예외',
          })
          return
        }

        if (type === '비교제외') {
          references.push({
            model,
            productName,
            kind: 'normalized_8m',
            startMonth: '',
            endMonth: '',
            sourceLabel: '비교제외',
            validationNote: note || undefined,
          })
          return
        }

        errors.push(`${index + 2}행 ${model}: 검증유형은 기간검증/비교제외/예외만 사용`)
      })

      if (errors.length > 0) {
        window.alert(`검증 파일을 확인해 주세요.\\n\\n${errors.slice(0, 10).join('\\n')}`)
        return
      }
      if (references.length === 0) {
        window.alert('검증 가능한 데이터가 없습니다.')
        return
      }

      setValidationReferences(references)
      setValidationFileName(file.name)
      setValidationOpen(true)
    } catch (error: any) {
      console.error(error)
      window.alert(`검증 파일을 읽지 못했습니다.\\n\\n${error?.message || '알 수 없는 오류'}`)
    } finally {
      if (validationFileInputRef.current) validationFileInputRef.current.value = ''
    }
  }

  function applyManualPeriod(modelName: string, startMonth: string, endMonth: string) {
    if (!sourceState) return

    const recalculated = buildDemandRecommendations(
      sourceState.salesRows,
      sourceState.claimRows,
      sourceState.stockRows,
      {
        startDate: sourceState.startDate,
        endDate: sourceState.endDate,
        manualPeriods: {
          [modelName]: { startMonth, endMonth },
        },
      }
    )

    const nextModel = recalculated.find((row) => row.model === modelName)
    if (!nextModel) return

    setModels((current) =>
      current.map((row) => (row.model === modelName ? nextModel : row))
    )
  }

  function handleMonthSelection(modelName: string, month: string) {
    const current = periodSelections[modelName]

    if (!current || current.endMonth) {
      setPeriodSelections((value) => ({
        ...value,
        [modelName]: { startMonth: month },
      }))
      return
    }

    const startMonth = month < current.startMonth ? month : current.startMonth
    const endMonth = month < current.startMonth ? current.startMonth : month

    setPeriodSelections((value) => ({
      ...value,
      [modelName]: { startMonth, endMonth },
    }))
    applyManualPeriod(modelName, startMonth, endMonth)
  }

  function restoreAutomaticPeriod(modelName: string) {
    const automatic = automaticModelMap.get(modelName)
    if (!automatic) return

    setModels((current) =>
      current.map((row) => (row.model === modelName ? automatic : row))
    )
    setPeriodSelections((current) => {
      const next = { ...current }
      delete next[modelName]
      return next
    })
  }

  async function loadRecommendations() {
    setLoading(true)
    setErrorMessage('')

    try {
      const endDate = getToday()
      const startDate = getDateMonthsAgo(DEMAND_ANALYSIS_MONTHS - 1)

      const [salesRows, claimRows, allStockRows] = await Promise.all([
        fetchAllRows<DemandSalesRow>(
          'ops_sales_daily_all',
          'order_date, sku, qty',
          'order_date',
          startDate,
          endDate
        ),
        fetchAllRows<DemandClaimRow>(
          'ops_claims_daily',
          'claim_date, sku, qty',
          'claim_date',
          startDate,
          endDate
        ),
        fetchAllRows<DemandStockRow>(
          'ops_stock_snapshot',
          'snapshot_date, sku, qty',
          'snapshot_date'
        ),
      ])

      const latestStockDate = getLatestDate(
        allStockRows,
        (row) => row.snapshot_date
      )
      const stockRows = latestStockDate
        ? allStockRows.filter(
            (row) =>
              String(row.snapshot_date).slice(0, 10) === latestStockDate
          )
        : allStockRows

      const result = buildDemandRecommendations(
        salesRows,
        claimRows,
        stockRows,
        {
          startDate,
          endDate,
        }
      )

      setModels(result)
      setAutomaticModels(result)
      setSourceState({ salesRows, claimRows, stockRows, startDate, endDate })
      setPeriodSelections({})
      setCurrentPage(1)
      setSelectedModel('')
      setDataDates({
        sales: getLatestDate(salesRows, (row) => row.order_date),
        claim: getLatestDate(claimRows, (row) => row.claim_date),
        stock: latestStockDate,
      })
    } catch (error: any) {
      console.error(error)
      setModels([])
      setSelectedModel('')
      setErrorMessage(
        `시즌수요 발주추천 데이터를 불러오지 못했습니다: ${
          error?.message || '알 수 없는 오류'
        }`
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function movePage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return
    setCurrentPage(nextPage)
    setSelectedModel('')
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gray-700" />
              <h2 className="font-semibold text-gray-900">자동 시즌구간 분석</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              최근 {DEMAND_ANALYSIS_MONTHS}개월 월별 순판매량을 분석합니다.
              전체 순판매가 {formatNumber(DEMAND_LOW_VOLUME_TOTAL_QTY)}장 미만인
              모델은 소량/비정형으로 분리하고, 나머지는 로컬 Peak를 중심으로
              시작 {Math.round(DEMAND_SEASON_START_RATIO * 100)}% / 종료{' '}
              {Math.round(DEMAND_SEASON_END_RATIO * 100)}% 기준의 시즌 후보를
              탐색합니다. 최근 시즌이 최대 시즌 판매량의{' '}
              {Math.round(DEMAND_RECENT_SEASON_RATIO * 100)}% 이상이면 최근 시즌을
              우선하며, 대표 시즌은 최대 {DEMAND_MAX_SEASON_MONTHS}개월입니다.
              권장발주는 산정판매량에 {Math.round(DEMAND_SAFETY_RATE * 100)}%
              여유를 반영합니다.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => void loadRecommendations()}
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            다시 계산
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="rounded-full bg-gray-100 px-3 py-1.5">
            출고 기준 {dataDates.sales || '-'}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1.5">
            클레임 기준 {dataDates.claim || '-'}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1.5">
            재고 기준 {dataDates.stock || '-'}
          </span>
        </div>
      </section>

      {errorMessage && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs text-gray-500">분석 모델</p>
          <p className="mt-1 text-2xl font-bold">{formatNumber(filteredModels.length)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs text-gray-500">재발주 모델</p>
          <p className="mt-1 text-2xl font-bold">{formatNumber(totals.reorderCount)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs text-gray-500">산정판매량 합계</p>
          <p className="mt-1 text-2xl font-bold">{formatNumber(totals.demandSalesQty)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs text-gray-500">권장발주 합계</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {formatNumber(totals.recommendedQty)}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border bg-white">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">검증 보기</h2>
            <p className="mt-1 text-xs text-gray-500">
              필요할 때만 기준 발주서의 시즌기간을 업로드해 자동선정 결과와 비교합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadValidationTemplate}>
              <Download className="mr-2 h-4 w-4" />
              검증 양식 다운로드
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => validationFileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              검증 파일 업로드
            </Button>
            <input
              ref={validationFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleValidationFile(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setValidationReferences(REORDER_DEMAND_REFERENCE)
                setValidationFileName('기본 검증자료')
                setValidationOpen(true)
              }}
            >
              기본자료
            </Button>
            <Button type="button" size="sm" onClick={() => setValidationOpen((value) => !value)}>
              {validationOpen ? '검증 닫기' : '검증 보기'}
            </Button>
          </div>
        </div>
      </section>

      {validationOpen && (
      <section className="rounded-2xl border bg-white">
        <div className="border-b p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">검증 자료 비교</h2>
              <p className="mt-1 text-xs text-gray-500">
                {validationFileName} 기준으로 자동선정 기간을 비교합니다. 판매수량과 발주수량은 비교하지 않습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-green-100 px-3 py-1.5 font-semibold text-green-700">
                완전일치 {validationTotals.exact}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1.5 font-semibold text-amber-700">
                ±1개월 {validationTotals.within1}
              </span>
              <span className="rounded-full bg-cyan-100 px-3 py-1.5 font-semibold text-cyan-700">
                저판매 경계 {validationTotals.boundaryLow}
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1.5 font-semibold text-red-700">
                실제 경계오차 {validationTotals.different}
              </span>
              <span className="rounded-full bg-purple-100 px-3 py-1.5 font-semibold text-purple-700">
                다른 시즌 {validationTotals.seasonShift}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1.5 font-semibold text-gray-600">
                자동구간 없음 {validationTotals.missing}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1.5 font-semibold text-blue-700">
                예외 {validationTotals.exception}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">시작월 방향</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              늦음 {validationDiagnostics.startLate} · 빠름 {validationDiagnostics.startEarly} · 일치 {validationDiagnostics.startExact}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">종료월 방향</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              늦음 {validationDiagnostics.endLate} · 빠름 {validationDiagnostics.endEarly} · 일치 {validationDiagnostics.endExact}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">평균 월 차이</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              시작 {validationDiagnostics.avgStartDiff >= 0 ? '+' : ''}{validationDiagnostics.avgStartDiff.toFixed(1)}개월 · 종료 {validationDiagnostics.avgEndDiff >= 0 ? '+' : ''}{validationDiagnostics.avgEndDiff.toFixed(1)}개월
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">평균 절대 오차</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              시작 {validationDiagnostics.avgAbsStartDiff.toFixed(1)}개월 · 종료 {validationDiagnostics.avgAbsEndDiff.toFixed(1)}개월
            </p>
          </div>
        </div>

        <div className="max-h-[500px] overflow-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-3 text-left">모델</th>
                <th className="px-3 py-3 text-left">상품명</th>
                <th className="px-3 py-3 text-left">기존 기준</th>
                <th className="px-3 py-3 text-left">자동선정</th>
                <th className="px-3 py-3 text-center">시작 차이</th>
                <th className="px-3 py-3 text-center">종료 차이</th>
                <th className="px-3 py-3 text-center">중심 차이</th>
                <th className="px-3 py-3 text-center">검증</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {validationRows.map(({ reference, model, status, startDiff, endDiff, centerDiff }) => (
                <tr
                  key={reference.model}
                  className={
                    status === 'exception'
                      ? 'bg-blue-50/50'
                      : status === 'season_shift'
                        ? 'bg-purple-50/50'
                      : status === 'different'
                        ? 'bg-red-50/40'
                        : status === 'boundary_low'
                          ? 'bg-cyan-50/40'
                          : ''
                  }
                >
                  <td className="px-3 py-2.5 font-semibold text-gray-900">{reference.model}</td>
                  <td className="px-3 py-2.5 text-gray-600">{reference.productName}</td>
                  <td className="px-3 py-2.5 text-gray-700">
                    <div>{reference.sourceLabel}</div>
                    {reference.validationNote ? (
                      <div className="mt-1 text-[11px] text-blue-600">{reference.validationNote}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-700">
                    {model?.demandStartMonth && model?.demandEndMonth ? (
                      <div>
                        <div>{`${formatMonth(model.demandStartMonth)}~${formatMonth(model.demandEndMonth)}`}</div>
                        {hasRampUpAtSelectedStart(model) ? (
                          <div className="mt-1 text-[11px] font-medium text-indigo-600">램프업 포함</div>
                        ) : null}
                      </div>
                    ) : model ? (
                      getMethodLabel(model.calculationMethod)
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-center font-semibold ${
                    startDiff === null
                      ? 'text-gray-400'
                      : Math.abs(startDiff) >= 2
                        ? 'text-red-600'
                        : startDiff === 0
                          ? 'text-green-600'
                          : 'text-amber-600'
                  }`}>
                    {startDiff === null ? '-' : `${startDiff > 0 ? '+' : ''}${startDiff}`}
                  </td>
                  <td className={`px-3 py-2.5 text-center font-semibold ${
                    endDiff === null
                      ? 'text-gray-400'
                      : Math.abs(endDiff) >= 2
                        ? 'text-red-600'
                        : endDiff === 0
                          ? 'text-green-600'
                          : 'text-amber-600'
                  }`}>
                    {endDiff === null ? '-' : `${endDiff > 0 ? '+' : ''}${endDiff}`}
                  </td>
                  <td className={`px-3 py-2.5 text-center font-semibold ${
                    centerDiff === null
                      ? 'text-gray-400'
                      : Math.abs(centerDiff) >= 4
                        ? 'text-purple-600'
                        : Math.abs(centerDiff) >= 2
                          ? 'text-red-600'
                          : centerDiff === 0
                            ? 'text-green-600'
                            : 'text-amber-600'
                  }`}>
                    {centerDiff === null
                      ? '-'
                      : `${centerDiff > 0 ? '+' : ''}${centerDiff.toFixed(1)}`}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getValidationClass(status)}`}>
                      {getValidationLabel(status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t px-4 py-3 text-xs text-gray-500">
          비교대상 {validationTotals.comparable}개 · 예외 {validationTotals.exception}개 · 기준일치(완전일치+±1개월) {validationTotals.exact + validationTotals.within1}개 · 차이가 나는 경계월의 순판매가 모두 max(5장, 해당 모델 월 Peak의 5%) 이하이면 '저판매 경계차이'로 분리합니다. 시즌 중심 차이가 4개월 이상이면 '다른 시즌 선택'입니다. 자동선정 기간은 참고 기준이며 사용자가 시즌/오프라인 정보에 따라 보완 수정할 수 있습니다.
        </div>
      </section>

      )}

      <section className="rounded-2xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">모델별 추천</h2>
            <p className="mt-1 text-xs text-gray-500">
              순판매량 = 출고수량 - 클레임수량
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => void exportRecommendationList()}
              disabled={exporting || filteredModels.length === 0}
              className="shrink-0"
            >
              <Download className="mr-2 h-4 w-4" />
              발주추천 엑셀
            </Button>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setCurrentPage(1)
                  setSelectedModel('')
                }}
                placeholder="모델명 또는 SKU 검색"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-3 text-left">모델</th>
                <th className="px-3 py-3 text-left">산정방식</th>
                <th className="px-3 py-3 text-left">적용 구간</th>
                <th className="px-3 py-3 text-right">산정판매량</th>
                <th className="px-3 py-3 text-right">현재고</th>
                <th className="px-3 py-3 text-right">재고커버율</th>
                <th className="px-3 py-3 text-right">최소발주</th>
                <th className="px-3 py-3 text-right">권장발주</th>
                <th className="px-3 py-3 text-center">판단</th>
                <th className="px-3 py-3 text-center">긴급도</th>
                <th className="px-3 py-3 text-center">엑셀</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagedModels.map((row) => {
                const isOpen = selectedModel === row.model
                const imageUrl = imageUrls[normalizeModelName(row.model)] || ''

                return (
                  <Fragment key={row.model}>
                    <tr
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setSelectedModel(isOpen ? '' : row.model)
                      }
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-gray-50">
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageUrl}
                                alt={row.model}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Database className="h-4 w-4 text-gray-300" />
                            )}
                          </div>
                          <span className="font-semibold text-gray-900">
                            {row.model}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        {getMethodLabel(row.calculationMethod)}
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-700">
                        <div>
                          {row.demandStartMonth && row.demandEndMonth
                            ? `${formatMonth(row.demandStartMonth)}~${formatMonth(
                                row.demandEndMonth
                              )}`
                            : '-'}
                        </div>
                        {periodSelections[row.model]?.endMonth && (
                          <div className="mt-1 text-[11px] font-normal text-blue-600">
                            사용자 선택
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatNumber(row.demandSalesQty)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatNumber(row.currentStockQty)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatRate(row.stockCoverageRate)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatNumber(row.minimumReorderQty)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-red-600">
                        {formatNumber(row.recommendedReorderQty)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getDecisionClass(
                            row.decision
                          )}`}
                        >
                          {row.decision}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getUrgencyClass(
                            row.urgency
                          )}`}
                        >
                          {row.urgency}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={exporting}
                          onClick={(event) => {
                            event.stopPropagation()
                            void exportModelRecommendation(row)
                          }}
                          aria-label={`${row.model} 엑셀 다운로드`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr key={`${row.model}-detail`}>
                        <td colSpan={12} className="bg-gray-50 p-4">
                          <div className="grid gap-4 xl:grid-cols-2">
                            <div className="rounded-xl border bg-white p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <h3 className="font-semibold text-gray-900">
                                    월별 순판매 흐름
                                  </h3>
                                  <p className="mt-1 text-xs text-gray-500">
                                    시작월과 종료월을 차례로 선택하면 해당 기간 기준으로 결과를 즉시 재계산합니다.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={!periodSelections[row.model]}
                                  onClick={() => restoreAutomaticPeriod(row.model)}
                                >
                                  자동선정 복원
                                </Button>
                              </div>

                              {(() => {
                                const draft = periodSelections[row.model]
                                const automatic = automaticModelMap.get(row.model)
                                return (
                                  <>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                      <span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700">
                                        자동 {automatic?.demandStartMonth && automatic?.demandEndMonth
                                          ? `${formatMonth(automatic.demandStartMonth)}~${formatMonth(automatic.demandEndMonth)}`
                                          : '-'}
                                      </span>
                                      {draft && (
                                        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
                                          선택 {formatMonth(draft.startMonth)}~{draft.endMonth ? formatMonth(draft.endMonth) : '종료월 선택'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                                      {row.monthlyRows.map((month) => {
                                        const isAutomatic = Boolean(
                                          automatic?.demandStartMonth &&
                                          automatic?.demandEndMonth &&
                                          month.month >= automatic.demandStartMonth &&
                                          month.month <= automatic.demandEndMonth
                                        )
                                        const isManual = Boolean(
                                          draft?.startMonth &&
                                          (draft.endMonth
                                            ? month.month >= draft.startMonth && month.month <= draft.endMonth
                                            : month.month === draft.startMonth)
                                        )
                                        const isBoundary = Boolean(
                                          draft &&
                                          (month.month === draft.startMonth || month.month === draft.endMonth)
                                        )

                                        return (
                                          <button
                                            type="button"
                                            key={month.month}
                                            onClick={() => handleMonthSelection(row.model, month.month)}
                                            className={`rounded-lg border p-2 text-center transition hover:border-blue-300 hover:bg-blue-50 ${
                                              isManual
                                                ? isBoundary
                                                  ? 'border-blue-500 bg-blue-100 ring-1 ring-blue-400'
                                                  : 'border-blue-200 bg-blue-50'
                                                : isAutomatic
                                                  ? 'border-red-200 bg-red-50'
                                                  : 'bg-white'
                                            }`}
                                          >
                                            <p className="text-[11px] text-gray-500">
                                              {formatMonth(month.month)}
                                            </p>
                                            <p className="mt-1 font-semibold">
                                              {formatNumber(month.netSalesQty)}
                                            </p>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </>
                                )
                              })()}

                              {row.candidates.length > 0 && (
                                <div className="mt-4 border-t pt-3">
                                  <p className="text-xs font-semibold text-gray-600">
                                    시즌구간 후보
                                  </p>
                                  <div className="mt-2 space-y-1 text-xs text-gray-500">
                                    {row.candidates.map((candidate, index) => (
                                      <p key={`${candidate.startMonth}-${candidate.endMonth}`}>
                                        {index + 1}. {formatMonth(candidate.startMonth)}~
                                        {formatMonth(candidate.endMonth)} ·{' '}
                                        {formatNumber(candidate.totalNetSalesQty)}장 · Peak{' '}
                                        {formatMonth(candidate.peakMonth)}{' '}
                                        {formatNumber(candidate.peakQty)}장
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="rounded-xl border bg-white p-4">
                              <h3 className="font-semibold text-gray-900">
                                SKU별 추천
                              </h3>
                              <div className="mt-3 max-h-[420px] overflow-auto">
                                <table className="w-full min-w-[680px] text-xs">
                                  <thead className="sticky top-0 bg-gray-50 text-gray-500">
                                    <tr>
                                      <th className="px-2 py-2 text-left">SKU</th>
                                      <th className="px-2 py-2 text-right">순판매</th>
                                      <th className="px-2 py-2 text-right">비중</th>
                                      <th className="px-2 py-2 text-right">현재고</th>
                                      <th className="px-2 py-2 text-right">목표수요</th>
                                      <th className="px-2 py-2 text-right">추천</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {row.skuRows.map((skuRow) => (
                                      <tr key={skuRow.sku}>
                                        <td className="px-2 py-2 font-medium">
                                          {skuRow.sku}
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                          {formatNumber(skuRow.periodNetSalesQty)}
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                          {formatRate(skuRow.salesShare * 100)}
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                          {formatNumber(skuRow.currentStockQty)}
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                          {formatNumber(skuRow.targetDemandQty)}
                                        </td>
                                        <td className="px-2 py-2 text-right font-bold text-red-600">
                                          {formatNumber(skuRow.recommendedQty)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}

              {!loading && pagedModels.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center text-gray-400">
                    표시할 모델이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t p-4">
          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={movePage}
          />
        </div>
      </section>
    </div>
  )
}
