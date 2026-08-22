'use client'

import * as XLSX from 'xlsx'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Download, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListPagination } from '@/components/list-pagination'
import { createClient } from '@/lib/supabase/client'
import { fetchOpsSalesRowsByRange, type OpsSalesRow } from '@/lib/ops/sales'
import { fetchOpsStockRows, type OpsStockRow } from '@/lib/ops/stock'
import {
  fetchProductImageMap,
  normalizeModelName,
  resolveProductImage,
} from '@/lib/product-images'

const MODEL_PAGE_SIZE = 30
const ROCKET_SHOP = '쿠팡로켓'

function toDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getToday() {
  return toDateString(new Date())
}

function getDateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - Math.max(0, days - 1))
  return toDateString(date)
}

function diffDaysInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
}

function normalizeSku(value?: string | null) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/_FREE$/, '_F')
}

function getSkuParts(sku: string) {
  const parts = normalizeSku(sku).split('_')
  return {
    model: parts[0] || '-',
    color: parts[1] || '-',
    size: parts.slice(2).join('_') || '-',
  }
}

function formatNumber(value: number) {
  return Math.round(value || 0).toLocaleString('ko-KR')
}

type RocketSkuSummary = {
  sku: string
  model: string
  color: string
  size: string
  shippedQty: number
  dailyAvg: number
  stockQty: number
  stockDays: number | null
  targetStockQty: number
  reorderQty: number
  imageUrl: string | null
}

type RocketModelSummary = {
  model: string
  shippedQty: number
  dailyAvg: number
  stockQty: number
  stockDays: number | null
  targetStockQty: number
  reorderQty: number
  imageUrl: string | null
  skuRows: RocketSkuSummary[]
}

