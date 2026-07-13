'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  calcAverageOrderAmount,
  calcGrowthRate,
  fetchOpsSalesRowsByRange,
  getPeriodRange,
  getPreviousPeriodRange,
  groupSalesByDate,
  groupSalesByModel,
  groupSalesByShop,
  groupSalesBySku,
  sumSalesAmount,
  sumSalesQty,
  type OpsSalesRow,
  type SalesPeriodType,
  applyRocketSupplyAmount,
  type RocketSkuPriceRow,
} from '@/lib/ops/sales'
import { createClient } from '@/lib/supabase/client'
import {
  excludeGiftSalesRows,
  type GiftModel,
} from '@/lib/ops/gifts'
import { fetchAllRocketSkuPrices } from '@/lib/ops/rocket'

const supabase = createClient()

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('ko-KR')
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

type SortKey = 'qty' | 'amount' | 'avg'

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
  const [loading, setLoading] = useState(false)

  const [dateSortKey, setDateSortKey] = useState<SortKey>('qty')
  const [shopSortKey, setShopSortKey] = useState<SortKey>('qty')
  const [modelSortKey, setModelSortKey] = useState<SortKey>('qty')
  const [skuSortKey, setSkuSortKey] = useState<SortKey>('qty')

  const [rocketAmount, setRocketAmount] = useState(0)
  const [rocketCount, setRocketCount] = useState(0)  

  async function loadData() {
    setLoading(true)

    try {
      const previousRange = getPreviousPeriodRange(startDate, endDate)

      const [
        currentData,
        previousData,
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

      setRows(currentSalesRows)
      setPrevRows(previousSalesRows)

      // 쿠팡로켓 금액은 사은품 제외 후 다시 계산하는 편이 정확함
      const currentGiftModelSet = new Set(
        giftModels.map((item) =>
          item.model_name.trim().toUpperCase()
        )
      )

      const filteredRocketRows = currentAdjusted.rows.filter((row) => {
        const model = String(row.sku || '')
          .split('_')[0]
          .trim()
          .toUpperCase()

        return !currentGiftModelSet.has(model)
      })

      const rocketOnlyAmount = filteredRocketRows.reduce((sum, row) => {
        const shopName = String(row.shop || '').trim()
        const originalRow = currentData.find(
          (sourceRow) => sourceRow.id === row.id
        )

        if (
          shopName !== '쿠팡로켓' ||
          Number(originalRow?.amount || 0) !== 0
        ) {
          return sum
        }

        return sum + Number(row.amount || 0)
      }, 0)

      const rocketOnlyCount = filteredRocketRows.reduce((sum, row) => {
        const shopName = String(row.shop || '').trim()
        const originalRow = currentData.find(
          (sourceRow) => sourceRow.id === row.id
        )

        if (
          shopName !== '쿠팡로켓' ||
          Number(originalRow?.amount || 0) !== 0
        ) {
          return sum
        }

        return sum + 1
      }, 0)

      setRocketAmount(rocketOnlyAmount)
      setRocketCount(rocketOnlyCount)
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

  function sortSummaryRows<T extends { qty: number; amount: number }>(
    rows: T[],
    sortKey: SortKey
  ) {
    return [...rows].sort((a, b) => {
      if (sortKey === 'amount') {
        return Number(b.amount || 0) - Number(a.amount || 0)
      }

      if (sortKey === 'avg') {
        const avgA = Number(a.amount || 0) / Math.max(Number(a.qty || 0), 1)
        const avgB = Number(b.amount || 0) / Math.max(Number(b.qty || 0), 1)

        return avgB - avgA
      }

      return Number(b.qty || 0) - Number(a.qty || 0)
    })
  }

  const currentQty = sumSalesQty(rows)
  const currentAmount = sumSalesAmount(rows)
  const currentAvg = calcAverageOrderAmount(rows)

  const prevQty = sumSalesQty(prevRows)
  const prevAmount = sumSalesAmount(prevRows)
  const prevAvg = calcAverageOrderAmount(prevRows)

  const qtyGrowth = calcGrowthRate(currentQty, prevQty)
  const amountGrowth = calcGrowthRate(currentAmount, prevAmount)
  const avgGrowth = calcGrowthRate(currentAvg, prevAvg)

  const dateRows = useMemo(
    () => sortSummaryRows(groupSalesByDate(rows), dateSortKey),
    [rows, dateSortKey]
  )

  const shopRows = useMemo(
    () => sortSummaryRows(groupSalesByShop(rows), shopSortKey),
    [rows, shopSortKey]
  )

  const modelTop = useMemo(
    () => sortSummaryRows(groupSalesByModel(rows), modelSortKey).slice(0, 20),
    [rows, modelSortKey]
  )

  const skuTop = useMemo(
    () => sortSummaryRows(groupSalesBySku(rows), skuSortKey).slice(0, 20),
    [rows, skuSortKey]
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

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="주문수량"
          value={`${formatNumber(currentQty)}개`}
          sub={`이전기간 대비 ${formatPercent(qtyGrowth)}`}
          growth={qtyGrowth}
        />

        <StatCard
          title="주문금액"
          value={`${formatNumber(currentAmount)}원`}
          sub={`이전기간 대비 ${formatPercent(amountGrowth)}`}
          growth={amountGrowth}
        />

        <StatCard
          title="평균 주문금액"
          value={`${formatNumber(Math.round(currentAvg))}원`}
          sub={`이전기간 대비 ${formatPercent(avgGrowth)}`}
          growth={avgGrowth}
        />

        <StatCard
          title="쿠팡로켓(매입가)"
          value={`${formatNumber(rocketAmount)}원`}
          sub={`${formatNumber(rocketCount)}종 매입가 적용`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SummaryTable
          title="일자별 출고"
          sortKey={dateSortKey}
          onSortKeyChange={setDateSortKey}
          headers={['일자', '수량', '금액', '평균 판매가']}
          rows={dateRows.map((item) => [
            item.date,
            formatNumber(item.qty),
            formatNumber(item.amount),
            formatNumber(Math.round(item.amount / Math.max(item.qty, 1))),
          ])}
        />

        <SummaryTable
          title="쇼핑몰별 출고"
          sortKey={shopSortKey}
          onSortKeyChange={setShopSortKey}          
          headers={['쇼핑몰', '수량', '금액', '평균 판매가']}
          rows={shopRows.map((item) => [
            item.shop,
            formatNumber(item.qty),
            formatNumber(item.amount),
            formatNumber(Math.round(item.amount / Math.max(item.qty, 1))),
          ])}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SummaryTable
          title="모델별 TOP 20"
          sortKey={modelSortKey}
          onSortKeyChange={setModelSortKey}
          headers={['모델명', '수량', '금액', '평균 판매가']}
          rows={modelTop.map((item) => [
            item.model,
            formatNumber(item.qty),
            formatNumber(item.amount),
            formatNumber(Math.round(item.amount / Math.max(item.qty, 1))),
          ])}
        />

        <SummaryTable
          title="SKU별 TOP 20"
          sortKey={skuSortKey}
          onSortKeyChange={setSkuSortKey}
          headers={['SKU', '수량', '금액', '평균 판매가']}
          rows={skuTop.map((item) => [
            item.sku,
            formatNumber(item.qty),
            formatNumber(item.amount),
            formatNumber(Math.round(item.amount / Math.max(item.qty, 1))),
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
          <option value="qty">수량순</option>
          <option value="amount">금액순</option>
          <option value="avg">객단가순</option>
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