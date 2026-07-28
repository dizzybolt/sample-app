'use client'

import * as XLSX from 'xlsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListPagination } from '@/components/list-pagination'
import { batchUpsert, type BulkProgress } from '@/lib/bulk-upload'

const PAGE_SIZE = 50

type ProductMaster = {
  id: string
  model_name: string
  brand_code?: string | null
  category_code?: string | null
  seq_no?: number | null
  year_code?: string | null
  season_code?: string | null
  status?: string | null
  note?: string | null
  sale_price?: number | null
  tag_price?: number | null
  cost_price?: number | null
  gender?: string | null
  product_status?: string | null
  representative_color?: string | null
  size_group?: string | null
  created_at?: string | null
  updated_at?: string | null
  sku_count?: number | null
  color_count?: number | null
  ops_stock_qty?: number | null
  representative_image_url?: string | null
  has_missing_info?: boolean | null
}

type SizeGroup = {
  id: string
  name: string
}

function formatNumber(value: number | string | null | undefined) {
  if (typeof value === 'string') return value
  return Number(value || 0).toLocaleString('ko-KR')
}

function parseNumber(value: string) {
  const parsed = Number(String(value || '').replaceAll(',', '').trim())
  return Number.isNaN(parsed) ? 0 : parsed
}

function parseModelName(modelName: string) {
  const value = modelName.trim().toUpperCase()

  return {
    brand_code: value.slice(0, 3) || null,
    category_code: value.slice(3, 5) || null,
    seq_no: Number(value.slice(5, 8)) || 0,
    year_code: value.slice(8, 9) || null,
    season_code: value.slice(9, 10) || null,
  }
}

