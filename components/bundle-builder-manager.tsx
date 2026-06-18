'use client'

import * as XLSX from 'xlsx'
import { useMemo, useState } from 'react'
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

    if (activeGroups.length === 1) {
      const sourceRows = activeGroups[0].rows
      const results: any[] = []

      for (let i = 0; i < sourceRows.length; i++) {
        for (let j = i; j < sourceRows.length; j++) {
          const first = sourceRows[i]
          const second = sourceRows[j]

          if (first.size.trim() !== second.size.trim()) continue

          const size = formatSize(first.size)
          const stockQty = Math.min(getQty(first), getQty(second))

          results.push({
            모델명: first.modelName.trim(),
            옵션별칭: `SET_${first.modelName.trim()}_${first.colorCode.trim()}+${second.colorCode.trim()}_${size}`,
            색상명: `${first.colorName.trim()}+${second.colorName.trim()}`,
            사이즈: size,
            재고수량: stockQty,
            '품번넘버+단품넘버': `${formatItemInfo(first)},${formatItemInfo(
              second
            )}`,
          })
        }
      }

      return results
    }

    const combinations = generateCombinations(
    activeGroups.map((group) => group.rows)
    )

    return combinations.map((matchedRows) => ({
    조합옵션명: matchedRows
        .map(
        (row) =>
            `${row.optionName.trim()} ${row.colorName.trim()} ${formatSize(
            row.size
            )}`
        )
        .join('+'),

    재고수량: Math.min(...matchedRows.map(getQty)),

    '품번넘버+단품넘버': matchedRows.map(formatItemInfo).join(','),
    }))
  }, [activeGroups])

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
            옵션 추가
          </Button>

          <Button type="button" variant="outline" onClick={downloadExcel}>
            결과 엑셀 다운로드
          </Button>
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
            <h2 className="font-semibold text-gray-900">
              {groupIndex + 1}번 옵션
            </h2>

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
                  <th className="p-2">옵션명</th>
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

          <Button type="button" variant="outline" onClick={downloadExcel}>
            엑셀 다운로드
          </Button>
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