export function RocketReorderManager() {
  const supabase = useMemo(() => createClient(), [])
  const [startDate, setStartDate] = useState(() => getDateDaysAgo(14))
  const [endDate, setEndDate] = useState(() => getToday())
  const [targetDays, setTargetDays] = useState(14)
  const [salesRows, setSalesRows] = useState<OpsSalesRow[]>([])
  const [stockRows, setStockRows] = useState<OpsStockRow[]>([])
  const [latestStockDate, setLatestStockDate] = useState('')
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [keyword, setKeyword] = useState('')
  const [onlyReorder, setOnlyReorder] = useState(true)
  const [expandedModel, setExpandedModel] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function loadData() {
    if (!startDate || !endDate || startDate > endDate) {
      setErrorMessage('조회 기간을 확인해주세요.')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const [rocketSales, allStock] = await Promise.all([
        fetchOpsSalesRowsByRange({ startDate, endDate, shop: ROCKET_SHOP }),
        fetchOpsStockRows(),
      ])

      const latestDate = allStock.reduce((latest, row) => {
        const value = String(row.snapshot_date || '').slice(0, 10)
        return value > latest ? value : latest
      }, '')

      const latestStock = latestDate
        ? allStock.filter((row) => String(row.snapshot_date || '').slice(0, 10) === latestDate)
        : []

      const targets = Array.from(
        new Set([
          ...rocketSales.map((row) => normalizeSku(row.sku)),
          ...latestStock.map((row) => normalizeSku(row.sku)),
        ])
      )
        .filter(Boolean)
        .map((sku) => ({ sku }))

      const imageMap = await fetchProductImageMap(supabase, targets)
      const nextImageUrls: Record<string, string> = {}
      targets.forEach((target) => {
        const sku = normalizeSku(target.sku)
        const parts = getSkuParts(sku)
        const url = resolveProductImage(imageMap, {
          sku,
          modelName: parts.model,
          colorCode: parts.color,
        })
        if (url) nextImageUrls[sku] = url
      })

      setSalesRows(rocketSales)
      setStockRows(latestStock)
      setLatestStockDate(latestDate)
      setImageUrls(nextImageUrls)
      setExpandedModel('')
      setCurrentPage(1)
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const analysisDays = useMemo(
    () => diffDaysInclusive(startDate, endDate),
    [startDate, endDate]
  )

  const models = useMemo(() => {
    const salesMap = new Map<string, number>()
    const stockMap = new Map<string, number>()

    salesRows.forEach((row) => {
      const sku = normalizeSku(row.sku)
      if (!sku) return
      salesMap.set(sku, (salesMap.get(sku) || 0) + Number(row.qty || 0))
    })

    stockRows.forEach((row) => {
      const sku = normalizeSku(row.sku)
      if (!sku) return
      stockMap.set(sku, (stockMap.get(sku) || 0) + Number(row.qty || 0))
    })

    const skuSet = new Set([...salesMap.keys(), ...stockMap.keys()])
    const modelMap = new Map<string, RocketModelSummary>()

    skuSet.forEach((sku) => {
      const parts = getSkuParts(sku)
      const shippedQty = salesMap.get(sku) || 0
      const stockQty = stockMap.get(sku) || 0
      const dailyAvg = shippedQty / analysisDays
      const targetStockQty = Math.ceil(dailyAvg * targetDays)
      const reorderQty = Math.max(0, targetStockQty - stockQty)
      const stockDays = dailyAvg > 0 ? stockQty / dailyAvg : null
      const skuRow: RocketSkuSummary = {
        sku,
        model: parts.model,
        color: parts.color,
        size: parts.size,
        shippedQty,
        dailyAvg,
        stockQty,
        stockDays,
        targetStockQty,
        reorderQty,
        imageUrl: imageUrls[sku] || null,
      }

      const model = normalizeModelName(parts.model) || parts.model
      const current = modelMap.get(model) || {
        model,
        shippedQty: 0,
        dailyAvg: 0,
        stockQty: 0,
        stockDays: null,
        targetStockQty: 0,
        reorderQty: 0,
        imageUrl: null,
        skuRows: [],
      }

      current.shippedQty += shippedQty
      current.stockQty += stockQty
      current.targetStockQty += targetStockQty
      current.reorderQty += reorderQty
      current.skuRows.push(skuRow)
      current.imageUrl = current.imageUrl || imageUrls[sku] || null
      modelMap.set(model, current)
    })

    return Array.from(modelMap.values())
      .map((row) => {
        const dailyAvg = row.shippedQty / analysisDays
        return {
          ...row,
          dailyAvg,
          stockDays: dailyAvg > 0 ? row.stockQty / dailyAvg : null,
          skuRows: row.skuRows.sort((a, b) => b.reorderQty - a.reorderQty || b.shippedQty - a.shippedQty),
        }
      })
      .sort((a, b) => b.reorderQty - a.reorderQty || b.shippedQty - a.shippedQty)
  }, [analysisDays, imageUrls, salesRows, stockRows, targetDays])

  const filteredModels = useMemo(() => {
    const normalizedKeyword = keyword.trim().toUpperCase()
    return models.filter((row) => {
      if (onlyReorder && row.reorderQty <= 0) return false
      if (!normalizedKeyword) return true
      return (
        row.model.includes(normalizedKeyword) ||
        row.skuRows.some((skuRow) => skuRow.sku.includes(normalizedKeyword))
      )
    })
  }, [keyword, models, onlyReorder])

  const totalPages = Math.max(1, Math.ceil(filteredModels.length / MODEL_PAGE_SIZE))
  const pagedModels = useMemo(() => {
    const from = (currentPage - 1) * MODEL_PAGE_SIZE
    return filteredModels.slice(from, from + MODEL_PAGE_SIZE)
  }, [currentPage, filteredModels])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const totals = useMemo(
    () => ({
      models: models.length,
      shipped: models.reduce((sum, row) => sum + row.shippedQty, 0),
      stock: models.reduce((sum, row) => sum + row.stockQty, 0),
      reorder: models.reduce((sum, row) => sum + row.reorderQty, 0),
    }),
    [models]
  )

  function applyPreset(days: number) {
    setStartDate(getDateDaysAgo(days))
    setEndDate(getToday())
    setCurrentPage(1)
  }

  function exportExcel() {
    const rows = filteredModels.flatMap((model) =>
      model.skuRows.map((sku) => ({
        모델명: model.model,
        SKU: sku.sku,
        컬러: sku.color,
        사이즈: sku.size,
        조회시작일: startDate,
        조회종료일: endDate,
        조회일수: analysisDays,
        쿠팡로켓출고수량: sku.shippedQty,
        일평균출고: Number(sku.dailyAvg.toFixed(2)),
        최신재고기준일: latestStockDate,
        현재고: sku.stockQty,
        재고일수: sku.stockDays == null ? '' : Number(sku.stockDays.toFixed(1)),
        목표재고일수: targetDays,
        목표재고: sku.targetStockQty,
        추천발주수량: sku.reorderQty,
      }))
    )

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '쿠팡로켓 발주추천')
    XLSX.writeFile(workbook, `쿠팡로켓_발주추천_${startDate}_${endDate}.xlsx`)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-gray-500">시작일</span>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-500">종료일</span>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              {[7, 14, 21, 30].map((days) => (
                <Button key={days} type="button" variant="outline" size="sm" onClick={() => applyPreset(days)}>
                  최근 {days}일
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-gray-500">목표 재고일수</span>
              <select
                value={targetDays}
                onChange={(event) => setTargetDays(Number(event.target.value))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {[7, 14, 21, 30].map((days) => (
                  <option key={days} value={days}>{days}일</option>
                ))}
              </select>
            </label>
            <Button type="button" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              조회
            </Button>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          판매 기준: {ROCKET_SHOP} · 조회 {analysisDays}일 · 재고 기준: {latestStockDate || '-'}
        </p>
        {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['대상 모델', `${formatNumber(totals.models)}개`],
          ['로켓 출고수량', `${formatNumber(totals.shipped)}개`],
          ['최신 현재고', `${formatNumber(totals.stock)}개`],
          ['추천 발주수량', `${formatNumber(totals.reorder)}개`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setCurrentPage(1)
                }}
                placeholder="모델명 또는 SKU 검색"
                className="pl-9"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={onlyReorder}
                onChange={(event) => {
                  setOnlyReorder(event.target.checked)
                  setCurrentPage(1)
                }}
              />
              발주 필요만 보기
            </label>
          </div>

          <Button type="button" variant="outline" onClick={exportExcel} disabled={filteredModels.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Excel 다운로드
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">모델</th>
                <th className="px-3 py-3 text-right">로켓출고</th>
                <th className="px-3 py-3 text-right">일평균</th>
                <th className="px-3 py-3 text-right">현재고</th>
                <th className="px-3 py-3 text-right">재고일수</th>
                <th className="px-3 py-3 text-right">목표재고</th>
                <th className="px-3 py-3 text-right">추천발주</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {pagedModels.map((model) => {
                const isOpen = expandedModel === model.model
                return (
                  <Fragment key={model.model}>
                    <tr className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 overflow-hidden rounded-lg border bg-gray-50">
                            {model.imageUrl ? (
                              <img src={model.imageUrl} alt={model.model} className="h-full w-full object-cover" loading="lazy" />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{model.model}</p>
                            <p className="text-xs text-gray-500">SKU {model.skuRows.length}개</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">{formatNumber(model.shippedQty)}</td>
                      <td className="px-3 py-3 text-right">{model.dailyAvg.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right">{formatNumber(model.stockQty)}</td>
                      <td className="px-3 py-3 text-right">{model.stockDays == null ? '-' : `${model.stockDays.toFixed(1)}일`}</td>
                      <td className="px-3 py-3 text-right">{formatNumber(model.targetStockQty)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-red-600">{formatNumber(model.reorderQty)}</td>
                      <td className="px-3 py-3 text-center">
                        <Button type="button" variant="ghost" size="icon" onClick={() => setExpandedModel(isOpen ? '' : model.model)}>
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t bg-gray-50/60">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="overflow-x-auto rounded-xl border bg-white">
                            <table className="min-w-[920px] w-full text-xs">
                              <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                  <th className="px-3 py-2 text-left">SKU</th>
                                  <th className="px-3 py-2 text-left">색상</th>
                                  <th className="px-3 py-2 text-left">사이즈</th>
                                  <th className="px-3 py-2 text-right">로켓출고</th>
                                  <th className="px-3 py-2 text-right">일평균</th>
                                  <th className="px-3 py-2 text-right">현재고</th>
                                  <th className="px-3 py-2 text-right">재고일수</th>
                                  <th className="px-3 py-2 text-right">목표재고</th>
                                  <th className="px-3 py-2 text-right">추천발주</th>
                                </tr>
                              </thead>
                              <tbody>
                                {model.skuRows.map((sku) => (
                                  <tr key={sku.sku} className="border-t">
                                    <td className="px-3 py-2 font-medium text-gray-900">{sku.sku}</td>
                                    <td className="px-3 py-2">{sku.color}</td>
                                    <td className="px-3 py-2">{sku.size}</td>
                                    <td className="px-3 py-2 text-right">{formatNumber(sku.shippedQty)}</td>
                                    <td className="px-3 py-2 text-right">{sku.dailyAvg.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right">{formatNumber(sku.stockQty)}</td>
                                    <td className="px-3 py-2 text-right">{sku.stockDays == null ? '-' : `${sku.stockDays.toFixed(1)}일`}</td>
                                    <td className="px-3 py-2 text-right">{formatNumber(sku.targetStockQty)}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-red-600">{formatNumber(sku.reorderQty)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {!loading && pagedModels.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">조건에 맞는 데이터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t p-4">
          <p className="text-sm text-gray-500">{filteredModels.length.toLocaleString('ko-KR')}개 모델</p>
          <ListPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} disabled={loading} />
        </div>
      </section>
    </div>
  )
}
