'use client'

import * as XLSX from 'xlsx'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type OptionRow = {
  id: string
  itemNo: string
  singleNo: string
  optionName: string
  modelName: string
  colorCode: string
  colorName: string
  size: string
  stockQty: string
}

type OptionGroup = {
  id: string
  title: string
  modelSearch: string
  rows: OptionRow[]
}

function createRow(): OptionRow {
  return {
    id: crypto.randomUUID(),
    itemNo: '',
    singleNo: '',
    optionName: '',
    modelName: '',
    colorCode: '',
    colorName: '',
    size: '',
    stockQty: '',
  }
}

function createGroup(index: number): OptionGroup {
  return {
    id: crypto.randomUUID(),
    title: `${index}번옵션`,
    modelSearch: '',
    rows: [createRow()],
  }
}

function formatSize(size: string) {
  const value = size.trim()

  if (['80', '85', '90', '95'].includes(value)) {
    return value.padStart(3, '0')
  }

  return value
}

function formatSingleNo(value: string) {
  return value.trim().padStart(4, '0')
}

function formatItemInfo(row: OptionRow) {
  return `${row.itemNo.trim()}-${formatSingleNo(row.singleNo)}:1`
}

function getQty(row: OptionRow) {
  return Number(String(row.stockQty || '0').replaceAll(',', '')) || 0
}

function applyStockRate(qty: number, rate: string) {
  const value = Number(String(rate || '').replace('%', '').trim())

  if (!rate.trim() || Number.isNaN(value) || value >= 100) {
    return qty
  }

  if (value <= 0) {
    return 0
  }

  return Math.floor(qty * (value / 100))
}

function isValidRow(row: OptionRow) {
  return (
    row.itemNo.trim() &&
    row.singleNo.trim() &&
    row.optionName.trim() &&
    row.modelName.trim() &&
    row.colorCode.trim() &&
    row.colorName.trim() &&
    row.size.trim()
  )
}

function generateCombinations<T>(groups: T[][]): T[][] {
  if (groups.length === 0) return []

  return groups.reduce<T[][]>(
    (acc, group) =>
      acc.flatMap((combination) =>
        group.map((item) => [...combination, item])
      ),
    [[]]
  )
}

export function BundleBuilderManager() {
  const [groups, setGroups] = useState<OptionGroup[]>([createGroup(1)])
  const [stockRate, setStockRate] = useState('')
  const supabase = createClient()
  const [loadingGroupId, setLoadingGroupId] = useState<string | null>(null)

  function addGroup() {
    setGroups((prev) => [...prev, createGroup(prev.length + 1)])
  }

  function removeGroup(groupId: string) {
    setGroups((prev) => {
      const next = prev.filter((group) => group.id !== groupId)
      return next.length > 0 ? next : [createGroup(1)]
    })
  }

  function addRow(groupId: string) {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, rows: [...group.rows, createRow()] }
          : group
      )
    )
  }

  function removeRow(groupId: string, rowId: string) {
    setGroups((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) return group

        const nextRows = group.rows.filter((row) => row.id !== rowId)

        return {
          ...group,
          rows: nextRows.length > 0 ? nextRows : [createRow()],
        }
      })
    )
  }

  function updateRow(
    groupId: string,
    rowId: string,
    field: keyof OptionRow,
    value: string
  ) {
    setGroups((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) return group

        return {
          ...group,
          rows: group.rows.map((row) =>
            row.id === rowId ? { ...row, [field]: value } : row
          ),
        }
      })
    )
  }

function updateGroupModelSearch(groupId: string, value: string) {
  setGroups((prev) =>
    prev.map((group) =>
      group.id === groupId
        ? {
            ...group,
            modelSearch: value,
          }
        : group
    )
  )
}