export function ProductMasterManager() {
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<ProductMaster[]>([])
  const [sizeGroups, setSizeGroups] = useState<SizeGroup[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priceFilter, setPriceFilter] = useState('ALL')
  const [infoFilter, setInfoFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<BulkProgress | null>(null)

  const [form, setForm] = useState({
    model_name: '',
    sale_price: '',
    tag_price: '',
    cost_price: '',
    gender: '',
    product_status: '운영중',
    size_group: '',
    note: '',
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const fromNumber = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const toNumber = Math.min(currentPage * PAGE_SIZE, totalCount)

  const applyFilters = useCallback(
    (baseQuery: any) => {
      let query = baseQuery
      const keyword = searchTerm.trim()

      if (keyword) {
        query = query.or(
          `model_name.ilike.%${keyword}%,note.ilike.%${keyword}%`
        )
      }

      if (statusFilter !== 'ALL') {
        query = query.eq('product_status', statusFilter)
      }

      if (priceFilter === 'HAS_PRICE') {
        query = query.or('sale_price.gt.0,tag_price.gt.0,cost_price.gt.0')
      } else if (priceFilter === 'NO_PRICE') {
        query = query
          .or('sale_price.is.null,sale_price.eq.0')
          .or('tag_price.is.null,tag_price.eq.0')
          .or('cost_price.is.null,cost_price.eq.0')
      }

      if (infoFilter === 'MISSING') query = query.eq('has_missing_info', true)
      if (infoFilter === 'COMPLETE') query = query.eq('has_missing_info', false)

      return query
    },
    [searchTerm, statusFilter, priceFilter, infoFilter]
  )

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)

    let query = supabase
      .from('product_master_ops_summary')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('model_name', { ascending: true })
      .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)

    query = applyFilters(query)
    const { data, error, count } = await query
    setIsLoading(false)

    if (error) {
      alert(`상품마스터 조회 실패\n\n${error.message}`)
      return
    }

    setProducts((data || []) as ProductMaster[])
    setTotalCount(count || 0)
  }, [applyFilters, currentPage, supabase])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    supabase
      .from('size_groups')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error)
        setSizeGroups((data || []) as SizeGroup[])
      })
  }, [supabase])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  function resetForm() {
    setEditingId(null)
    setForm({
      model_name: '',
      sale_price: '',
      tag_price: '',
      cost_price: '',
      gender: '',
      product_status: '운영중',
      size_group: '',
      note: '',
    })
  }

  function handleEdit(product: ProductMaster) {
    setEditingId(product.id)
    setShowForm(true)
    setForm({
      model_name: product.model_name || '',
      sale_price: String(product.sale_price || ''),
      tag_price: String(product.tag_price || ''),
      cost_price: String(product.cost_price || ''),
      gender: product.gender || '',
      product_status: product.product_status || product.status || '운영중',
      size_group: product.size_group || '',
      note: product.note || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave() {
    const modelName = form.model_name.trim().toUpperCase()

    if (!modelName) {
      alert('모델명을 입력해 주세요.')
      return
    }

    const payload = {
      model_name: modelName,
      ...parseModelName(modelName),
      sale_price: parseNumber(form.sale_price),
      tag_price: parseNumber(form.tag_price),
      cost_price: parseNumber(form.cost_price),
      gender: form.gender.trim() || null,
      product_status: form.product_status.trim() || '운영중',
      status: form.product_status.trim() || '운영중',
      size_group: form.size_group.trim() || null,
      note: form.note.trim() || null,
      updated_at: new Date().toISOString(),
    }

    setIsSaving(true)
    const { error } = editingId
      ? await supabase.from('product_master').update(payload).eq('id', editingId)
      : await supabase.from('product_master').upsert(payload, {
          onConflict: 'model_name',
        })
    setIsSaving(false)

    if (error) {
      alert(`저장 실패\n\n${error.message}`)
      return
    }

    resetForm()
    setShowForm(false)
    await fetchProducts()
  }

  async function handleDelete(product: ProductMaster) {
    const ok = window.confirm(
      `${product.model_name} 상품마스터를 삭제할까요?\n연결된 SKU가 있으면 삭제되지 않을 수 있습니다.`
    )
    if (!ok) return

    const { error } = await supabase
      .from('product_master')
      .delete()
      .eq('id', product.id)

    if (error) {
      alert(`삭제 실패\n\n${error.message}`)
      return
    }

    await fetchProducts()
  }

  function runSearch() {
    setCurrentPage(1)
    setSearchTerm(searchInput)
  }

  async function handleUploadExcel(file: File) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
    })

    const uploadRows = rows
      .map((row) => {
        const modelName = String(row.모델명 || row.model_name || '')
          .trim()
          .toUpperCase()
        if (!modelName) return null

        return {
          model_name: modelName,
          ...parseModelName(modelName),
          sale_price: parseNumber(String(row.판매가 || row.sale_price || '')),
          tag_price: parseNumber(String(row.TAG가 || row.tag_price || '')),
          cost_price: parseNumber(String(row.원가 || row.cost_price || '')),
          gender: String(row.성별 || row.gender || '').trim() || null,
          product_status:
            String(row.상태 || row.product_status || '').trim() || '운영중',
          status:
            String(row.상태 || row.product_status || '').trim() || '운영중',
          size_group:
            String(row.사이즈그룹 || row.size_group || '').trim() || null,
          note: String(row.비고 || row.note || '').trim() || null,
          updated_at: new Date().toISOString(),
        }
      })
      .filter(Boolean)

    if (uploadRows.length === 0) {
      alert('업로드 가능한 데이터가 없습니다.')
      return
    }

    const uniqueRows = Array.from(
      new Map(uploadRows.map((row) => [row!.model_name, row])).values()
    )

    setUploading(true)
    setUploadProgress({
      total: uniqueRows.length,
      processed: 0,
      success: 0,
      fail: 0,
      percent: 0,
    })

    const result = await batchUpsert({
      supabase,
      tableName: 'product_master',
      rows: uniqueRows,
      onConflict: 'model_name',
      chunkSize: 500,
      onProgress: setUploadProgress,
    })

    setUploading(false)
    alert(
      `상품마스터 업로드 완료\n\n성공 ${result.success.toLocaleString()}건\n실패 ${result.fail.toLocaleString()}건`
    )
    setCurrentPage(1)
    await fetchProducts()
  }

  async function downloadExcel() {
    const allRows: ProductMaster[] = []
    const chunkSize = 1000

    for (let from = 0; ; from += chunkSize) {
      let query = supabase
        .from('product_master_ops_summary')
        .select('*')
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('model_name', { ascending: true })
        .range(from, from + chunkSize - 1)

      query = applyFilters(query)
      const { data, error } = await query

      if (error) {
        alert(`엑셀 데이터 조회 실패\n\n${error.message}`)
        return
      }

      allRows.push(...((data || []) as ProductMaster[]))
      if (!data || data.length < chunkSize) break
    }

    const worksheet = XLSX.utils.json_to_sheet(
      allRows.map((item, index) => ({
        NO: index + 1,
        모델명: item.model_name,
        판매가: item.sale_price || 0,
        TAG가: item.tag_price || 0,
        원가: item.cost_price || 0,
        SKU수: item.sku_count || 0,
        색상종류: item.color_count || 0,
        OPS현재고: item.ops_stock_qty || 0,
        사이즈그룹: item.size_group || '',
        상태: item.product_status || item.status || '',
        성별: item.gender || '',
        비고: item.note || '',
      }))
    )
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '상품마스터')
    XLSX.writeFile(
      workbook,
      `상품마스터_${new Date().toISOString().slice(0, 10)}.xlsx`
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">상품정보 보완</h2>
            <p className="mt-1 text-sm text-gray-500">
              모델과 SKU는 OPS 재고에서 자동 생성됩니다. 가격·상태·성별·
              사이즈그룹을 직접 또는 엑셀로 보완하세요.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? '접기' : '직접 등록/수정'}
          </Button>
        </div>

        {showForm && (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Field label="모델명">
                <Input
                  value={form.model_name}
                  onChange={(event) =>
                    setForm({ ...form, model_name: event.target.value })
                  }
                  placeholder="A40TK022L3"
                  disabled={!!editingId}
                />
              </Field>
              <Field label="판매가">
                <Input
                  value={form.sale_price}
                  onChange={(event) =>
                    setForm({ ...form, sale_price: event.target.value })
                  }
                  inputMode="numeric"
                />
              </Field>
              <Field label="TAG가">
                <Input
                  value={form.tag_price}
                  onChange={(event) =>
                    setForm({ ...form, tag_price: event.target.value })
                  }
                  inputMode="numeric"
                />
              </Field>
              <Field label="원가">
                <Input
                  value={form.cost_price}
                  onChange={(event) =>
                    setForm({ ...form, cost_price: event.target.value })
                  }
                  inputMode="numeric"
                />
              </Field>
              <Field label="상품상태">
                <select
                  value={form.product_status}
                  onChange={(event) =>
                    setForm({ ...form, product_status: event.target.value })
                  }
                  className="h-10 w-full rounded-md border px-3 text-sm"
                >
                  <option value="운영중">운영중</option>
                  <option value="준비중">준비중</option>
                  <option value="중단">중단</option>
                  <option value="품절">품절</option>
                </select>
              </Field>
              <Field label="성별">
                <Input
                  value={form.gender}
                  onChange={(event) =>
                    setForm({ ...form, gender: event.target.value })
                  }
                  placeholder="남성/여성/공용"
                />
              </Field>
              <Field label="사이즈그룹">
                <select
                  value={form.size_group}
                  onChange={(event) =>
                    setForm({ ...form, size_group: event.target.value })
                  }
                  className="h-10 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">선택 안함</option>
                  {sizeGroups.map((group) => (
                    <option key={group.id} value={group.name}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="비고">
                <Input
                  value={form.note}
                  onChange={(event) =>
                    setForm({ ...form, note: event.target.value })
                  }
                />
              </Field>
            </div>

            <div className="mt-4 flex gap-2">
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {editingId ? '수정 저장' : '등록'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  취소
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">엑셀로 상품정보 보완</h2>
        <p className="mt-1 text-sm text-gray-500">
          헤더: 모델명, 판매가, TAG가, 원가, 상태, 성별, 사이즈그룹, 비고
        </p>
        <div className="mt-4">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleUploadExcel(file)
              event.target.value = ''
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
                {uploadProgress.total.toLocaleString()}건
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-gray-900">상품마스터 목록</h2>
            <p className="text-sm text-gray-500">
              총 {totalCount.toLocaleString()}개 · {fromNumber.toLocaleString()}–
              {toNumber.toLocaleString()}개 표시
            </p>
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setCurrentPage(1)
              }}
              className="h-10 rounded-md border px-3 text-sm"
            >
              <option value="ALL">전체상태</option>
              <option value="운영중">운영중</option>
              <option value="준비중">준비중</option>
              <option value="중단">중단</option>
              <option value="품절">품절</option>
            </select>
            <select
              value={priceFilter}
              onChange={(event) => {
                setPriceFilter(event.target.value)
                setCurrentPage(1)
              }}
              className="h-10 rounded-md border px-3 text-sm"
            >
              <option value="ALL">가격 전체</option>
              <option value="HAS_PRICE">가격 있음</option>
              <option value="NO_PRICE">가격 누락</option>
            </select>
            <select
              value={infoFilter}
              onChange={(event) => {
                setInfoFilter(event.target.value)
                setCurrentPage(1)
              }}
              className="h-10 rounded-md border px-3 text-sm"
            >
              <option value="ALL">보완상태 전체</option>
              <option value="MISSING">보완 필요</option>
              <option value="COMPLETE">보완 완료</option>
            </select>
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runSearch()
              }}
              placeholder="모델명/비고 검색"
              className="w-64"
            />
            <Button type="button" variant="outline" onClick={runSearch}>
              검색
            </Button>
            <Button type="button" variant="outline" onClick={downloadExcel}>
              엑셀
            </Button>
            <Button type="button" variant="outline" onClick={fetchProducts}>
              새로고침
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1340px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-center">NO</th>
                <th className="p-3 text-center">이미지</th>
                <th className="p-3 text-left">모델명</th>
                <th className="p-3 text-right">판매가</th>
                <th className="p-3 text-right">TAG가</th>
                <th className="p-3 text-right">원가</th>
                <th className="p-3 text-center">SKU</th>
                <th className="p-3 text-center">색상</th>
                <th className="p-3 text-right">OPS 현재고</th>
                <th className="p-3 text-center">사이즈그룹</th>
                <th className="p-3 text-center">상태</th>
                <th className="p-3 text-left">비고</th>
                <th className="sticky right-0 z-10 w-[150px] min-w-[150px] bg-gray-50 p-3 text-center">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-gray-500">
                    불러오는 중...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-gray-500">
                    조건에 맞는 상품이 없습니다.
                  </td>
                </tr>
              ) : (
                products.map((item, index) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="p-3 text-center">
                      {(currentPage - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td className="p-3 text-center">
                      {item.representative_image_url ? (
                        <img
                          src={item.representative_image_url}
                          alt={item.model_name}
                          className="mx-auto h-12 w-12 rounded border object-cover"
                        />
                      ) : (
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded border bg-gray-50 text-[10px] text-gray-400">
                          NO IMG
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-left font-medium">
                      <div>{item.model_name}</div>
                      {item.has_missing_info && (
                        <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                          정보 보완 필요
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {formatNumber(item.sale_price)}
                    </td>
                    <td className="p-3 text-right">
                      {formatNumber(item.tag_price)}
                    </td>
                    <td className="p-3 text-right">
                      {formatNumber(item.cost_price)}
                    </td>
                    <td className="p-3 text-center">
                      {formatNumber(item.sku_count)}
                    </td>
                    <td className="p-3 text-center">
                      {formatNumber(item.color_count)}
                    </td>
                    <td className="p-3 text-right font-semibold text-blue-700">
                      {formatNumber(item.ops_stock_qty)}
                    </td>
                    <td className="p-3 text-center">{item.size_group || '-'}</td>
                    <td className="p-3 text-center">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                        {item.product_status || item.status || '-'}
                      </span>
                    </td>
                    <td className="p-3 text-left">{item.note || '-'}</td>
                    <td className="sticky right-0 w-[150px] min-w-[150px] bg-white p-3">
                      <div className="flex flex-nowrap justify-center gap-2 whitespace-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(item)}
                        >
                          수정
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(item)}
                        >
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

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
