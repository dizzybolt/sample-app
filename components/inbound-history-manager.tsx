'use client'

import { useEffect, useMemo, useState } from 'react'
import { Database, RefreshCw, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getCurrentMonthRange,
  getDefaultInboundRange,
  normalizeInboundKeyword,
  sortInboundOptionValues,
  type InboundFilterOptions,
  type InboundFilters,
  type OpsInboundRow,
} from '@/lib/ops/inbound'

const TABLE_NAME = 'ops_inbound_history'
const PAGE_SIZE = 50
const FETCH_CHUNK_SIZE = 1000

type SyncLog = {
  status: string
  success_count: number | null
  fail_count: number | null
  finished_at: string | null
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('ko-KR')
}

function formatDate(value?: string | null) {
  if (!value) return '-'

  const [year, month, day] = value.split('-')

  if (!year || !month || !day) return value

  return `${year}.${month}.${day}`
}

function formatDateTime(value?: string | null) {
  if (!value) return '동기화 기록 없음'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function getSyncStatusClass(status?: string | null) {
  if (status === 'success') return 'text-emerald-600'
  if (status === 'partial') return 'text-amber-600'
  if (!status) return 'text-gray-400'
  return 'text-red-600'
}

function getSyncStatusText(status?: string | null) {
  if (status === 'success') return '정상'
  if (status === 'partial') return '일부 실패'
  if (!status) return '기록 없음'
  return status
}

function applyFilters(query: any, filters: InboundFilters) {
  let nextQuery = query

  if (filters.startDate) {
    nextQuery = nextQuery.gte('inbound_date', filters.startDate)
  }

  if (filters.endDate) {
    nextQuery = nextQuery.lte('inbound_date', filters.endDate)
  }

  const keyword = normalizeInboundKeyword(filters.keyword)

  if (keyword) {
    nextQuery = nextQuery.or(
      `sku.ilike.%${keyword}%,korea_code.ilike.%${keyword}%,china_code.ilike.%${keyword}%`
    )
  }

  if (filters.colorCode !== 'ALL') {
    nextQuery = nextQuery.eq('color_code', filters.colorCode)
  }

  if (filters.size !== 'ALL') {
    nextQuery = nextQuery.eq('size', filters.size)
  }

  if (filters.warehouse !== 'ALL') {
    nextQuery = nextQuery.eq('warehouse', filters.warehouse)
  }

  return nextQuery
}

export function InboundHistoryManager() {
  const supabase = useMemo(() => createClient(), [])
  const defaultRange = useMemo(() => getDefaultInboundRange(), [])

  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [keyword, setKeyword] = useState('')
  const [colorCode, setColorCode] = useState('ALL')
  const [size, setSize] = useState('ALL')
  const [warehouse, setWarehouse] = useState('ALL')

  const [options, setOptions] = useState<InboundFilterOptions>({
    colorCodes: [],
    sizes: [],
    warehouses: [],
  })

  const [rows, setRows] = useState<OpsInboundRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalQty, setTotalQty] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [lastSync, setLastSync] = useState<SyncLog | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  function currentFilters(): InboundFilters {
    return {
      startDate,
      endDate,
      keyword,
      colorCode,
      size,
      warehouse,
    }
  }

  async function fetchFilterOptions() {
    const colorCodes: string[] = []
    const sizes: string[] = []
    const warehouses: string[] = []

    for (let from = 0; ; from += FETCH_CHUNK_SIZE) {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('color_code, size, warehouse')
        .range(from, from + FETCH_CHUNK_SIZE - 1)

      if (error) throw error
      if (!data || data.length === 0) break

      data.forEach((item) => {
        const nextColorCode = String(item.color_code || '').trim()
        const nextSize = String(item.size || '').trim()
        const nextWarehouse = String(item.warehouse || '').trim()

        if (nextColorCode) colorCodes.push(nextColorCode)
        if (nextSize) sizes.push(nextSize)
        if (nextWarehouse) warehouses.push(nextWarehouse)
      })

      if (data.length < FETCH_CHUNK_SIZE) break
    }

    setOptions({
      colorCodes: sortInboundOptionValues(colorCodes),
      sizes: sortInboundOptionValues(sizes),
      warehouses: sortInboundOptionValues(warehouses),
    })
  }

  async function fetchLastSync() {
    const { data, error } = await supabase
      .from('ops_sync_logs')
      .select('status, success_count, fail_count, finished_at')
      .eq('sync_type', 'inbound_history')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('입고 동기화 기록 조회 실패:', error)
      return
    }

    setLastSync((data || null) as SyncLog | null)
  }

  async function fetchTotalQty(filters: InboundFilters) {
    let sum = 0

    for (let from = 0; ; from += FETCH_CHUNK_SIZE) {
      let query = supabase
        .from(TABLE_NAME)
        .select('inbound_qty')
        .range(from, from + FETCH_CHUNK_SIZE - 1)

      query = applyFilters(query, filters)

      const { data, error } = await query

      if (error) throw error
      if (!data || data.length === 0) break

      sum += data.reduce(
        (total, item) => total + Number(item.inbound_qty || 0),
        0
      )

      if (data.length < FETCH_CHUNK_SIZE) break
    }

    return sum
  }

  async function loadData(
    page = 1,
    filters: InboundFilters = currentFilters()
  ) {
    if (!filters.startDate || !filters.endDate) {
      setErrorMessage('조회 시작일과 종료일을 입력해 주세요.')
      return
    }

    if (filters.startDate > filters.endDate) {
      setErrorMessage('조회 시작일은 종료일보다 늦을 수 없습니다.')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const from = (page - 1) * PAGE_SIZE

      let pageQuery = supabase
        .from(TABLE_NAME)
        .select('*', { count: 'exact' })
        .order('inbound_date', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      pageQuery = applyFilters(pageQuery, filters)

      const [pageResult, nextTotalQty] = await Promise.all([
        pageQuery,
        fetchTotalQty(filters),
      ])

      if (pageResult.error) throw pageResult.error

      setRows((pageResult.data || []) as OpsInboundRow[])
      setTotalCount(pageResult.count || 0)
      setTotalQty(nextTotalQty)
      setCurrentPage(page)
    } catch (error: any) {
      console.error(error)
      setRows([])
      setTotalCount(0)
      setTotalQty(0)
      setErrorMessage(
        `입고이력 조회에 실패했습니다: ${error?.message || '알 수 없는 오류'}`
      )
    } finally {
      setLoading(false)
    }
  }

  function applyRecent30Days() {
    const range = getDefaultInboundRange()
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }

  function applyCurrentMonth() {
    const range = getCurrentMonthRange()
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }

  function resetFilters() {
    const range = getDefaultInboundRange()
    const resetValues: InboundFilters = {
      startDate: range.startDate,
      endDate: range.endDate,
      keyword: '',
      colorCode: 'ALL',
      size: 'ALL',
      warehouse: 'ALL',
    }

    setStartDate(resetValues.startDate)
    setEndDate(resetValues.endDate)
    setKeyword('')
    setColorCode('ALL')
    setSize('ALL')
    setWarehouse('ALL')

    void loadData(1, resetValues)
  }

  function movePage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages || loading) return
    void loadData(nextPage)
  }

  useEffect(() => {
    async function initialize() {
      try {
        await Promise.all([
          fetchFilterOptions(),
          fetchLastSync(),
          loadData(1),
        ])
      } catch (error: any) {
        console.error(error)
        setErrorMessage(
          `입고이력 초기화에 실패했습니다: ${error?.message || '알 수 없는 오류'}`
        )
      }
    }

    void initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <label className="space-y-1 text-xs font-medium text-gray-600">
              시작일
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>

            <label className="space-y-1 text-xs font-medium text-gray-600">
              종료일
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>

            <label className="space-y-1 text-xs font-medium text-gray-600 sm:col-span-2">
              품번 검색
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void loadData(1)
                }}
                placeholder="SKU, 한국품번, 중국품번"
              />
            </label>

            <label className="space-y-1 text-xs font-medium text-gray-600">
              색상코드
              <select
                value={colorCode}
                onChange={(event) => setColorCode(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="ALL">전체</option>
                {options.colorCodes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs font-medium text-gray-600">
              사이즈
              <select
                value={size}
                onChange={(event) => setSize(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="ALL">전체</option>
                {options.sizes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs font-medium text-gray-600">
              입고위치
              <select
                value={warehouse}
                onChange={(event) => setWarehouse(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="ALL">전체</option>
                {options.warehouses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyRecent30Days}
            >
              최근 30일
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyCurrentMonth}
            >
              이번달
            </Button>
            <Button
              type="button"
              onClick={() => void loadData(1)}
              disabled={loading}
            >
              <Search className="h-4 w-4" />
              조회
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={resetFilters}
              disabled={loading}
            >
              <X className="h-4 w-4" />
              초기화
            </Button>
          </div>
        </div>
      </section>

      {errorMessage && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">조회 건수</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatNumber(totalCount)}건
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">총 입고수량</p>
          <p className="mt-2 text-2xl font-bold text-blue-700">
            {formatNumber(totalQty)}개
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <Database className="h-4 w-4" />
              최근 입고 동기화
            </p>

            <button
              type="button"
              onClick={() => void fetchLastSync()}
              className="text-gray-400 transition hover:text-gray-700"
              title="동기화 기록 새로고침"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2 text-sm font-semibold text-gray-900">
            {formatDateTime(lastSync?.finished_at)}
          </p>
          <p className={`mt-1 text-xs ${getSyncStatusClass(lastSync?.status)}`}>
            {getSyncStatusText(lastSync?.status)}
            {lastSync
              ? ` · 성공 ${formatNumber(lastSync.success_count)}건`
              : ''}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">입고 내역</h2>
            <p className="mt-1 text-xs text-gray-500">
              입고일 최신순 · 페이지당 {PAGE_SIZE}건
            </p>
          </div>

          <div className="flex items-center gap-2">
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600">
                <th className="p-3 text-center font-medium">NO</th>
                <th className="p-3 text-center font-medium">입고일</th>
                <th className="p-3 text-left font-medium">SKU</th>
                <th className="p-3 text-center font-medium">중국품번</th>
                <th className="p-3 text-center font-medium">한국품번</th>
                <th className="p-3 text-center font-medium">색상</th>
                <th className="p-3 text-center font-medium">사이즈</th>
                <th className="p-3 text-right font-medium">입고수량</th>
                <th className="p-3 text-center font-medium">입고위치</th>
                <th className="p-3 text-left font-medium">비고</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-gray-500">
                    입고이력을 조회하고 있습니다.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-gray-500">
                    조회 조건에 해당하는 입고이력이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 text-center text-gray-500">
                      {(currentPage - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td className="whitespace-nowrap p-3 text-center">
                      {formatDate(row.inbound_date)}
                    </td>
                    <td className="whitespace-nowrap p-3 font-medium text-gray-900">
                      {row.sku || '-'}
                    </td>
                    <td className="whitespace-nowrap p-3 text-center">
                      {row.china_code || '-'}
                    </td>
                    <td className="whitespace-nowrap p-3 text-center">
                      {row.korea_code || '-'}
                    </td>
                    <td className="whitespace-nowrap p-3 text-center">
                      {row.color_code || '-'}
                      {row.color_name ? ` · ${row.color_name}` : ''}
                    </td>
                    <td className="whitespace-nowrap p-3 text-center">
                      {row.size || '-'}
                    </td>
                    <td className="whitespace-nowrap p-3 text-right font-semibold text-blue-700">
                      {formatNumber(row.inbound_qty)}
                    </td>
                    <td className="whitespace-nowrap p-3 text-center">
                      {row.warehouse || '-'}
                    </td>
                    <td className="max-w-[320px] p-3 text-gray-600">
                      <span className="line-clamp-2" title={row.note || ''}>
                        {row.note || '-'}
                      </span>
                    </td>
                  </tr>
                ))
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
    </div>
  )
}