async function loadModelRows(groupId: string) {
  const targetGroup = groups.find((group) => group.id === groupId)
  const modelName = targetGroup?.modelSearch.trim()

  if (!modelName) {
    alert('모델명을 입력해 주세요.')
    return
  }

  setLoadingGroupId(groupId)

  const { data: mappings, error: mappingError } = await supabase
    .from('sku_mappings')
    .select('*')
    .eq('model_name', modelName)
    .order('color_code', { ascending: true })
    .order('size_code', { ascending: true })

  if (mappingError) {
    setLoadingGroupId(null)
    alert(`SKU 매핑 조회 실패\n\n${mappingError.message}`)
    return
  }

  if (!mappings || mappings.length === 0) {
    setLoadingGroupId(null)
    alert('조회된 SKU 매핑이 없습니다.')
    return
  }

  const skus = mappings.map((item) => item.sku).filter(Boolean)

  const { data: inventories, error: inventoryError } = await supabase
    .from('inventory')
    .select('sku, qty')
    .in('sku', skus)

  if (inventoryError) {
    setLoadingGroupId(null)
    alert(`재고 조회 실패\n\n${inventoryError.message}`)
    return
  }

  const stockMap = new Map<string, number>()

  ;(inventories || []).forEach((item) => {
    stockMap.set(
      item.sku,
      (stockMap.get(item.sku) || 0) + Number(item.qty || 0)
    )
  })

  const nextRows: OptionRow[] = mappings.map((item) => ({
    id: crypto.randomUUID(),
    itemNo: item.item_no || '',
    singleNo: item.single_no || '',
    optionName: item.model_name || '',
    modelName: item.model_name || '',
    colorCode: item.color_code || '',
    colorName: item.color_name || '',
    size: item.size_code || '',
    stockQty: String(stockMap.get(item.sku) || 0),
  }))

  setGroups((prev) =>
    prev.map((group) =>
      group.id === groupId
        ? {
            ...group,
            rows: nextRows,
          }
        : group
    )
  )

  setLoadingGroupId(null)
}

  async function uploadOptionExcel(groupId: string, file: File) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
    })

    const parsedRows: OptionRow[] = rows
      .map((row) => ({
        id: crypto.randomUUID(),
        itemNo: String(row.품번넘버 || row.품번번호 || row.itemNo || '').trim(),
        singleNo: String(row.단품넘버 || row.단품번호 || row.singleNo || '').trim(),
        optionName: String(row.옵션명 || row.optionName || '').trim(),
        modelName: String(row.모델명 || row.modelName || '').trim(),
        colorCode: String(row.색상코드 || row.colorCode || '').trim(),
        colorName: String(row.색상명 || row.colorName || '').trim(),
        size: String(row.사이즈 || row.size || '').trim(),
        stockQty: String(row.재고수량 || row.stockQty || row.수량 || '').trim(),
      }))
      .filter(isValidRow)

    if (parsedRows.length === 0) {
      alert('업로드할 수 있는 데이터가 없습니다.')
      return
    }

    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, rows: parsedRows } : group
      )
    )
  }

  const activeGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          rows: group.rows.filter(isValidRow),
        }))
        .filter((group) => group.rows.length > 0),
    [groups]
  )

  const resultRows = useMemo(() => {
    if (activeGroups.length === 0) return []

// ==========================================
    // [CASE 1] 그룹이 1개일 때: 1+1 조합 모드 (안전한 균등 분배 + 정렬 + 행 유지)
    // ==========================================
    if (activeGroups.length === 1) {
      const sourceRows = activeGroups[0].rows
      const results: any[] = []

      // 1. 모든 조합 리스트를 먼저 생성
      const allCombinations: { first: OptionRow; second: OptionRow; firstKey: string; secondKey: string }[] = []
      for (let i = 0; i < sourceRows.length; i++) {
        for (let j = i; j < sourceRows.length; j++) {
          const first = sourceRows[i]
          const second = sourceRows[j]
          if (first.size.trim() !== second.size.trim()) continue

          allCombinations.push({
            first,
            second,
            firstKey: `${first.itemNo.trim()}_${first.singleNo.trim()}`,
            secondKey: `${second.itemNo.trim()}_${second.singleNo.trim()}`,
          })
        }
      }

      // 2. 색상코드 숫자 기준 정렬 (02 -> 03 -> 06 -> 11 -> 15 순서 보장)
      allCombinations.sort((a, b) => {
        // 1. 첫 번째 상품 색상코드 비교
        const codeA1 = Number(a.first.colorCode);
        const codeB1 = Number(b.first.colorCode);
        if (codeA1 !== codeB1) return codeA1 - codeB1;

        // 2. 첫 번째 상품 사이즈 비교
        const sizeA1 = Number(a.first.size);
        const sizeB1 = Number(b.first.size);
        if (sizeA1 !== sizeB1) return sizeA1 - sizeB1;

        // 3. 두 번째 상품 색상코드 비교
        const codeA2 = Number(a.second.colorCode);
        const codeB2 = Number(b.second.colorCode);
        if (codeA2 !== codeB2) return codeA2 - codeB2;

        // 4. 두 번째 상품 사이즈 비교
        const sizeA2 = Number(a.second.size);
        const sizeB2 = Number(b.second.size);
        return sizeA2 - sizeB2;
      });

      // 3. 가중치 정밀 조정 루프 (최종 재고가 0이 되는 조합의 가중치를 분모에서 제외)
      let activeCombinationKeys = new Set(allCombinations.map((_, index) => index));

      while (true) {
        const itemUsageMap = new Map<string, number>()

        allCombinations.forEach((comb, index) => {
          if (!activeCombinationKeys.has(index)) return
          if (getQty(comb.first) <= 0 || getQty(comb.second) <= 0) return

          if (comb.firstKey === comb.secondKey) {
            itemUsageMap.set(comb.firstKey, (itemUsageMap.get(comb.firstKey) || 0) + 2)
          } else {
            itemUsageMap.set(comb.firstKey, (itemUsageMap.get(comb.firstKey) || 0) + 1)
            itemUsageMap.set(comb.secondKey, (itemUsageMap.get(comb.secondKey) || 0) + 1)
          }
        })

        let hasNewZeroCombination = false
        const nextActiveKeys = new Set<number>()

        allCombinations.forEach((comb, index) => {
          if (!activeCombinationKeys.has(index)) return
          if (getQty(comb.first) <= 0 || getQty(comb.second) <= 0) {
            hasNewZeroCombination = true
            return
          }

          const firstTotalUsage = itemUsageMap.get(comb.firstKey) || 1
          const secondTotalUsage = itemUsageMap.get(comb.secondKey) || 1

          let stockQty = 0
          if (comb.firstKey === comb.secondKey) {
            stockQty = Math.floor((getQty(comb.first) / firstTotalUsage) * 2)
          } else {
            const qtyFromFirst = Math.floor(getQty(comb.first) / firstTotalUsage)
            const qtyFromSecond = Math.floor(getQty(comb.second) / secondTotalUsage)
            stockQty = Math.min(qtyFromFirst, qtyFromSecond)
          }

          if (stockQty <= 0) {
            hasNewZeroCombination = true
          } else {
            nextActiveKeys.add(index)
          }
        })

        if (!hasNewZeroCombination) break
        activeCombinationKeys = nextActiveKeys
        if (activeCombinationKeys.size === 0) break
      }

      // 4. 최종 확정된 가중치 맵 구축
      const finalUsageMap = new Map<string, number>()
      allCombinations.forEach((comb, index) => {
        if (!activeCombinationKeys.has(index)) return
        if (getQty(comb.first) <= 0 || getQty(comb.second) <= 0) return

        if (comb.firstKey === comb.secondKey) {
          finalUsageMap.set(comb.firstKey, (finalUsageMap.get(comb.firstKey) || 0) + 2)
        } else {
          finalUsageMap.set(comb.firstKey, (finalUsageMap.get(comb.firstKey) || 0) + 1)
          finalUsageMap.set(comb.secondKey, (finalUsageMap.get(comb.secondKey) || 0) + 1)
        }
      })

      // 5. 최종 결과 배열 생성 (행 유지 + 출력비율 반영)
      for (const { first, second, firstKey, secondKey } of allCombinations) {
        const size = formatSize(first.size)
        let stockQty = 0
        
        if (getQty(first) > 0 && getQty(second) > 0) {
          const firstTotalUsage = finalUsageMap.get(firstKey) || 1
          const secondTotalUsage = finalUsageMap.get(secondKey) || 1

          if (firstKey === secondKey) {
            stockQty = Math.floor((getQty(first) / firstTotalUsage) * 2)
          } else {
            const qtyFromFirst = Math.floor(getQty(first) / firstTotalUsage)
            const qtyFromSecond = Math.floor(getQty(second) / secondTotalUsage)
            stockQty = Math.min(qtyFromFirst, qtyFromSecond)
          }
          if (stockQty < 0) stockQty = 0
        }

        results.push({
          모델명: first.modelName.trim(),
          옵션별칭: `SET_${first.modelName.trim()}_${String(first.colorCode).trim().padStart(2, '0')}+${String(second.colorCode).trim().padStart(2, '0')}_${size === 'FREE' ? 'F' : size}`,
          색상명: `C${String(first.colorCode).padStart(2, '0')}${first.colorName.trim()}+C${String(second.colorCode).padStart(2, '0')}${second.colorName.trim()}`,
          사이즈: String(size).replace(/^0/, ''),
          재고수량: applyStockRate(stockQty, stockRate),
          '품번넘버+단품넘버': `${formatItemInfo(first)},${formatItemInfo(second)}`,
        })
      }

      return results
    }

    // ==========================================
    // [CASE 2] 그룹이 2개 이상일 때: 세트 조합 모드 (비례배분)
    // ==========================================
    const combinations = generateCombinations(
      activeGroups.map((group) => group.rows)
    )

    const allSetCombinations = combinations.map((matchedRows) => {
      return {
        matchedRows,
        keys: matchedRows.map((row) => `${row.itemNo.trim()}_${row.singleNo.trim()}`)
      }
    })
   
    // [수정: 여기에 정렬 로직 추가]
    allSetCombinations.sort((a, b) => {
      for (let i = 0; i < activeGroups.length; i++) {
        // 1. 색상코드 비교 (숫자 변환으로 02 < 11 보장)
        const colorA = Number(a.matchedRows[i].colorCode);
        const colorB = Number(b.matchedRows[i].colorCode);
        if (colorA !== colorB) return colorA - colorB;

        // 2. 색상이 같다면 사이즈 비교
        const sizeA = Number(a.matchedRows[i].size);
        const sizeB = Number(b.matchedRows[i].size);
        
        // 사이즈가 숫자가 아닌 경우(예: 'FREE')를 대비해 NaN 처리
        const valA = isNaN(sizeA) ? 999 : sizeA;
        const valB = isNaN(sizeB) ? 999 : sizeB;
        
        if (valA !== valB) return valA - valB;
      }
      return 0;
    });

    const setPartnerSumMap = new Map<string, number>()
    allSetCombinations.forEach((comb) => {
      if (comb.matchedRows.some((row) => getQty(row) <= 0)) return

      comb.matchedRows.forEach((row, rowIdx) => {
        const currentKey = comb.keys[rowIdx]
        const partnerStockProduct = comb.matchedRows
          .filter((_, idx) => idx !== rowIdx)
          .reduce((sum, r) => sum + getQty(r), 0)

        setPartnerSumMap.set(currentKey, (setPartnerSumMap.get(currentKey) || 0) + partnerStockProduct)
      })
    })

    return allSetCombinations.map((comb) => {
      let stockQty = 0

      if (comb.matchedRows.every((row) => getQty(row) > 0)) {
        const qtys = comb.matchedRows.map((row, rowIdx) => {
          const currentKey = comb.keys[rowIdx]
          const totalPartnerStock = setPartnerSumMap.get(currentKey) || 1
          
          const partnerStockProduct = comb.matchedRows
            .filter((_, idx) => idx !== rowIdx)
            .reduce((sum, r) => sum + getQty(r), 0)

          return Math.floor(getQty(row) * (partnerStockProduct / totalPartnerStock))
        })

          stockQty = Math.min(...qtys)
        if (stockQty < 0) stockQty = 0
      }

      return {
        조합옵션명: comb.matchedRows
          .map(
            (row) =>
              `${row.optionName.trim()} ${row.colorName.trim()} ${formatSize(
                row.size
              )}`
          )
          .join('+'),

        재고수량: applyStockRate(stockQty, stockRate),

        '품번넘버+단품넘버': comb.matchedRows.map(formatItemInfo).join(','),
      }
    })
  }, [activeGroups, stockRate])

  function downloadExcel() {
    if (resultRows.length === 0) {
      alert('생성된 결과가 없습니다.')
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(resultRows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, '구성상품')
    XLSX.writeFile(workbook, '구성상품_생성결과.xlsx')
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-gray-900">구성상품 생성기</h1>
        <p className="mt-1 text-sm text-gray-500">
          옵션 1개 입력 시 1+1 규칙, 옵션 2개 이상 입력 시 세트 규칙으로 생성합니다.
        </p>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={addGroup}>
            구성 상품 추가
          </Button>
          
          {/* 하단 엑셀 다운로드 버튼과 중복되므로 비활성화
          <Button type="button" variant="outline" onClick={downloadExcel}>
            결과 엑셀 다운로드
          </Button>
          */}

        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-900">옵션별 업로드 헤더</p>
          <p className="mt-1">
            품번넘버, 단품넘버, 옵션명, 모델명, 색상코드, 색상명, 사이즈, 재고수량
          </p>
        </div>
      </section>

      {groups.map((group, groupIndex) => (
        <section
          key={group.id}
          className="rounded-2xl border bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                {groupIndex + 1}번 옵션
              </h2>

              <div className="mt-2 flex gap-2">
                <Input
                  value={group.modelSearch}
                  onChange={(e) =>
                    updateGroupModelSearch(group.id, e.target.value)
                  }
                  placeholder="모델명 입력 후 불러오기"
                  className="w-64"
                />

                <Button
                  type="button"
                  variant="outline"
                  disabled={loadingGroupId === group.id}
                  onClick={() => loadModelRows(group.id)}
                >
                  {loadingGroupId === group.id ? '불러오는 중...' : '불러오기'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="w-full sm:w-56"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return

                  uploadOptionExcel(group.id, file)
                  e.target.value = ''
                }}
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => addRow(group.id)}
              >
                행 추가
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={() => removeGroup(group.id)}
              >
                옵션 삭제
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-2">품번넘버</th>
                  <th className="p-2">단품넘버</th>
                  <th className="p-2">옵션명(상품명)</th>
                  <th className="p-2">모델명</th>
                  <th className="p-2">색상코드</th>
                  <th className="p-2">색상명</th>
                  <th className="p-2">사이즈</th>
                  <th className="p-2">재고수량</th>
                  <th className="p-2 text-right">관리</th>
                </tr>
              </thead>

              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    {(
                      [
                        ['itemNo', '품번넘버'],
                        ['singleNo', '단품넘버'],
                        ['optionName', '옵션명'],
                        ['modelName', '모델명'],
                        ['colorCode', '색상코드'],
                        ['colorName', '색상명'],
                        ['size', '사이즈'],
                        ['stockQty', '재고수량'],
                      ] as [keyof OptionRow, string][]
                    ).map(([field, placeholder]) => (
                      <td key={field} className="p-2">
                        <Input
                          value={String(row[field] || '')}
                          onChange={(e) =>
                            updateRow(group.id, row.id, field, e.target.value)
                          }
                          placeholder={placeholder}
                        />
                      </td>
                    ))}

                    <td className="p-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeRow(group.id, row.id)}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">생성 결과</h2>
            <p className="mt-1 text-sm text-gray-500">
              총 {resultRows.length.toLocaleString()}건
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={stockRate}
              onChange={(e) => setStockRate(e.target.value)}
              placeholder="출력비율 %"
              className="w-28"
              inputMode="numeric"
            />

            <Button type="button" variant="outline" onClick={downloadExcel}>
              엑셀 다운로드
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-3 text-center">NO</th>

                {activeGroups.length <= 1 ? (
                  <>
                    <th className="p-3">모델명</th>
                    <th className="p-3">옵션별칭</th>
                    <th className="p-3">색상명</th>
                    <th className="p-3">사이즈</th>
                    <th className="p-3 text-right">재고수량</th>
                    <th className="p-3">품번넘버+단품넘버</th>
                  </>
                ) : (
                  <>
                    <th className="p-3">조합옵션명</th>
                    <th className="p-3 text-right">재고수량</th>
                    <th className="p-3">품번넘버+단품넘버</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {resultRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeGroups.length <= 1 ? 7 : 4}
                    className="p-6 text-center text-gray-500"
                  >
                    입력값 또는 업로드된 옵션 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                resultRows.map((row, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-3 text-center text-gray-500">
                      {index + 1}
                    </td>

                    {activeGroups.length <= 1 ? (
                      <>
                        <td className="p-3">{row.모델명}</td>
                        <td className="p-3 font-medium">{row.옵션별칭}</td>
                        <td className="p-3">{row.색상명}</td>
                        <td className="p-3">{row.사이즈}</td>
                        <td className="p-3 text-right font-bold">
                          {row.재고수량.toLocaleString()}
                        </td>
                        <td className="p-3">{row['품번넘버+단품넘버']}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 font-medium">{row.조합옵션명}</td>
                        <td className="p-3 text-right font-bold">
                          {row.재고수량.toLocaleString()}
                        </td>
                        <td className="p-3">{row['품번넘버+단품넘버']}</td>
                      </>
                    )}
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