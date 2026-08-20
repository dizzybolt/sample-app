'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
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
import {
  fetchProductImageMap,
  resolveProductImage,
} from '@/lib/product-images'

const supabase = createClient()

const SALES_STATS_TEMPLATE_PATH =
  '/excel/sales-stats-template-base.xlsm'

const SALES_STATS_SHEETS = [
  '일자별 순매출',
  '쇼핑몰별 순매출',
  '모델별 TOP100',
  'SKU별 TOP100',
] as const


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

type WorksheetColumn =
  | number
  | {
      wch: number
      hidden?: boolean
    }

function sanitizeFilePart(value: string) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 60)
}

function makeSalesStatsFileName(
  prefix: string,
  startDate: string,
  endDate: string
) {
  return `${sanitizeFilePart(prefix)}_${startDate}_${endDate}.xlsm`
}

function toDateSheetRows(rows: NetSalesSummaryRow[]) {
  return rows.map((item) => ({
    일자: item.label,
    순출고수량: Number(item.netQty || 0),
    순매출금액: Number(item.netAmount || 0),
    '평균 순판매가': Math.round(Number(item.avgNetAmount || 0)),
  }))
}

function toShopSheetRows(rows: NetSalesSummaryRow[]) {
  return rows.map((item) => ({
    쇼핑몰: item.label,
    순출고수량: Number(item.netQty || 0),
    순매출금액: Number(item.netAmount || 0),
    '평균 순판매가': Math.round(Number(item.avgNetAmount || 0)),
  }))
}

function toRankSheetRows(
  rows: NetSalesSummaryRow[],
  labelHeader: '품번코드' | 'SKU',
  imageUrls: Map<string, string>,
  targetType: 'model' | 'sku'
) {
  return rows.map((item, index) => ({
    순위: index + 1,
    [labelHeader]: item.label,
    '이미지 URL':
      targetType === 'model'
        ? resolveProductImage(imageUrls, { modelName: item.label }) || ''
        : resolveProductImage(imageUrls, { sku: item.label }) || '',
    이미지: '',
    주문수량: Number(item.orderQty || 0),
    반품수량: Number(item.returnQty || 0),
    취소수량: Number(item.cancelQty || 0),
    순출고수량: Number(item.netQty || 0),
    순매출금액: Number(item.netAmount || 0),
    '평균 순판매가': Math.round(Number(item.avgNetAmount || 0)),
  }))
}

function applyWorksheetLayout(
  worksheet: XLSX.WorkSheet,
  columns: WorksheetColumn[]
) {
  worksheet['!cols'] = columns.map((col) => {
    if (typeof col === 'number') {
      return { wch: col }
    }

    return {
      wch: col.wch,
      hidden: col.hidden,
    }
  })
}


async function loadSalesStatsTemplateWorkbook() {
  const response = await fetch(SALES_STATS_TEMPLATE_PATH)

  if (!response.ok) {
    throw new Error(
      `주문통계 매크로 템플릿을 불러오지 못했습니다. (${response.status})`
    )
  }

  const buffer = await response.arrayBuffer()
  const workbook = XLSX.read(buffer, {
    type: 'array',
    bookVBA: true,
    cellStyles: true,
  })

  if (!(workbook as any).vbaraw) {
    throw new Error(
      '주문통계 템플릿에 VBA 프로젝트가 없습니다. sales-stats-template-base.xlsm을 확인해 주세요.'
    )
  }

  const missingSheets = SALES_STATS_SHEETS.filter(
    (sheetName) => !workbook.Sheets[sheetName]
  )

  if (missingSheets.length > 0) {
    throw new Error(
      `주문통계 템플릿에 필요한 시트가 없습니다: ${missingSheets.join(', ')}`
    )
  }

  return workbook
}

function setWorksheetVisibility(
  workbook: XLSX.WorkBook,
  visibleSheetNames: string[]
) {
  const visibleSet = new Set(visibleSheetNames)
  const workbookMeta = (workbook as any).Workbook

  if (!workbookMeta) return

  workbookMeta.Sheets = workbookMeta.Sheets || []

  workbook.SheetNames.forEach((sheetName, index) => {
    workbookMeta.Sheets[index] = workbookMeta.Sheets[index] || {}

    // 0 = visible, 2 = VeryHidden
    workbookMeta.Sheets[index].Hidden = visibleSet.has(sheetName) ? 0 : 2
  })
}

function writeMacroWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string
) {
  XLSX.writeFile(workbook, fileName, {
    bookType: 'xlsm',
    bookVBA: true,
    cellStyles: true,
  })
}

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
  const [imageLoading, setImageLoading] = useState(false)

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
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())

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
      alert(`주문통계 조회 실패

${error.message}`)
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

  const modelRankRows = useMemo(
    () =>
      sortSummaryRows(
        buildNetSalesSummary(
          rows,
          claimRows,
          (row) => getModelFromSku(row.sku),
          (row) => getModelFromSku(row.sku)
        ),
        modelSortKey
      ),
    [rows, claimRows, modelSortKey]
  )

  const skuRankRows = useMemo(
    () =>
      sortSummaryRows(
        buildNetSalesSummary(
          rows,
          claimRows,
          (row) => String(row.sku || '-'),
          (row) => String(row.sku || '-')
        ),
        skuSortKey
      ),
    [rows, claimRows, skuSortKey]
  )

  const modelTop = useMemo(
    () => modelRankRows.slice(0, 20),
    [modelRankRows]
  )

  const skuTop = useMemo(
    () => skuRankRows.slice(0, 20),
    [skuRankRows]
  )

  const modelTop100 = useMemo(
    () => modelRankRows.slice(0, 100),
    [modelRankRows]
  )

  const skuTop100 = useMemo(
    () => skuRankRows.slice(0, 100),
    [skuRankRows]
  )

  async function fetchTopRankImageMap() {
    const targets = [
      ...modelTop100.map((item) => ({ modelName: item.label })),
      ...skuTop100.map((item) => ({ sku: item.label })),
    ]

    if (targets.length === 0) {
      return new Map<string, string>()
    }

    return fetchProductImageMap(supabase, targets)
  }

  async function downloadSectionExcel(
    section: 'date' | 'shop' | 'model' | 'sku'
  ) {
    try {
      let sheetName = ''
      let fileLabel = ''
      let data: Record<string, string | number>[] = []
      let widths: WorksheetColumn[] = []

      if (section === 'date') {
        sheetName = '일자별 순매출'
        fileLabel = '일자별_순매출'
        data = toDateSheetRows(dateRows)
        widths = [14, 14, 18, 16]
      } else if (section === 'shop') {
        sheetName = '쇼핑몰별 순매출'
        fileLabel = '쇼핑몰별_순매출'
        data = toShopSheetRows(shopRows)
        widths = [22, 14, 18, 16]
      } else if (section === 'model') {
        setImageLoading(true)
        const exportImageMap = await fetchTopRankImageMap()
        sheetName = '모델별 TOP100'
        fileLabel = '모델별_TOP100'
        data = toRankSheetRows(
          modelTop100,
          '품번코드',
          exportImageMap,
          'model'
        )
        widths = [
          8,
          22,
          { wch: 48, hidden: true },
          18,
          12,
          12,
          12,
          14,
          18,
          16,
        ]
      } else {
        setImageLoading(true)
        const exportImageMap = await fetchTopRankImageMap()
        sheetName = 'SKU별 TOP100'
        fileLabel = 'SKU별_TOP100'
        data = toRankSheetRows(
          skuTop100,
          'SKU',
          exportImageMap,
          'sku'
        )
        widths = [
          8,
          30,
          { wch: 48, hidden: true },
          18,
          12,
          12,
          12,
          14,
          18,
          16,
        ]
      }

      const workbook = await loadSalesStatsTemplateWorkbook()
      const worksheet = XLSX.utils.json_to_sheet(data)

      applyWorksheetLayout(worksheet, widths)
      workbook.Sheets[sheetName] = worksheet

      // 개별 다운로드는 선택한 시트만 표시한다.
      // 나머지는 삭제하지 않고 VeryHidden 처리해 VBA 구조를 보존한다.
      setWorksheetVisibility(workbook, [sheetName])

      writeMacroWorkbook(
        workbook,
        makeSalesStatsFileName(fileLabel, startDate, endDate)
      )
    } catch (error: any) {
      alert(`Excel 다운로드 실패\n\n${error?.message || error}`)
    } finally {
      setImageLoading(false)
    }
  }

  async function downloadAllExcel() {
    setImageLoading(true)

    try {
      const exportImageMap = await fetchTopRankImageMap()
      const workbook = await loadSalesStatsTemplateWorkbook()

      const dateSheet = XLSX.utils.json_to_sheet(
        toDateSheetRows(dateRows)
      )
      applyWorksheetLayout(dateSheet, [14, 14, 18, 16])
      workbook.Sheets['일자별 순매출'] = dateSheet

      const shopSheet = XLSX.utils.json_to_sheet(
        toShopSheetRows(shopRows)
      )
      applyWorksheetLayout(shopSheet, [22, 14, 18, 16])
      workbook.Sheets['쇼핑몰별 순매출'] = shopSheet

      const modelSheet = XLSX.utils.json_to_sheet(
        toRankSheetRows(
          modelTop100,
          '품번코드',
          exportImageMap,
          'model'
        )
      )
      applyWorksheetLayout(modelSheet, [
        8,
        22,
        { wch: 48, hidden: true },
        18,
        12,
        12,
        12,
        14,
        18,
        16,
      ])
      workbook.Sheets['모델별 TOP100'] = modelSheet

      const skuSheet = XLSX.utils.json_to_sheet(
        toRankSheetRows(
          skuTop100,
          'SKU',
          exportImageMap,
          'sku'
        )
      )
      applyWorksheetLayout(skuSheet, [
        8,
        30,
        { wch: 48, hidden: true },
        18,
        12,
        12,
        12,
        14,
        18,
        16,
      ])
      workbook.Sheets['SKU별 TOP100'] = skuSheet

      // 전체 다운로드는 네 개 시트를 모두 표시한다.
      setWorksheetVisibility(
        workbook,
        Array.from(SALES_STATS_SHEETS)
      )

      writeMacroWorkbook(
        workbook,
        makeSalesStatsFileName('주문통계_전체', startDate, endDate)
      )
    } catch (error: any) {
      alert(`전체 Excel 다운로드 실패\n\n${error?.message || error}`)
    } finally {
      setImageLoading(false)
    }
  }

  useEffect(() => {
    const targets = [
      ...modelTop100.map((item) => ({ modelName: item.label })),
      ...skuTop100.map((item) => ({ sku: item.label })),
    ]

    if (targets.length === 0) {
      setImageUrls(new Map())
      return
    }

    let cancelled = false
    setImageLoading(true)

    void fetchProductImageMap(supabase, targets)
      .then((imageMap) => {
        if (!cancelled) setImageUrls(imageMap)
      })
      .catch((error) => {
        console.error('주문통계 이미지 조회 실패:', error)
        if (!cancelled) setImageUrls(new Map())
      })
      .finally(() => {
        if (!cancelled) setImageLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [modelTop100, skuTop100])

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

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="h-10 min-w-[88px] flex-1 rounded-md bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? '조회 중...' : '조회'}
            </button>

            <button
              type="button"
              onClick={downloadAllExcel}
              disabled={loading || imageLoading || rows.length === 0}
              className="flex h-10 min-w-[112px] items-center justify-center gap-2 rounded-md border border-green-700 bg-white px-3 text-sm font-medium text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
              title="조회 결과 전체 Excel 다운로드"
            >
              <ExcelIcon className="h-4 w-4" />
              전체 Excel
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
          onDownload={() => void downloadSectionExcel('date')}
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
          onDownload={() => void downloadSectionExcel('shop')}
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
          imageUrls={modelTop.map(
            (item) =>
              resolveProductImage(imageUrls, { modelName: item.label }) || ''
          )}
          onDownload={() => void downloadSectionExcel('model')}
          downloadDisabled={imageLoading}
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
          imageUrls={skuTop.map(
            (item) => resolveProductImage(imageUrls, { sku: item.label }) || ''
          )}
          onDownload={() => void downloadSectionExcel('sku')}
          downloadDisabled={imageLoading}
        />
      </section>
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

function ExcelIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="m8.5 12 4 6" />
      <path d="m12.5 12-4 6" />
    </svg>
  )
}

function SummaryTable({
  title,
  headers,
  rows,
  sortKey,
  onSortKeyChange,
  imageUrls,
  onDownload,
  downloadDisabled,
}: {
  title: string
  headers: string[]
  rows: string[][]
  sortKey: SortKey
  onSortKeyChange: (key: SortKey) => void
  imageUrls?: string[]
  onDownload: () => void
  downloadDisabled?: boolean
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">{title}</h2>

        <div className="flex items-center gap-2">
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

          <button
            type="button"
            onClick={onDownload}
            disabled={downloadDisabled || rows.length === 0}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-green-700 text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
            title={`${title} Excel 다운로드`}
            aria-label={`${title} Excel 다운로드`}
          >
            <ExcelIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-4 max-h-[520px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-gray-50">
              {imageUrls && <th className="p-3 text-center">이미지</th>}
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
                <td
                  colSpan={headers.length + (imageUrls ? 1 : 0)}
                  className="p-6 text-center text-gray-500"
                >
                  표시할 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b last:border-0">
                  {imageUrls && (
                    <td className="p-2 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border bg-gray-50">
                        {imageUrls[rowIndex] ? (
                          <img
                            src={imageUrls[rowIndex]}
                            alt={row[0]}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            이미지 없음
                          </span>
                        )}
                      </div>
                    </td>
                  )}
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
