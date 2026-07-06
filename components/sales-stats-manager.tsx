'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  fetchOpsSalesRows,
  filterSalesFromDays,
  groupSalesByModel,
  groupSalesByShop,
  groupSalesBySku,
  sumSalesAmount,
  sumSalesQty,
  type OpsSalesRow,
} from '@/lib/ops/sales'
import { formatNumber } from '@/lib/format'

export function SalesStatsManager() {
  const [rows, setRows] = useState<OpsSalesRow[]>([])
  const [loading, setLoading] = useState(false)

  async function loadData() {
    setLoading(true)

    try {
      const data = await fetchOpsSalesRows(30)
      setRows(data)
    } catch (error: any) {
      alert(`출고통계 조회 실패\n\n${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const last7Rows = useMemo(() => filterSalesFromDays(rows, 7), [rows])
  const last30Rows = useMemo(() => filterSalesFromDays(rows, 30), [rows])

  const modelTop = useMemo(
    () => groupSalesByModel(last30Rows).slice(0, 20),
    [last30Rows]
  )

  const skuTop = useMemo(
    () => groupSalesBySku(last30Rows).slice(0, 20),
    [last30Rows]
  )

  const shopSummary = useMemo(
    () => groupSalesByShop(last30Rows),
    [last30Rows]
  )

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard title="최근 7일 출고수량" value={`${formatNumber(sumSalesQty(last7Rows))}개`} />
        <StatCard title="최근 30일 출고수량" value={`${formatNumber(sumSalesQty(last30Rows))}개`} />
        <StatCard title="최근 30일 출고금액" value={`${formatNumber(sumSalesAmount(last30Rows))}원`} />
        <StatCard title="조회 데이터" value={`${formatNumber(rows.length)}행`} />
      </section>

      {loading && (
        <div className="rounded-2xl border bg-white p-5 text-sm text-gray-500">
          출고통계 불러오는 중...
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        <SummaryTable
          title="모델별 TOP 20"
          headers={['모델명', '수량', '금액']}
          rows={modelTop.map((item) => [
            item.model,
            formatNumber(item.qty),
            formatNumber(item.amount),
          ])}
        />

        <SummaryTable
          title="SKU별 TOP 20"
          headers={['SKU', '수량', '금액']}
          rows={skuTop.map((item) => [
            item.sku,
            formatNumber(item.qty),
            formatNumber(item.amount),
          ])}
        />
      </section>

      <SummaryTable
        title="쇼핑몰별 출고"
        headers={['쇼핑몰', '수량', '금액']}
        rows={shopSummary.map((item) => [
          item.shop,
          formatNumber(item.qty),
          formatNumber(item.amount),
        ])}
      />
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function SummaryTable({
  title,
  headers,
  rows,
}: {
  title: string
  headers: string[]
  rows: string[][]
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-gray-900">{title}</h2>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
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