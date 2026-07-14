'use client'

import * as XLSX from 'xlsx'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getPeriodRange,
  type SalesPeriodType,
} from '@/lib/ops/sales'

type ClaimRow = {
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

type ClaimSummaryRow = {
  key: string
  label: string

  totalQty: number
  totalAmount: number

  cancelQty: number
  cancelAmount: number

  returnQty: number
  returnAmount: number

  processingQty: number
  processingAmount: number
}

type SummarySortKey =
  | 'totalQty'
  | 'totalAmount'
  | 'cancelQty'
  | 'cancelAmount'
  | 'returnQty'
  | 'returnAmount'

const PAGE_SIZE = 1000

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('ko-KR')
}

function normalizeText(value?: string | null) {
  return String(value || '').trim()
}

function normalizeUpper(value?: string | null) {
  return normalizeText(value).toUpperCase()
}

function getModelFromSku(sku?: string | null) {
  return normalizeUpper(String(sku || '').split('_')[0])
}

function isCancelCompleted(status?: string | null) {
  return normalizeText(status).includes('취소완료')
}

function isReturnCompleted(status?: string | null) {
  return normalizeText(status).includes('반품완료')
}

function isCompletedClaim(row: ClaimRow) {
  return (
    isCancelCompleted(row.order_status) ||
    isReturnCompleted(row.order_status)
  )
}

function getClaimStatusGroup(row: ClaimRow) {
  if (isCancelCompleted(row.order_status)) return '취소완료'
  if (isReturnCompleted(row.order_status)) return '반품완료'
  return '처리중'
}

function summarizeClaims(
  rows: ClaimRow[],
  getKey: (row: ClaimRow) => string,
  getLabel?: (row: ClaimRow) => string
) {
  const map = new Map<string, ClaimSummaryRow>()

  rows.forEach((row) => {
    const key = getKey(row) || '-'
    const label = getLabel ? getLabel(row) || key : key

    const previous = map.get(key) || {
      key,
      label,

      totalQty: 0,
      totalAmount: 0,

      cancelQty: 0,
      cancelAmount: 0,

      returnQty: 0,
      returnAmount: 0,

      processingQty: 0,
      processingAmount: 0,
    }

    const qty = Number(row.qty || 0)
    const amount = Number(row.order_amount || 0)

    previous.totalQty += qty
    previous.totalAmount += amount

    if (isCancelCompleted(row.order_status)) {
      previous.cancelQty += qty
      previous.cancelAmount += amount
    } else if (isReturnCompleted(row.order_status)) {
      previous.returnQty += qty
      previous.returnAmount += amount
    } else {
      previous.processingQty += qty
      previous.processingAmount += amount
    }

    map.set(key, previous)
  })

  return Array.from(map.values())
}

function sortSummaryRows(
  rows: ClaimSummaryRow[],
  sortKey: SummarySortKey
) {
  return [...rows].sort(
    (a, b) => Number(b[sortKey] || 0) - Number(a[sortKey] || 0)
  )
}

