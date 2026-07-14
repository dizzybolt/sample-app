'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  calcAverageOrderAmount,
  calcGrowthRate,
  fetchOpsSalesRowsByRange,
  getPeriodRange,
  getPreviousPeriodRange,
  sumSalesAmount,
  sumSalesQty,
  type OpsSalesRow,
  type SalesPeriodType,
  applyRocketSupplyAmount,
} from '@/lib/ops/sales'
import { createClient } from '@/lib/supabase/client'
import {
  excludeGiftSalesRows,
  type GiftModel,
} from '@/lib/ops/gifts'
import { fetchAllRocketSkuPrices } from '@/lib/ops/rocket'
import {
  buildNetSalesSummary,
  excludeGiftClaimRows,
  fetchOpsClaimRowsByRange,
  getCancelRows,
  getModelFromSku,
  getReturnRows,
  sumClaimAmount,
  sumClaimQty,
  type NetSalesSummaryRow,
  type OpsClaimRow,
} from '@/lib/ops/claims'

const supabase = createClient()

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('ko-KR')
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

type SortKey =
  | 'netQty'
  | 'netAmount'
  | 'avgNetAmount'
  | 'returnQty'
  | 'cancelQty'

export function SalesStatsManager() {
  const defaultRange = getPeriodRange('week')

  const [periodType, setPeriodType] = useState<SalesPeriodType>('week')
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [keyword, setKeyword] = useState('')
  const [shop, setShop] = useState('ALL')
  const [shopOptions, setShopOptions] = useState<string[]>([])

  const [rows, setRows] = useState<OpsSalesRow[]>([])
  const [prevRows, setPrevRows] = useState<OpsSalesRow[]>([])

  const [claimRows, setClaimRows] = useState<OpsClaimRow[]>([])
  const [prevClaimRows, setPrevClaimRows] = useState<OpsClaimRow[]>([])

  const [loading, setLoading] = useState(false)

  const [dateSortKey, setDateSortKey] =
    useState<SortKey>('netQty')

  const [shopSortKey, setShopSortKey] =
    useState<SortKey>('netQty')

  const [modelSortKey, setModelSortKey] =
    useState<SortKey>('netQty')

  const [skuSortKey, setSkuSortKey] =
    useState<SortKey>('netQty')

  const [rocketAmount, setRocketAmount] = useState(0)
  const [rocketQty, setRocketQty] = useState(0)

  async function loadData() {
    setLoading(true)

    try {
      const previousRange = getPreviousPeriodRange(
        startDate,
        endDate
      )

      const [
        currentData,
        previousData,
        currentClaims,
        previousClaims,
        rocketPrices,
        giftModelRes,
      ] = await Promise.all([
        fetchOpsSalesRowsByRange({
          startDate,
          endDate,
          keyword,
          shop,
        }),

        fetchOpsSalesRowsByRange({
          startDate: previousRange.startDate,
          endDate: previousRange.endDate,
          keyword,
          shop,
        }),

        fetchOpsClaimRowsByRange({
          startDate,
          endDate,
          keyword,
          shop,
        }),

        fetchOpsClaimRowsByRange({
          startDate: previousRange.startDate,
          endDate: previousRange.endDate,
          keyword,
          shop,
        }),

        fetchAllRocketSkuPrices(),

        supabase
          .from('ops_gift_models')
          .select(
            'id, model_name, gift_name, is_active, note, created_at, updated_at'
          )
          .eq('is_active', true),
      ])

      if (giftModelRes.error) {
        throw giftModelRes.error
      }

      const giftModels =
        (giftModelRes.data || []) as GiftModel[]

      const giftModelSet = new Set(
        giftModels.map((item) =>
          item.model_name.trim().toUpperCase()
        )
      )

      const currentAdjusted = applyRocketSupplyAmount(
        currentData,
        rocketPrices
      )

      const previousAdjusted = applyRocketSupplyAmount(
        previousData,
        rocketPrices
      )

      const currentSalesRows = excludeGiftSalesRows(
        currentAdjusted.rows,
        giftModels
      )

      const previousSalesRows = excludeGiftSalesRows(
        previousAdjusted.rows,
        giftModels
      )

      const currentClaimRows = excludeGiftClaimRows(
        currentClaims,
        giftModelSet
      )

      const previousClaimRows = excludeGiftClaimRows(
        previousClaims,
        giftModelSet
      )

      setRows(currentSalesRows)
      setPrevRows(previousSalesRows)

      setClaimRows(currentClaimRows)
      setPrevClaimRows(previousClaimRows)

      /*
      * 쿠팡로켓 원본 금액이 0원이었고,
      * 로켓 매입가가 실제 적용된 행만 계산
      */
      const originalRowMap = new Map(
        currentData.map((row) => [row.id, row])
      )

      const adjustedRocketRows = currentSalesRows.filter((row) => {
        const originalRow = originalRowMap.get(row.id)

        return (
          String(row.shop || '').trim() === '쿠팡로켓' &&
          Number(originalRow?.amount || 0) === 0 &&
          Number(row.amount || 0) !== 0
        )
      })

      const appliedRocketAmount = adjustedRocketRows.reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0
      )

      const appliedRocketQty = adjustedRocketRows.reduce(
        (sum, row) => sum + Number(row.qty || 0),
        0
      )

      setRocketAmount(appliedRocketAmount)
      setRocketQty(appliedRocketQty)
    } catch (error: any) {
      alert(`주문통계 조회 실패\n\n${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function fetchShopOptions() {
    const { data, error } = await supabase.rpc('get_ops_sales_shops')

    if (error) {
      console.error('쇼핑몰 목록 조회 실패:', error)
      setShopOptions([])
      return
    }

    const options = (data || [])
      .map((item: { shop: string | null }) => String(item.shop || '').trim())
      .filter(Boolean)

    setShopOptions(options)
  }

  useEffect(() => {
    loadData()
    fetchShopOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyPeriod(type: SalesPeriodType) {
    const range = getPeriodRange(type)

    setPeriodType(type)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }

  function sortSummaryRows(
    summaryRows: NetSalesSummaryRow[],
    sortKey: SortKey
  ) {
    return [...summaryRows].sort((a, b) => {
      return (
        Number(b[sortKey] || 0) -
        Number(a[sortKey] || 0)
      )
    })
  }

  const currentQty = sumSalesQty(rows)
  const currentAmount = sumSalesAmount(rows)
  const currentAvg = calcAverageOrderAmount(rows)

  const prevQty = sumSalesQty(prevRows)
  const prevAmount = sumSalesAmount(prevRows)
  const prevAvg = calcAverageOrderAmount(prevRows)

  const cancelRows = useMemo(
    () => getCancelRows(claimRows),
    [claimRows]
  )

  const returnRows = useMemo(
    () => getReturnRows(claimRows),
    [claimRows]
  )

  const prevCancelRows = useMemo(
    () => getCancelRows(prevClaimRows),
    [prevClaimRows]
  )

  const prevReturnRows = useMemo(
    () => getReturnRows(prevClaimRows),
    [prevClaimRows]
  )

  const cancelQty = sumClaimQty(cancelRows)
  const cancelAmount = sumClaimAmount(cancelRows)

  const returnQty = sumClaimQty(returnRows)
  const returnAmount = sumClaimAmount(returnRows)

  const prevCancelQty = sumClaimQty(prevCancelRows)
  const prevCancelAmount = sumClaimAmount(prevCancelRows)

  const prevReturnQty = sumClaimQty(prevReturnRows)
  const prevReturnAmount = sumClaimAmount(prevReturnRows)

  const netQty =
    currentQty - cancelQty - returnQty

  const netAmount =
    currentAmount - cancelAmount - returnAmount

  const prevNetQty =
    prevQty - prevCancelQty - prevReturnQty

  const prevNetAmount =
    prevAmount - prevCancelAmount - prevReturnAmount

  const cancelAvg =
    cancelQty > 0 ? cancelAmount / cancelQty : 0

  const returnAvg =
    returnQty > 0 ? returnAmount / returnQty : 0

  const netAvg =
    netQty > 0 ? netAmount / netQty : 0

  const prevNetAvg =
    prevNetQty > 0 ? prevNetAmount / prevNetQty : 0

  const qtyGrowth = calcGrowthRate(currentQty, prevQty)
  const amountGrowth = calcGrowthRate(currentAmount, prevAmount)
  const avgGrowth = calcGrowthRate(currentAvg, prevAvg)

  const netQtyGrowth = calcGrowthRate(
    netQty,
    prevNetQty
  )

  const netAmountGrowth = calcGrowthRate(
    netAmount,
    prevNetAmount
  )

  const netAvgGrowth = calcGrowthRate(
    netAvg,
    prevNetAvg
  )

  const dateRows = useMemo(
    () =>
      sortSummaryRows(
        buildNetSalesSummary(
          rows,
          claimRows,
          (row) => row.order_date,
          (row) => row.claim_date
        ),
        dateSortKey
      ),
    [rows, claimRows, dateSortKey]
  )

  const shopRows = useMemo(
    () =>
      sortSummaryRows(
        buildNetSalesSummary(
          rows,
          claimRows,
          (row) => String(row.shop || '-'),
          (row) => String(row.shop || '-')
        ),
        shopSortKey
      ),
    [rows, claimRows, shopSortKey]
  )

  const modelTop = useMemo(
    () =>
      sortSummaryRows(
        buildNetSalesSummary(
          rows,
          claimRows,
          (row) => getModelFromSku(row.sku),
          (row) => getModelFromSku(row.sku)
        ),
        modelSortKey
      ).slice(0, 20),
    [rows, claimRows, modelSortKey]
  )

  const skuTop = useMemo(
    () =>
      sortSummaryRows(
        buildNetSalesSummary(
          rows,
          claimRows,
          (row) => String(row.sku || '-'),
          (row) => String(row.sku || '-')
        ),
        skuSortKey
      ).slice(0, 20),
    [rows, claimRows, skuSortKey]
  )

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">조회 조건</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <div>
            <label className="text-xs text-gray-500">기간</label>
            <select
              value={periodType}
              onChange={(e) => applyPeriod(e.target.value as SalesPeriodType)}
              className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="week">이번주</option>
              <option value="month">이번달</option>
              <option value="quarter">이번분기</option>
              <option value="year">올해</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500">쇼핑몰</label>

            <select
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="ALL">전체 쇼핑몰</option>

              {shopOptions.map((shopName) => (
                <option key={shopName} value={shopName}>
                  {shopName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">SKU / 모델명</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="A40..."
              className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="h-10 w-full rounded-md bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          조회 기준: {startDate} ~ {endDate}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailStatCard
          title="주문수량"
          mainLabel="주문수량"
          mainValue={`${formatNumber(currentQty)}개`}
          rows={[
            {
              label: '반품수량',
              value: `${formatNumber(returnQty)}개`,
            },
            {
              label: '취소수량',
              value: `${formatNumber(cancelQty)}개`,
            },
            {
              label: '순출고수량',
              value: `${formatNumber(netQty)}개`,
              emphasize: true,
            },
          ]}
          footer={`이전기간 대비 ${formatPercent(netQtyGrowth)}`}
          growth={netQtyGrowth}
        />

        <DetailStatCard
          title="주문금액"
          mainLabel="주문금액"
          mainValue={`${formatNumber(currentAmount)}원`}
          rows={[
            {
              label: '반품금액',
              value: `${formatNumber(returnAmount)}원`,
            },
            {
              label: '취소금액',
              value: `${formatNumber(cancelAmount)}원`,
            },
            {
              label: '순매출금액',
              value: `${formatNumber(netAmount)}원`,
              emphasize: true,
            },
          ]}
          footer={`이전기간 대비 ${formatPercent(netAmountGrowth)}`}
          growth={netAmountGrowth}
        />

        <DetailStatCard
          title="평균 주문금액"
          mainLabel="주문금액 평균"
          mainValue={`${formatNumber(Math.round(currentAvg))}원`}
          rows={[
            {
              label: '반품금액 평균',
              value: `${formatNumber(Math.round(returnAvg))}원`,
            },
            {
              label: '취소금액 평균',
              value: `${formatNumber(Math.round(cancelAvg))}원`,
            },
            {
              label: '순매출금액 평균',
              value: `${formatNumber(Math.round(netAvg))}원`,
              emphasize: true,
            },
          ]}
          footer={`이전기간 대비 ${formatPercent(netAvgGrowth)}`}
          growth={netAvgGrowth}
        />

        <DetailStatCard
          title="쿠팡로켓"
          mainLabel="적용 매입가"
          mainValue={`${formatNumber(rocketAmount)}원`}
          rows={[
            {
              label: '적용 수량',
              value: `${formatNumber(rocketQty)}개`,
              emphasize: true,
            },
          ]}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SummaryTable
          title="일자별 순매출"
          sortKey={dateSortKey}
          onSortKeyChange={setDateSortKey}
          headers={[
            '일자',
            '순출고수량',
            '순매출금액',
            '평균 순판매가',
          ]}
          rows={dateRows.map((item) => [
            item.label,
            formatNumber(item.netQty),
            formatNumber(item.netAmount),
            formatNumber(Math.round(item.avgNetAmount)),
          ])}
        />

        <SummaryTable
          title="쇼핑몰별 순매출"
          sortKey={shopSortKey}
          onSortKeyChange={setShopSortKey}
          headers={[
            '쇼핑몰',
            '순출고수량',
            '순매출금액',
            '평균 순판매가',
          ]}
          rows={shopRows.map((item) => [
            item.label,
            formatNumber(item.netQty),
            formatNumber(item.netAmount),
            formatNumber(Math.round(item.avgNetAmount)),
          ])}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SummaryTable
          title="모델별 TOP 20"
          sortKey={modelSortKey}
          onSortKeyChange={setModelSortKey}
          headers={[
            '모델명',
            '주문수량',
            '반품수량',
            '취소수량',
            '순출고수량',
            '순매출금액',
            '평균 순판매가',
          ]}
          rows={modelTop.map((item) => [
            item.label,
            formatNumber(item.orderQty),
            formatNumber(item.returnQty),
            formatNumber(item.cancelQty),
            formatNumber(item.netQty),
            formatNumber(item.netAmount),
            formatNumber(Math.round(item.avgNetAmount)),
          ])}
        />

        <SummaryTable
          title="SKU별 TOP 20"
          sortKey={skuSortKey}
          onSortKeyChange={setSkuSortKey}
          headers={[
            'SKU',
            '주문수량',
            '반품수량',
            '취소수량',
            '순출고수량',
            '순매출금액',
            '평균 순판매가',
          ]}
          rows={skuTop.map((item) => [
            item.label,
            formatNumber(item.orderQty),
            formatNumber(item.returnQty),
            formatNumber(item.cancelQty),
            formatNumber(item.netQty),
            formatNumber(item.netAmount),
            formatNumber(Math.round(item.avgNetAmount)),
          ])}
        />
      </section>
    </div>
  )
}

function StatCard({
  title,
  value,
  sub,
  growth,
}: {
  title: string
  value: string
  sub?: string
  growth?: number
}) {
  const growthClass =
    growth === undefined
      ? 'text-gray-500'
      : growth > 0
        ? 'text-blue-600'
        : growth < 0
          ? 'text-red-600'
          : 'text-gray-500'

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className={`mt-2 text-xs ${growthClass}`}>{sub}</p>}
    </div>
  )
}

function DetailStatCard({
  title,
  mainLabel,
  mainValue,
  rows,
  footer,
  growth,
}: {
  title: string
  mainLabel: string
  mainValue: string
  rows: {
    label: string
    value: string
    emphasize?: boolean
  }[]
  footer?: string
  growth?: number
}) {
  const growthClass =
    growth === undefined
      ? 'text-gray-500'
      : growth > 0
        ? 'text-blue-600'
        : growth < 0
          ? 'text-red-600'
          : 'text-gray-500'

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">
        {title}
      </p>

      <div className="mt-4 border-b pb-4">
        <p className="text-xs text-gray-500">
          {mainLabel}
        </p>

        <p className="mt-1 text-2xl font-bold text-gray-900">
          {mainValue}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {rows.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span
              className={
                item.emphasize
                  ? 'font-semibold text-gray-900'
                  : 'text-gray-500'
              }
            >
              {item.label}
            </span>

            <span
              className={
                item.emphasize
                  ? 'font-bold text-gray-900'
                  : 'font-medium text-gray-700'
              }
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {footer && (
        <p className={`mt-4 text-xs ${growthClass}`}>
          {footer}
        </p>
      )}
    </div>
  )
}

function SummaryTable({
  title,
  headers,
  rows,
  sortKey,
  onSortKeyChange,
}: {
  title: string
  headers: string[]
  rows: string[][]
  sortKey: SortKey
  onSortKeyChange: (key: SortKey) => void

}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">{title}</h2>

        <select
          value={sortKey}
          onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
          className="h-8 rounded-md border px-2 text-xs"
        >
          <option value="netQty">순출고수량순</option>
          <option value="netAmount">순매출금액순</option>
          <option value="avgNetAmount">평균 순판매가순</option>
          <option value="returnQty">반품수량순</option>
          <option value="cancelQty">취소수량순</option>
        </select>
      </div>
      <div className="mt-4 max-h-[520px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-gray-50">
              {headers.map((header, index) => (
                <th
                  key={header}
                  className={`p-3 ${index === 0 ? 'text-left' : 'text-right'}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="p-6 text-center text-gray-500">
                  표시할 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`p-3 ${
                        cellIndex === 0 ? 'text-left font-medium' : 'text-right'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}