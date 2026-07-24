'use client'

import * as XLSX from 'xlsx'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  RefreshCw,
  Search,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  buildReorderRecommendations,
  REORDER_DEPLETION_THRESHOLD,
  type ReorderDayBasis,
  type ReorderInboundBasis,
  type ReorderInboundRow,
  type ReorderModelSummary,
  type ReorderSalesRow,
  type ReorderStockRow,
} from '@/lib/ops/reorder'
import { getDefaultInboundRange } from '@/lib/ops/inbound'

const FETCH_CHUNK_SIZE = 1000
const MODEL_PAGE_SIZE = 30

type DataDates = {
  inbound: string
  sales: string
  stock: string
}

type DateRange = {
  column: string
  startDate?: string
  endDate?: string
}

type ReorderProductImageRow = {
  model_name: string
  image_url: string | null
}

type AppliedOptions = {
  startDate: string
  endDate: string
  description: string
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('ko-KR')
}

function formatDecimal(value: number) {
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function formatRate(value: number) {
  return `${value.toFixed(1)}%`
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${year}.${month}.${day}`
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

function getRateColor(value: number) {
  if (value >= 90) return 'bg-red-100 text-red-700'
  if (value >= 80) return 'bg-orange-100 text-orange-700'
  if (value >= REORDER_DEPLETION_THRESHOLD) {
    return 'bg-amber-100 text-amber-700'
  }
  return 'bg-gray-100 text-gray-600'
}

function getInboundBasisLabel(value: ReorderInboundBasis) {
  if (value === 'within-period') return '기간 내 입고'
  if (value === 'previous') return '기간 직전 입고'
  return '기간 직후 입고'
}

function parseExcludedDates(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((date) => date.trim())
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    )
  )
}

function normalizeModelName(value?: string | null) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

function getSafeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_')
}

export function ReorderRecommendationsManager() {
  const supabase = useMemo(() => createClient(), [])
  const defaultRange = useMemo(() => getDefaultInboundRange(), [])

  const [models, setModels] = useState<ReorderModelSummary[]>([])
  const [keyword, setKeyword] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [targetDays, setTargetDays] = useState('60')
  const [applicationRate, setApplicationRate] = useState('100')
  const [depletionThreshold, setDepletionThreshold] = useState(
    String(REORDER_DEPLETION_THRESHOLD)
  )
  const [dayBasis, setDayBasis] = useState<ReorderDayBasis>('calendar')
  const [excludedDates, setExcludedDates] = useState('')
  const [appliedOptions, setAppliedOptions] = useState<AppliedOptions>({
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    description: '',
  })
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [dataDates, setDataDates] = useState<DataDates>({
    inbound: '',
    sales: '',
    stock: '',
  })
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const filteredModels = useMemo(() => {
    const normalizedKeyword = keyword.trim().toUpperCase()
    if (!normalizedKeyword) return models

    return models.filter(
      (row) =>
        row.model.toUpperCase().includes(normalizedKeyword) ||
        row.skuRows.some((skuRow) =>
          skuRow.sku.toUpperCase().includes(normalizedKeyword)
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
  const selectedModelRow = useMemo(
    () => models.find((row) => row.model === selectedModel) || null,
    [models, selectedModel]
  )
  const totals = useMemo(
    () =>
      filteredModels.reduce(
        (result, row) => {
          result.inboundQty += row.inboundQty
          result.outboundQty += row.outboundQty
          result.currentStockQty += row.currentStockQty
          result.recommendedQty += row.recommendedQty
          return result
        },
        {
          inboundQty: 0,
          outboundQty: 0,
          currentStockQty: 0,
          recommendedQty: 0,
        }
      ),
    [filteredModels]
  )

  async function fetchAllRows<T>(
    tableName: string,
    columns: string,
    orderColumn: string,
    dateRange?: DateRange
  ) {
    const rows: T[] = []

    for (let from = 0; ; from += FETCH_CHUNK_SIZE) {
      let query = supabase
        .from(tableName)
        .select(columns)
        .order(orderColumn, { ascending: true })
        .range(from, from + FETCH_CHUNK_SIZE - 1)

      if (dateRange?.startDate) {
        query = query.gte(dateRange.column, dateRange.startDate)
      }
      if (dateRange?.endDate) {
        query = query.lte(dateRange.column, dateRange.endDate)
      }

      const { data, error } = await query
      if (error) throw error
      if (!data || data.length === 0) break

      rows.push(...(data as T[]))
      if (data.length < FETCH_CHUNK_SIZE) break
    }

    return rows
  }

  async function loadRecommendations() {
    if (!startDate || !endDate || startDate > endDate) {
      setErrorMessage('분석 시작일과 종료일을 올바르게 입력해 주세요.')
      return
    }

    const parsedTargetDays = Number(targetDays)
    const parsedApplicationRate = Number(applicationRate)
    const parsedThreshold = Number(depletionThreshold)

    if (
      parsedTargetDays <= 0 ||
      parsedApplicationRate < 0 ||
      parsedThreshold < 0
    ) {
      setErrorMessage('판매일수와 비율은 0 이상의 숫자로 입력해 주세요.')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const [inboundRows, salesRows, allStockRows, productImages] =
        await Promise.all([
        fetchAllRows<ReorderInboundRow>(
          'ops_inbound_history',
          'inbound_date, sku, korea_code, color_code, color_name, size, inbound_qty',
          'inbound_date'
        ),
        fetchAllRows<ReorderSalesRow>(
          'ops_sales_daily_all',
          'order_date, sku, qty',
          'order_date',
          {
            column: 'order_date',
            startDate,
            endDate,
          }
        ),
        fetchAllRows<ReorderStockRow>(
          'ops_stock_snapshot',
          'snapshot_date, sku, qty',
          'snapshot_date'
        ),
        fetchAllRows<ReorderProductImageRow>(
          'product_images',
          'model_name, image_url',
          'model_name'
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
      const excludedDateList = parseExcludedDates(excludedDates)
      const result = buildReorderRecommendations(
        inboundRows,
        salesRows,
        stockRows,
        {
          startDate,
          endDate,
          targetDays: parsedTargetDays,
          applicationRate: parsedApplicationRate,
          depletionThreshold: parsedThreshold,
          dayBasis,
          excludedDates: excludedDateList,
        }
      )

      setModels(result.recommendations)
      setSelectedModel('')
      setCurrentPage(1)
      setDataDates({
        inbound: getLatestDate(inboundRows, (row) => row.inbound_date),
        sales: getLatestDate(salesRows, (row) => row.order_date),
        stock: latestStockDate,
      })
      const description = `${formatDate(startDate)}~${formatDate(
        endDate
      )} · ${
          dayBasis === 'active' ? '출고 발생일 기준' : '전체 기간일 기준'
        } · 향후 ${formatNumber(parsedTargetDays)}일 · 적용률 ${formatNumber(
          parsedApplicationRate
        )}% · 소진율 ${formatNumber(parsedThreshold)}% 이상${
          excludedDateList.length
            ? ` · 제외 ${excludedDateList.length}일`
            : ''
        }`

      setAppliedOptions({
        startDate,
        endDate,
        description,
      })
      setImageUrls(
        productImages.reduce<Record<string, string>>((result, row) => {
          const modelName = normalizeModelName(row.model_name)
          if (modelName && row.image_url && !result[modelName]) {
            result[modelName] = row.image_url
          }
          return result
        }, {})
      )
    } catch (error: any) {
      console.error(error)
      setModels([])
      setSelectedModel('')
      setErrorMessage(
        `발주추천 데이터를 불러오지 못했습니다: ${
          error?.message || '알 수 없는 오류'
        }`
      )
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadRecommendations()
  }

  function movePage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return
    setCurrentPage(nextPage)
    setSelectedModel('')
  }

  async function writeImageWorkbook(
    rows: Record<string, string | number>[],
    fileName: string
  ) {
    if (rows.length === 0) {
      window.alert('다운로드할 발주추천 데이터가 없습니다.')
      return
    }

    setExporting(true)

    try {
      const templateResponse = await fetch('/excel/order-sheet-template.xlsm')

      if (!templateResponse.ok) {
        throw new Error('엑셀 이미지 템플릿을 불러오지 못했습니다.')
      }

      const templateBuffer = await templateResponse.arrayBuffer()
      const workbook = XLSX.read(templateBuffer, {
        type: 'array',
        bookVBA: true,
      })
      const worksheetName = workbook.SheetNames[0]
      const worksheet = XLSX.utils.json_to_sheet(rows)

      worksheet['!cols'] = [
        { wch: 42 },
        { wch: 16 },
        { wch: 16 },
        { wch: 24 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
      ]

      workbook.Sheets[worksheetName] = worksheet
      XLSX.writeFile(workbook, getSafeFileName(fileName), {
        bookType: 'xlsm',
      })
    } catch (error: any) {
      console.error(error)
      window.alert(
        `엑셀 다운로드에 실패했습니다.\n\n${
          error?.message || '알 수 없는 오류'
        }`
      )
    } finally {
      setExporting(false)
    }
  }

  async function exportAllModels() {
    const rows = models.map((row) => ({
      이미지URL: imageUrls[normalizeModelName(row.model)] || '',
      썸네일: '',
      모델명: row.model,
      분석조건: appliedOptions.description,
      입고기준: getInboundBasisLabel(row.inboundBasis),
      기준입고일:
        row.firstInboundDate === row.lastInboundDate
          ? row.firstInboundDate
          : `${row.firstInboundDate}~${row.lastInboundDate}`,
      판매일수: row.analysisDays,
      입고수량: row.inboundQty,
      기간출고수량: row.outboundQty,
      일판매수량: Number(row.dailyAverageQty.toFixed(1)),
      현재고: row.currentStockQty,
      소진율: Number((row.depletionRate / 100).toFixed(4)),
      예상판매수량: row.expectedSalesQty,
      추천발주수량: row.recommendedQty,
      SKU수: row.skuCount,
    }))

    await writeImageWorkbook(
      rows,
      `발주추천_전체_${appliedOptions.startDate}_${appliedOptions.endDate}.xlsm`
    )
  }

  async function exportSelectedModel() {
    if (!selectedModelRow) {
      window.alert('상세목록을 다운로드할 모델을 먼저 선택해 주세요.')
      return
    }

    const imageUrl =
      imageUrls[normalizeModelName(selectedModelRow.model)] || ''
    const rows = selectedModelRow.skuRows.map((row) => ({
      이미지URL: imageUrl,
      썸네일: '',
      모델명: selectedModelRow.model,
      SKU: row.sku,
      분석조건: appliedOptions.description,
      입고기준: getInboundBasisLabel(selectedModelRow.inboundBasis),
      색상코드: row.colorCode,
      색상명: row.colorName,
      사이즈: row.size,
      기준입고일:
        row.firstInboundDate === row.lastInboundDate
          ? row.firstInboundDate
          : `${row.firstInboundDate}~${row.lastInboundDate}`,
      최근출고일: row.lastOutboundDate,
      입고수량: row.inboundQty,
      기간출고수량: row.outboundQty,
      일판매수량: Number(row.dailyAverageQty.toFixed(1)),
      현재고: row.currentStockQty,
      소진율: Number((row.depletionRate / 100).toFixed(4)),
      예상판매수량: row.expectedSalesQty,
      추천발주수량: row.recommendedQty,
    }))

    await writeImageWorkbook(
      rows,
      `발주추천_상세_${selectedModelRow.model}_${appliedOptions.startDate}_${appliedOptions.endDate}.xlsm`
    )
  }

  useEffect(() => {
    void loadRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setCurrentPage(1)
    setSelectedModel('')
  }, [keyword])

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border bg-white p-5 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            시즌 분석 조건
          </h2>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-gray-600">
            <span>분석 시작일</span>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-xs font-medium text-gray-600">
            <span>분석 종료일</span>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-xs font-medium text-gray-600">
            <span>판매일수 계산</span>
            <select
              value={dayBasis}
              onChange={(event) =>
                setDayBasis(event.target.value as ReorderDayBasis)
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="active">출고 발생일</option>
              <option value="calendar">전체 기간일</option>
            </select>
          </label>

          <label className="space-y-1 text-xs font-medium text-gray-600">
            <span>향후 예상 판매일수</span>
            <Input
              type="number"
              min="1"
              value={targetDays}
              onChange={(event) => setTargetDays(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-xs font-medium text-gray-600">
            <span>발주 적용률 (%)</span>
            <Input
              type="number"
              min="0"
              step="1"
              value={applicationRate}
              onChange={(event) => setApplicationRate(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-xs font-medium text-gray-600">
            <span>소진율 기준 (%)</span>
            <Input
              type="number"
              min="0"
              step="1"
              value={depletionThreshold}
              onChange={(event) => setDepletionThreshold(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-xs font-medium text-gray-600 md:col-span-2">
            <span>제외일자 (행사·특판, 쉼표로 구분)</span>
            <Input
              value={excludedDates}
              onChange={(event) => setExcludedDates(event.target.value)}
              placeholder="2026-06-15, 2026-06-20"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            조건 적용
          </Button>
        </div>
      </form>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-gray-500" />
          <p className="text-sm font-semibold text-gray-900">적용 기준</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-gray-600">
          {appliedOptions.description || '조건을 적용하고 있습니다.'}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
          <span>최신 입고 데이터 {formatDate(dataDates.inbound)}</span>
          <span>기간 출고 데이터 {formatDate(dataDates.sales)}</span>
          <span>현재고 {formatDate(dataDates.stock)}</span>
        </div>
      </section>

      {errorMessage && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">추천 모델</p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {formatNumber(filteredModels.length)}개
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">기준 입고수량</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatNumber(totals.inboundQty)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">기간 출고수량</p>
          <p className="mt-2 text-2xl font-bold text-blue-700">
            {formatNumber(totals.outboundQty)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">최신 현재고</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {formatNumber(totals.currentStockQty)}
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <p className="text-xs font-medium text-red-600">추천 발주수량</p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {formatNumber(totals.recommendedQty)}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              추가 발주 필요 모델
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              모델을 선택하면 SKU별 예상 판매량과 추천수량을 확인할 수
              있습니다.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="모델명 또는 SKU 검색"
                className="pl-9"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={loading || exporting || models.length === 0}
              onClick={() => void exportAllModels()}
            >
              <Download className="h-4 w-4" />
              전체목록 엑셀
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={loading || exporting || !selectedModelRow}
              onClick={() => void exportSelectedModel()}
            >
              <Download className="h-4 w-4" />
              상세목록 엑셀
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600">
                <th className="p-3 text-center font-medium">NO</th>
                <th className="p-3 text-left font-medium">모델명</th>
                <th className="p-3 text-center font-medium">입고 기준</th>
                <th className="p-3 text-center font-medium">기준 입고일</th>
                <th className="p-3 text-center font-medium">판매일수</th>
                <th className="p-3 text-right font-medium">입고수량</th>
                <th className="p-3 text-right font-medium">기간 출고</th>
                <th className="p-3 text-right font-medium">일판매</th>
                <th className="p-3 text-right font-medium">현재고</th>
                <th className="p-3 text-center font-medium">소진율</th>
                <th className="p-3 text-right font-medium">예상 판매</th>
                <th className="p-3 text-right font-medium">추천 발주</th>
                <th className="p-3 text-center font-medium">상세</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-gray-500">
                    선택한 기간의 입고·출고·현재고를 분석하고 있습니다.
                  </td>
                </tr>
              ) : pagedModels.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-gray-500">
                    조건에 해당하는 발주추천 모델이 없습니다.
                  </td>
                </tr>
              ) : (
                pagedModels.map((row, index) => {
                  const isSelected = selectedModel === row.model
                  return (
                    <tr
                      key={row.model}
                      className={`cursor-pointer border-b transition ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() =>
                        setSelectedModel(isSelected ? '' : row.model)
                      }
                    >
                      <td className="p-3 text-center text-gray-500">
                        {(currentPage - 1) * MODEL_PAGE_SIZE + index + 1}
                      </td>
                      <td className="whitespace-nowrap p-3 font-semibold text-gray-900">
                        {row.model}
                      </td>
                      <td className="whitespace-nowrap p-3 text-center text-xs">
                        {getInboundBasisLabel(row.inboundBasis)}
                      </td>
                      <td className="whitespace-nowrap p-3 text-center">
                        {formatDate(row.firstInboundDate)}
                        {row.lastInboundDate !== row.firstInboundDate
                          ? `~${formatDate(row.lastInboundDate)}`
                          : ''}
                      </td>
                      <td className="p-3 text-center">
                        {formatNumber(row.analysisDays)}
                      </td>
                      <td className="p-3 text-right">
                        {formatNumber(row.inboundQty)}
                      </td>
                      <td className="p-3 text-right font-semibold text-blue-700">
                        {formatNumber(row.outboundQty)}
                      </td>
                      <td className="p-3 text-right">
                        {formatDecimal(row.dailyAverageQty)}
                      </td>
                      <td className="p-3 text-right font-semibold text-emerald-700">
                        {formatNumber(row.currentStockQty)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex min-w-16 justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${getRateColor(
                            row.depletionRate
                          )}`}
                        >
                          {formatRate(row.depletionRate)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {formatNumber(row.expectedSalesQty)}
                      </td>
                      <td className="p-3 text-right text-base font-bold text-red-700">
                        {formatNumber(row.recommendedQty)}
                      </td>
                      <td className="p-3 text-center">
                        {isSelected ? (
                          <ChevronUp className="mx-auto h-4 w-4" />
                        ) : (
                          <ChevronDown className="mx-auto h-4 w-4" />
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 border-t p-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage <= 1 || loading}
            onClick={() => movePage(currentPage - 1)}
          >
            이전
          </Button>
          <span className="min-w-20 text-center text-sm text-gray-500">
            {currentPage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages || loading}
            onClick={() => movePage(currentPage + 1)}
          >
            다음
          </Button>
        </div>
      </section>

      {selectedModelRow && (
        <section className="rounded-2xl border border-blue-200 bg-white shadow-sm">
          <div className="border-b border-blue-100 bg-blue-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedModelRow.model} SKU별 발주 계산
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  모델 전체가 아니라 SKU별 예상 판매량에서 SKU별 현재고를
                  차감한 뒤 합산합니다.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={exporting}
                onClick={() => void exportSelectedModel()}
              >
                <Download className="h-4 w-4" />
                선택 모델 상세 엑셀
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1260px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600">
                  <th className="p-3 text-left font-medium">SKU</th>
                  <th className="p-3 text-center font-medium">색상</th>
                  <th className="p-3 text-center font-medium">사이즈</th>
                  <th className="p-3 text-center font-medium">기준 입고일</th>
                  <th className="p-3 text-center font-medium">최근 출고일</th>
                  <th className="p-3 text-right font-medium">입고수량</th>
                  <th className="p-3 text-right font-medium">기간 출고</th>
                  <th className="p-3 text-right font-medium">일판매</th>
                  <th className="p-3 text-right font-medium">현재고</th>
                  <th className="p-3 text-center font-medium">소진율</th>
                  <th className="p-3 text-right font-medium">예상 판매</th>
                  <th className="p-3 text-right font-medium">추천 발주</th>
                </tr>
              </thead>
              <tbody>
                {selectedModelRow.skuRows.map((row) => (
                  <tr
                    key={row.sku}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap p-3 font-medium text-gray-900">
                      {row.sku}
                    </td>
                    <td className="whitespace-nowrap p-3 text-center">
                      {row.colorCode || '-'}
                      {row.colorName ? ` · ${row.colorName}` : ''}
                    </td>
                    <td className="p-3 text-center">{row.size || '-'}</td>
                    <td className="whitespace-nowrap p-3 text-center">
                      {formatDate(row.firstInboundDate)}
                      {row.lastInboundDate !== row.firstInboundDate
                        ? `~${formatDate(row.lastInboundDate)}`
                        : ''}
                    </td>
                    <td className="whitespace-nowrap p-3 text-center">
                      {formatDate(row.lastOutboundDate)}
                    </td>
                    <td className="p-3 text-right">
                      {formatNumber(row.inboundQty)}
                    </td>
                    <td className="p-3 text-right font-medium text-blue-700">
                      {formatNumber(row.outboundQty)}
                    </td>
                    <td className="p-3 text-right">
                      {formatDecimal(row.dailyAverageQty)}
                    </td>
                    <td className="p-3 text-right font-medium text-emerald-700">
                      {formatNumber(row.currentStockQty)}
                    </td>
                    <td className="p-3 text-center">
                      {formatRate(row.depletionRate)}
                    </td>
                    <td className="p-3 text-right">
                      {formatNumber(row.expectedSalesQty)}
                    </td>
                    <td className="p-3 text-right text-base font-bold text-red-700">
                      {formatNumber(row.recommendedQty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
        <p className="font-semibold">계산 기준</p>
        <p className="mt-1">
          기준 입고는 분석기간 안의 입고를 우선 사용합니다. 기간 내 입고가
          없으면 기간 시작일 이전과 종료일 이후 입고 중 기간 경계에서 더
          가까운 입고일을 사용합니다.
        </p>
        <p>
          SKU 예상 판매량 = 기간 SKU 출고수량 ÷ 판매일수 × 향후 예상
          판매일수 × 발주 적용률
        </p>
        <p>
          SKU 추천 발주수량 = MAX(SKU 예상 판매량 - 최신 SKU 현재고, 0)
          이며, 모델 추천수량은 SKU 추천수량의 합계입니다.
        </p>
      </section>
    </div>
  )
}
