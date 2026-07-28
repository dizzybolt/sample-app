'use client'

import * as XLSX from 'xlsx'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SkuMapping } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListPagination } from '@/components/list-pagination'
import { batchUpsert,type BulkProgress } from '@/lib/bulk-upload'

const pageSize = 50

function formatSingleNo(value: string) {
  return value.trim().padStart(4, '0')
}

function normalizeSizeForSku(size: string) {
  const value = String(size || '').trim().toUpperCase()

  if (value === 'FREE') return 'F'

  return value
}

function normalizeSkuForMatching(sku: string) {
  const parts = String(sku || '').trim().split('_')

  if (parts.length < 3) return sku.trim()

  const size = parts[parts.length - 1]
  parts[parts.length - 1] = normalizeSizeForSku(size)

  return parts.join('_')
}

function buildSku(modelName: string, colorCode: string, sizeCode: string) {
  const normalizedSize = normalizeSizeForSku(sizeCode)

  if (!modelName || !colorCode || !normalizedSize) return ''

  return `${modelName.trim()}_${colorCode.trim()}_${normalizedSize}`
}

export function SkuMappingManager() {
  const supabase = createClient()

  const [mappings, setMappings] = useState<SkuMapping[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [itemNo, setItemNo] = useState('')
  const [singleNo, setSingleNo] = useState('')
  const [sku, setSku] = useState('')
  const [modelName, setModelName] = useState('')
  const [colorCode, setColorCode] = useState('')
  const [colorName, setColorName] = useState('')
  const [sizeCode, setSizeCode] = useState('')
  const [memo, setMemo] = useState('')

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<BulkProgress | null>(null)

  useEffect(() => {
    searchMappings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage])

  useEffect(() => {
    const nextSku = buildSku(modelName, colorCode, sizeCode)
    if (!editingId && nextSku) setSku(nextSku)
  }, [modelName, colorCode, sizeCode, editingId])

  async function searchMappings() {
    let query = supabase
      .from('sku_mappings')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

    const keyword = searchTerm.trim()

    if (keyword) {
      const keywords = keyword
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

      const conditions = keywords
        .flatMap((value) => [
          `sku.ilike.%${value}%`,
          `model_name.ilike.%${value}%`,
          `item_no.ilike.%${value}%`,
          `single_no.ilike.%${value}%`,
        ])
        .join(',')

      query = query.or(conditions)
    }

    const { data, error, count } = await query

    if (error) {
      alert(`SKU 매핑 조회 실패\n\n${error.message}`)
      return
    }

    setMappings((data || []) as SkuMapping[])
    setTotalCount(count || 0)
  }

  function resetForm() {
    setEditingId(null)
    setItemNo('')
    setSingleNo('')
    setSku('')
    setModelName('')
    setColorCode('')
    setColorName('')
    setSizeCode('')
    setMemo('')
  }

  function handleEdit(item: SkuMapping) {
    setEditingId(item.id)
    setItemNo(item.item_no || '')
    setSingleNo(item.single_no || '')
    setSku(item.sku || '')
    setModelName(item.model_name || '')
    setColorCode(item.color_code || '')
    setColorName(item.color_name || '')
    setSizeCode(item.size_code || '')
    setMemo(item.memo || '')
  }

  async function handleSave() {
    if (!itemNo.trim()) {
      alert('품번번호를 입력해 주세요.')
      return
    }

    if (!singleNo.trim()) {
      alert('단품번호를 입력해 주세요.')
      return
    }

    if (!modelName.trim() || !colorCode.trim() || !sizeCode.trim()) {
      alert('모델명, 색상코드, 사이즈를 입력해 주세요.')
      return
    }

      const nextSku = normalizeSkuForMatching(
        sku.trim() || buildSku(modelName, colorCode, sizeCode)
      )

    if (!nextSku) {
      alert('SKU를 생성할 수 없습니다.')
      return
    }

    setIsSaving(true)

    const payload = {
      item_no: itemNo.trim(),
      single_no: formatSingleNo(singleNo),
      sku: nextSku,
      model_name: modelName.trim(),
      color_code: colorCode.trim(),
      color_name: colorName.trim() || null,
      size_code: sizeCode.trim(),
      memo: memo.trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    const result = editingId
      ? await supabase.from('sku_mappings').update(payload).eq('id', editingId)
      : await supabase.from('sku_mappings').insert(payload)

    setIsSaving(false)

    if (result.error) {
      alert(`저장 실패\n\n${result.error.message}`)
      return
    }

    alert(editingId ? '수정되었습니다.' : '등록되었습니다.')
    resetForm()
    await searchMappings()
  }

  async function handleDelete(item: SkuMapping) {
    const ok = window.confirm(
      `${item.item_no}-${item.single_no} 매핑을 삭제할까요?`
    )

    if (!ok) return

    const { error } = await supabase
      .from('sku_mappings')
      .delete()
      .eq('id', item.id)

    if (error) {
      alert(`삭제 실패\n\n${error.message}`)
      return
    }

    await searchMappings()
  }

  async function handleUploadExcel(file: File) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
    })

    if (rows.length === 0) {
      alert('업로드할 데이터가 없습니다.')
      return
    }

    const uploadRows = rows
      .map((row) => {
        const excelItemNo = String(row.품번번호 || row.품번넘버 || row.item_no || '').trim()
        const excelSingleNo = formatSingleNo(
          String(row.단품번호 || row.단품넘버 || row.single_no || '').trim()
        )
        const excelModelName = String(row.모델명 || row.model_name || '').trim()
        const excelColorCode = String(row.색상코드 || row.color_code || '').trim()
        const excelColorName = String(row.색상명 || row.color_name || '').trim()
        const excelSizeCode = String(row.사이즈 || row.size_code || '').trim()
        const rawExcelSku =
          String(row.SKU || row.sku || '').trim() ||
          buildSku(excelModelName, excelColorCode, excelSizeCode)

        const excelSku = normalizeSkuForMatching(rawExcelSku)
        const excelMemo = String(row.비고 || row.memo || '').trim()

        if (
          !excelItemNo ||
          !excelSingleNo ||
          !excelSku ||
          !excelModelName ||
          !excelColorCode ||
          !excelSizeCode
        ) {
          return null
        }

        return {
          item_no: excelItemNo,
          single_no: excelSingleNo,
          sku: excelSku,
          model_name: excelModelName,
          color_code: excelColorCode,
          color_name: excelColorName || null,
          size_code: excelSizeCode,
          memo: excelMemo || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        }
      })
      .filter(Boolean)

    const uniqueRows = Array.from(
      new Map(
        uploadRows.map((row) => [
          `${row!.item_no}_${row!.single_no}`,
          row,
        ])
      ).values()
    )

    if (uniqueRows.length === 0) {
      alert('업로드 가능한 데이터가 없습니다.')
      return
    }

    setUploading(true)
    setIsSaving(true)
    setUploadProgress({
      total: uniqueRows.length,
      processed: 0,
      success: 0,
      fail: 0,
      percent: 0,
    })

    const result = await batchUpsert({
      supabase,
      tableName: 'sku_mappings',
      rows: uniqueRows,
      onConflict: 'item_no,single_no',
      chunkSize: 500,
      onProgress: setUploadProgress,
    })

    setUploading(false)
    setIsSaving(false)

    alert(
      `엑셀 업로드 완료\n\n성공 ${result.success.toLocaleString()}건\n실패 ${result.fail.toLocaleString()}건${
        result.errors?.length
          ? `\n\n오류 예시:\n${result.errors.slice(0, 3).join('\n')}`
          : ''
      }`
    )

    await searchMappings()
  }

  function downloadExcel() {
    const rows = mappings.map((item, index) => ({
      NO: (currentPage - 1) * pageSize + index + 1,
      품번번호: item.item_no,
      단품번호: item.single_no,
      SKU: item.sku,
      모델명: item.model_name,
      색상코드: item.color_code,
      색상명: item.color_name || '',
      사이즈: item.size_code,
      비고: item.memo || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'SKU매핑')
    XLSX.writeFile(workbook, searchTerm.trim() ? 'SKU매핑_검색결과.xlsx' : 'SKU매핑목록.xlsx')
  }

// 🟢 1,000개 제한 없이 전체 데이터를 받아오는 전체 엑셀 다운로드 함수
  async function downloadAllExcel() {
    const ok = window.confirm(
      '전체 SKU 매핑 데이터를 조회하여 엑셀로 다운로드합니다. 데이터가 많을 경우 시간이 조금 걸릴 수 있습니다. 진행할까요?'
    )
    if (!ok) return

    const keyword = searchTerm.trim()
    const targetItems: any[] = []

    let page = 0
    const FETCH_LIMIT = 1000 // Supabase 안전 최대 제한폭
    let hasMore = true

    // 1. 1,000개씩 끊어서 데이터가 없을 때까지 무한 반복 조회를 실행합니다.
    while (hasMore) {
      let query = supabase
        .from('sku_mappings')
        .select('*')
        .order('updated_at', { ascending: false })
        .range(page * FETCH_LIMIT, (page + 1) * FETCH_LIMIT - 1) // 🛠️ 1,000개 단위 청크 쪼개기

      if (keyword) {
        query = query.or(
          `sku.ilike.%${keyword}%,model_name.ilike.%${keyword}%,item_no.ilike.%${keyword}%,single_no.ilike.%${keyword}%`
        )
      }

      const { data: chunkData, error } = await query

      if (error) {
        alert(`전체 데이터 조회 중 오류 발생 (페이지 ${page + 1})\n\n${error.message}`)
        return
      }

      if (chunkData && chunkData.length > 0) {
        targetItems.push(...chunkData)

        // 가져온 데이터가 1,000개 미만이면 다음 데이터가 없으므로 종료
        if (chunkData.length < FETCH_LIMIT) {
          hasMore = false
        } else {
          page++ // 다음 1,000개를 조회하기 위해 페이지 증가
        }
      } else {
        hasMore = false
      }
    }

    if (targetItems.length === 0) {
      alert('다운로드할 데이터가 없습니다.')
      return
    }

    // 2. 엑셀 파일 행 데이터 구조 매핑
    const rows = targetItems.map((item, index) => ({
      NO: index + 1,
      품번번호: item.item_no,
      단품번호: item.single_no,
      SKU: item.sku,
      모델명: item.model_name,
      색상코드: item.color_code,
      색상명: item.color_name || '',
      사이즈코드: item.size_code,
      메모: item.memo || '',
    }))

    // 3. 엑셀 파일 생성 및 다운로드
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '전체매핑목록')

    const fileName = keyword
      ? `전체SKU매핑검색결과_${new Date().toISOString().slice(0, 10)}.xlsx`
      : `전체SKU매핑목록_${new Date().toISOString().slice(0, 10)}.xlsx`

    XLSX.writeFile(workbook, fileName)
  }  

  const totalPage = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount]
  )

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-gray-900">SKU 매핑관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          품번번호 + 단품번호와 SKU 정보를 관리합니다.
        </p>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">등록/수정</h2>

        {editingId && (
          <p className="mt-2 text-sm text-blue-600">수정 모드</p>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Input value={itemNo} onChange={(e) => setItemNo(e.target.value)} placeholder="품번번호" />
          <Input value={singleNo} onChange={(e) => setSingleNo(e.target.value)} placeholder="단품번호" />
          <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="모델명" />
          <Input value={colorCode} onChange={(e) => setColorCode(e.target.value)} placeholder="색상코드" />
          <Input value={colorName} onChange={(e) => setColorName(e.target.value)} placeholder="색상명" />
          <Input value={sizeCode} onChange={(e) => setSizeCode(e.target.value)} placeholder="사이즈" />
          <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU 자동생성" />
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="비고" />
        </div>

        <div className="mt-4 flex gap-2">
          <Button type="button" disabled={isSaving} onClick={handleSave}>
            {editingId ? '수정 저장' : '등록'}
          </Button>

          {editingId && (
            <Button type="button" variant="outline" onClick={resetForm}>
              취소
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">엑셀 업로드</h2>

        <div className="mt-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-900">엑셀 헤더</p>
          <p className="mt-1">
            품번번호, 단품번호, SKU, 모델명, 색상코드, 색상명, 사이즈, 비고
          </p>
        </div>

        <div className="mt-4">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={isSaving || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return

              handleUploadExcel(file)
              e.target.value = ''
            }}
          />
          {uploading && uploadProgress && (
            <div className="mt-4 rounded-xl border bg-blue-50 p-4 text-sm text-blue-700">
              <div className="flex items-center justify-between">
                <p className="font-medium">업로드 중...</p>
                <p>{uploadProgress.percent}%</p>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>

              <p className="mt-2 text-xs">
                {uploadProgress.processed.toLocaleString()} /{' '}
                {uploadProgress.total.toLocaleString()}건 처리 중
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-gray-900">SKU 매핑 목록</h2>

            <p className="text-sm text-gray-500">
              총 {totalCount.toLocaleString()}건
            </p>

            <ListPagination
              currentPage={currentPage}
              totalPages={totalPage}
              onPageChange={setCurrentPage}
            />
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-[520px]">
            <div className="relative flex-1">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="SKU, 모델명, 품번번호 검색"
                className={searchTerm ? 'pr-9' : ''}
              />

              {searchTerm && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-sm text-gray-400 hover:text-red-500"
                  onClick={() => {
                    setSearchTerm('')
                    setCurrentPage(1)
                    searchMappings()
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCurrentPage(1)
                searchMappings()
              }}
            >
              검색
            </Button>

          <Button
              type="button"
              variant="outline"
              className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
              onClick={downloadAllExcel}
            >
              전체 엑셀
            </Button>

            <Button type="button" variant="outline" onClick={downloadExcel}>
              엑셀
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-3 text-center">NO</th>
                <th className="p-3">품번번호</th>
                <th className="p-3">단품번호</th>
                <th className="p-3">SKU</th>
                <th className="p-3">모델명</th>
                <th className="p-3">색상</th>
                <th className="p-3">사이즈</th>
                <th className="p-3">비고</th>
                <th className="p-3 text-right">관리</th>
              </tr>
            </thead>

            <tbody>
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-500">
                    등록된 SKU 매핑이 없습니다.
                  </td>
                </tr>
              ) : (
                mappings.map((item, index) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3 text-center text-gray-500">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    <td className="p-3">{item.item_no}</td>
                    <td className="p-3">{item.single_no}</td>
                    <td className="p-3 font-medium">{item.sku}</td>
                    <td className="p-3">{item.model_name}</td>
                    <td className="p-3">
                      {item.color_code} {item.color_name || ''}
                    </td>
                    <td className="p-3">{item.size_code}</td>
                    <td className="p-3">{item.memo || '-'}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(item)}>
                          수정
                        </Button>

                        <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(item)}>
                          삭제
                        </Button>
                      </div>
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