export function ClaimsManager() {
  const supabase = createClient()

  const defaultRange = getPeriodRange('month')

  const [periodType, setPeriodType] =
    useState<SalesPeriodType>('month')

  const [startDate, setStartDate] =
    useState(defaultRange.startDate)

  const [endDate, setEndDate] =
    useState(defaultRange.endDate)

  const [shop, setShop] = useState('ALL')
  const [claimType, setClaimType] = useState('ALL')
  const [orderStatus, setOrderStatus] = useState('ALL')
  const [reason, setReason] = useState('ALL')
  const [keyword, setKeyword] = useState('')

  const [shopOptions, setShopOptions] = useState<string[]>([])
  const [claimTypeOptions, setClaimTypeOptions] = useState<string[]>([])
  const [statusOptions, setStatusOptions] = useState<string[]>([])
  const [reasonOptions, setReasonOptions] = useState<string[]>([])

  const [rows, setRows] = useState<ClaimRow[]>([])
  const [loading, setLoading] = useState(false)

  const [dateSortKey, setDateSortKey] =
    useState<SummarySortKey>('totalQty')

  const [shopSortKey, setShopSortKey] =
    useState<SummarySortKey>('totalQty')

  const [modelSortKey, setModelSortKey] =
    useState<SummarySortKey>('totalQty')

  const [skuSortKey, setSkuSortKey] =
    useState<SummarySortKey>('totalQty')

  const [reasonSortKey, setReasonSortKey] =
    useState<SummarySortKey>('totalQty')

  useEffect(() => {
    fetchFilterOptions()
    loadData()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyPeriod(type: SalesPeriodType) {
    const range = getPeriodRange(type)

    setPeriodType(type)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }

  async function fetchDistinctColumn(
    column:
      | 'shop'
      | 'claim_type'
      | 'order_status'
      | 'reason'
  ) {
    const values: string[] = []

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('ops_claims_daily')
        .select(column)
        .order(column, { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        console.error(`${column} 목록 조회 실패:`, error)
        return []
      }

      if (!data || data.length === 0) break

      data.forEach((item: Record<string, unknown>) => {
        const value = normalizeText(item[column] as string | null)

        if (value) values.push(value)
      })

      if (data.length < PAGE_SIZE) break
    }

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b, 'ko')
    )
  }

  async function fetchFilterOptions() {
    const [shops, claimTypes, statuses, reasons] =
      await Promise.all([
        fetchDistinctColumn('shop'),
        fetchDistinctColumn('claim_type'),
        fetchDistinctColumn('order_status'),
        fetchDistinctColumn('reason'),
      ])

    setShopOptions(shops)
    setClaimTypeOptions(claimTypes)
    setStatusOptions(statuses)
    setReasonOptions(reasons)
  }

  async function loadData() {
    if (!startDate || !endDate) {
      alert('시작일과 종료일을 입력해 주세요.')
      return
    }

    if (startDate > endDate) {
      alert('시작일은 종료일보다 늦을 수 없습니다.')
      return
    }

    setLoading(true)

    try {
      const allRows: ClaimRow[] = []

      for (let from = 0; ; from += PAGE_SIZE) {
        let query = supabase
          .from('ops_claims_daily')
          .select('*')
          .gte('claim_date', startDate)
          .lte('claim_date', endDate)
          .order('claim_date', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)

        if (shop !== 'ALL') {
          query = query.eq('shop', shop)
        }

        if (claimType !== 'ALL') {
          query = query.eq('claim_type', claimType)
        }

        if (orderStatus !== 'ALL') {
          query = query.eq('order_status', orderStatus)
        }

        if (reason !== 'ALL') {
          query = query.eq('reason', reason)
        }

        const { data, error } = await query

        if (error) throw error

        if (!data || data.length === 0) break

        allRows.push(...(data as ClaimRow[]))

        if (data.length < PAGE_SIZE) break
      }

      const normalizedKeyword = normalizeUpper(keyword)

      const filteredRows = normalizedKeyword
        ? allRows.filter((row) => {
            const sku = normalizeUpper(row.sku)
            const model = getModelFromSku(row.sku)
            const modelNo = normalizeUpper(row.model_no)
            const singleNo = normalizeUpper(row.single_no)
            const message = normalizeUpper(row.logistics_message)

            return (
              sku.includes(normalizedKeyword) ||
              model.includes(normalizedKeyword) ||
              modelNo.includes(normalizedKeyword) ||
              singleNo.includes(normalizedKeyword) ||
              message.includes(normalizedKeyword)
            )
          })
        : allRows

      setRows(filteredRows)
    } catch (error: any) {
      alert(`클레임 통계 조회 실패\n\n${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const totalQty = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + Number(row.qty || 0),
        0
      ),
    [rows]
  )

  const totalAmount = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + Number(row.order_amount || 0),
        0
      ),
    [rows]
  )

  const cancelRows = useMemo(
    () => rows.filter((row) => isCancelCompleted(row.order_status)),
    [rows]
  )

  const returnRows = useMemo(
    () => rows.filter((row) => isReturnCompleted(row.order_status)),
    [rows]
  )

  const processingRows = useMemo(
    () => rows.filter((row) => !isCompletedClaim(row)),
    [rows]
  )

  const cancelQty = useMemo(
    () =>
      cancelRows.reduce(
        (sum, row) => sum + Number(row.qty || 0),
        0
      ),
    [cancelRows]
  )

  const cancelAmount = useMemo(
    () =>
      cancelRows.reduce(
        (sum, row) => sum + Number(row.order_amount || 0),
        0
      ),
    [cancelRows]
  )

  const returnQty = useMemo(
    () =>
      returnRows.reduce(
        (sum, row) => sum + Number(row.qty || 0),
        0
      ),
    [returnRows]
  )

  const returnAmount = useMemo(
    () =>
      returnRows.reduce(
        (sum, row) => sum + Number(row.order_amount || 0),
        0
      ),
    [returnRows]
  )

  const processingQty = useMemo(
    () =>
      processingRows.reduce(
        (sum, row) => sum + Number(row.qty || 0),
        0
      ),
    [processingRows]
  )

  const dateRows = useMemo(
    () =>
      sortSummaryRows(
        summarizeClaims(rows, (row) => row.claim_date),
        dateSortKey
      ),
    [rows, dateSortKey]
  )

  const shopRows = useMemo(
    () =>
      sortSummaryRows(
        summarizeClaims(
          rows,
          (row) => normalizeText(row.shop) || '-'
        ),
        shopSortKey
      ),
    [rows, shopSortKey]
  )

  const modelRows = useMemo(
    () =>
      sortSummaryRows(
        summarizeClaims(
          rows,
          (row) => getModelFromSku(row.sku)
        ),
        modelSortKey
      ).slice(0, 20),
    [rows, modelSortKey]
  )

  const skuRows = useMemo(
    () =>
      sortSummaryRows(
        summarizeClaims(
          rows,
          (row) => normalizeUpper(row.sku)
        ),
        skuSortKey
      ).slice(0, 20),
    [rows, skuSortKey]
  )

  const reasonRows = useMemo(
    () =>
      sortSummaryRows(
        summarizeClaims(
          rows,
          (row) => normalizeText(row.reason) || '사유 없음'
        ),
        reasonSortKey
      ),
    [rows, reasonSortKey]
  )

  function downloadExcel() {
    const exportRows = rows.map((row, index) => ({
      NO: index + 1,
      클레임일자: row.claim_date,
      쇼핑몰: row.shop || '',
      출고지: row.warehouse || '',
      모델번호: row.model_no || '',
      단품번호: row.single_no || '',
      SKU: row.sku,
      모델명: getModelFromSku(row.sku),
      수량: row.qty,
      주문금액: row.order_amount,
      클레임구분: row.claim_type || '',
      처리상태: row.order_status || '',
      상태분류: getClaimStatusGroup(row),
      사유: row.reason || '',
      물류메시지: row.logistics_message || '',
      접수일: row.received_at || '',
      완료일: row.completed_at || '',
      원본파일: row.source_file || '',
      원본월: row.source_month || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      '클레임통계'
    )

    XLSX.writeFile(
      workbook,
      `클레임통계_${startDate}_${endDate}.xlsx`
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">조회 조건</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Field label="기간">
            <select
              value={periodType}
              onChange={(event) =>
                applyPeriod(event.target.value as SalesPeriodType)
              }
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="week">이번주</option>
              <option value="month">이번달</option>
              <option value="quarter">이번분기</option>
              <option value="year">올해</option>
            </select>
          </Field>

          <Field label="시작일">
            <Input
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(event.target.value)
              }
            />
          </Field>

          <Field label="종료일">
            <Input
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(event.target.value)
              }
            />
          </Field>

          <Field label="쇼핑몰">
            <select
              value={shop}
              onChange={(event) =>
                setShop(event.target.value)
              }
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="ALL">전체 쇼핑몰</option>

              {shopOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="클레임 구분">
            <select
              value={claimType}
              onChange={(event) =>
                setClaimType(event.target.value)
              }
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="ALL">전체 구분</option>

              {claimTypeOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="처리 상태">
            <select
              value={orderStatus}
              onChange={(event) =>
                setOrderStatus(event.target.value)
              }
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="ALL">전체 상태</option>

              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="사유">
            <select
              value={reason}
              onChange={(event) =>
                setReason(event.target.value)
              }
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="ALL">전체 사유</option>

              {reasonOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              onClick={loadData}
              disabled={loading}
            >
              {loading ? '조회 중...' : '조회'}
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <Field label="SKU / 모델명 / 물류메시지 검색">
            <Input
              value={keyword}
              onChange={(event) =>
                setKeyword(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  loadData()
                }
              }}
              placeholder="SKU 또는 모델명 입력"
            />
          </Field>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          조회 기준: {startDate} ~ {endDate}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="전체 클레임"
          value={`${formatNumber(totalQty)}개`}
          sub={`${formatNumber(totalAmount)}원`}
        />

        <SummaryCard
          title="취소완료"
          value={`${formatNumber(cancelQty)}개`}
          sub={`${formatNumber(cancelAmount)}원`}
        />

        <SummaryCard
          title="반품완료"
          value={`${formatNumber(returnQty)}개`}
          sub={`${formatNumber(returnAmount)}원`}
        />

        <SummaryCard
          title="처리 중"
          value={`${formatNumber(processingQty)}개`}
          sub={`${formatNumber(processingRows.length)}행`}
        />

        <SummaryCard
          title="조회 데이터"
          value={`${formatNumber(rows.length)}행`}
          sub="조건에 맞는 원본 클레임"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ClaimSummaryTable
          title="일자별 클레임"
          labelHeader="일자"
          rows={dateRows}
          sortKey={dateSortKey}
          onSortKeyChange={setDateSortKey}
        />

        <ClaimSummaryTable
          title="쇼핑몰별 클레임"
          labelHeader="쇼핑몰"
          rows={shopRows}
          sortKey={shopSortKey}
          onSortKeyChange={setShopSortKey}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ClaimSummaryTable
          title="모델별 TOP 20"
          labelHeader="모델명"
          rows={modelRows}
          sortKey={modelSortKey}
          onSortKeyChange={setModelSortKey}
        />

        <ClaimSummaryTable
          title="SKU별 TOP 20"
          labelHeader="SKU"
          rows={skuRows}
          sortKey={skuSortKey}
          onSortKeyChange={setSkuSortKey}
        />
      </section>

      <ClaimSummaryTable
        title="사유별 클레임"
        labelHeader="사유"
        rows={reasonRows}
        sortKey={reasonSortKey}
        onSortKeyChange={setReasonSortKey}
      />

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              클레임 상세 목록
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              총 {rows.length.toLocaleString()}행
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={downloadExcel}
          >
            엑셀 다운로드
          </Button>
        </div>

        <div className="mt-4 max-h-[680px] overflow-auto">
          <table className="w-full min-w-[1800px] border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-center">NO</th>
                <th className="p-3 text-center">클레임일자</th>
                <th className="p-3 text-left">쇼핑몰</th>
                <th className="p-3 text-left">출고지</th>
                <th className="p-3 text-left">모델명</th>
                <th className="p-3 text-left">SKU</th>
                <th className="p-3 text-right">수량</th>
                <th className="p-3 text-right">금액</th>
                <th className="p-3 text-left">클레임구분</th>
                <th className="p-3 text-left">처리상태</th>
                <th className="p-3 text-left">사유</th>
                <th className="p-3 text-left">물류메시지</th>
                <th className="p-3 text-center">접수일</th>
                <th className="p-3 text-center">완료일</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    className="p-6 text-center text-gray-500"
                  >
                    조회된 클레임 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="border-b last:border-0"
                  >
                    <td className="p-3 text-center">
                      {index + 1}
                    </td>

                    <td className="p-3 text-center">
                      {row.claim_date}
                    </td>

                    <td className="p-3 text-left">
                      {row.shop || '-'}
                    </td>

                    <td className="p-3 text-left">
                      {row.warehouse || '-'}
                    </td>

                    <td className="p-3 text-left font-medium">
                      {getModelFromSku(row.sku)}
                    </td>

                    <td className="p-3 text-left">
                      {row.sku}
                    </td>

                    <td className="p-3 text-right font-semibold">
                      {formatNumber(row.qty)}
                    </td>

                    <td className="p-3 text-right">
                      {formatNumber(row.order_amount)}
                    </td>

                    <td className="p-3 text-left">
                      {row.claim_type || '-'}
                    </td>

                    <td className="p-3 text-left">
                      {row.order_status || '-'}
                    </td>

                    <td className="p-3 text-left">
                      {row.reason || '-'}
                    </td>

                    <td className="max-w-[340px] p-3 text-left">
                      <p className="line-clamp-2">
                        {row.logistics_message || '-'}
                      </p>
                    </td>

                    <td className="p-3 text-center">
                      {row.received_at?.slice(0, 16) || '-'}
                    </td>

                    <td className="p-3 text-center">
                      {row.completed_at?.slice(0, 16) || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">
        {label}
      </span>

      <div className="mt-1">
        {children}
      </div>
    </label>
  )
}

function SummaryCard({
  title,
  value,
  sub,
}: {
  title: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value}
      </p>

      {sub && (
        <p className="mt-2 text-xs text-gray-500">
          {sub}
        </p>
      )}
    </div>
  )
}

function ClaimSummaryTable({
  title,
  labelHeader,
  rows,
  sortKey,
  onSortKeyChange,
}: {
  title: string
  labelHeader: string
  rows: ClaimSummaryRow[]
  sortKey: SummarySortKey
  onSortKeyChange: (value: SummarySortKey) => void
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">
          {title}
        </h2>

        <select
          value={sortKey}
          onChange={(event) =>
            onSortKeyChange(
              event.target.value as SummarySortKey
            )
          }
          className="h-8 rounded-md border px-2 text-xs"
        >
          <option value="totalQty">전체 수량순</option>
          <option value="totalAmount">전체 금액순</option>
          <option value="cancelQty">취소 수량순</option>
          <option value="cancelAmount">취소 금액순</option>
          <option value="returnQty">반품 수량순</option>
          <option value="returnAmount">반품 금액순</option>
        </select>
      </div>

      <div className="mt-4 max-h-[520px] overflow-auto">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-gray-50">
              <th className="p-3 text-left">
                {labelHeader}
              </th>
              <th className="p-3 text-right">전체수량</th>
              <th className="p-3 text-right">전체금액</th>
              <th className="p-3 text-right">취소수량</th>
              <th className="p-3 text-right">취소금액</th>
              <th className="p-3 text-right">반품수량</th>
              <th className="p-3 text-right">반품금액</th>
              <th className="p-3 text-right">처리중수량</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-6 text-center text-gray-500"
                >
                  표시할 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b last:border-0"
                >
                  <td className="p-3 text-left font-medium">
                    {row.label}
                  </td>
                  <td className="p-3 text-right">
                    {formatNumber(row.totalQty)}
                  </td>
                  <td className="p-3 text-right">
                    {formatNumber(row.totalAmount)}
                  </td>
                  <td className="p-3 text-right">
                    {formatNumber(row.cancelQty)}
                  </td>
                  <td className="p-3 text-right">
                    {formatNumber(row.cancelAmount)}
                  </td>
                  <td className="p-3 text-right">
                    {formatNumber(row.returnQty)}
                  </td>
                  <td className="p-3 text-right">
                    {formatNumber(row.returnAmount)}
                  </td>
                  <td className="p-3 text-right">
                    {formatNumber(row.processingQty)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}