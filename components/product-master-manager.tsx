'use client'

import * as XLSX from 'xlsx'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { batchUpsert, type BulkProgress } from '@/lib/bulk-upload'

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
}

type SkuMapping = {
  id: string
  sku: string
  model_name: string
  color_code: string | number | null
  color_name?: string | null
}

type ProductImage = {
  id: string
  model_name: string
  image_url: string | null
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
  const value = modelName.trim()

  return {
    brand_code: value.slice(0, 3) || null,
    category_code: value.slice(3, 5) || null,
    seq_no: Number(value.slice(5, 8)) || 0,
    year_code: value.slice(8, 9) || null,
    season_code: value.slice(9, 10) || null,
  }
}

export function ProductMasterManager() {
  const supabase = createClient()

  const [products, setProducts] = useState<ProductMaster[]>([])
  const [skuMappings, setSkuMappings] = useState<SkuMapping[]>([])
  const [productImages, setProductImages] = useState<ProductImage[]>([])
  const [sizeGroups, setSizeGroups] = useState<SizeGroup[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priceFilter, setPriceFilter] = useState('ALL')
  const [showForm, setShowForm] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
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

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsSaving(true)

    const [productRes, mappingRes, imageRes, sizeGroupRes] = await Promise.all([
      supabase
        .from('product_master')
        .select('*')
        .order('model_name', { ascending: true }),

      supabase
        .from('sku_mappings')
        .select('id, sku, model_name, color_code, color_name'),

      supabase
        .from('product_images')
        .select('id, model_name, image_url'),

      supabase
        .from('size_groups')
        .select('id, name')
        .order('name', { ascending: true }),
    ])

    setIsSaving(false)

    if (productRes.error) {
      alert(`상품마스터 조회 실패\n\n${productRes.error.message}`)
      return
    }

    if (mappingRes.error) console.error(mappingRes.error)
    if (imageRes.error) console.error(imageRes.error)
    if (sizeGroupRes.error) console.error(sizeGroupRes.error)

    setProducts((productRes.data || []) as ProductMaster[])
    setSkuMappings((mappingRes.data || []) as SkuMapping[])
    setProductImages((imageRes.data || []) as ProductImage[])
    setSizeGroups((sizeGroupRes.data || []) as SizeGroup[])
  }

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
  }

  async function handleSave() {
    const modelName = form.model_name.trim()

    if (!modelName) {
      alert('모델명을 입력해 주세요.')
      return
    }

    const parsed = parseModelName(modelName)

    const payload = {
      model_name: modelName,
      ...parsed,
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

    alert('상품마스터가 저장되었습니다.')
    resetForm()
    await fetchData()
  }

  async function handleDelete(product: ProductMaster) {
    const ok = window.confirm(`${product.model_name} 상품마스터를 삭제할까요?`)
    if (!ok) return

    const { error } = await supabase
      .from('product_master')
      .delete()
      .eq('id', product.id)

    if (error) {
      alert(`삭제 실패\n\n${error.message}`)
      return
    }

    await fetchData()
  }

  function getProductImage(modelName?: string | null) {
    if (!modelName) return null
    return productImages.find((item) => item.model_name === modelName)?.image_url || null
  }

  function getModelColorCount(modelName: string): number | string {
    const colors = skuMappings
      .filter((item) => item.model_name === modelName)
      .map((item) => String(item.color_code || '').padStart(2, '0'))
      .filter(Boolean);

    const count = new Set(colors).size;

    // 카운트가 0이면 "확인불가" 반환, 아니면 카운트 반환
    return count === 0 ? "SKU미등록" : count;
  }

  const filteredProducts = useMemo(() => {
    const keyword = searchTerm.trim().toUpperCase()

    return products.filter((item) => {
      const model = item.model_name?.toUpperCase() || ''
      const status = item.product_status || item.status || ''
      const note = item.note?.toUpperCase() || ''

      const matchKeyword =
        !keyword ||
        model.includes(keyword) ||
        status.toUpperCase().includes(keyword) ||
        note.includes(keyword)

      const matchStatus = statusFilter === 'ALL' || status === statusFilter

      const hasPrice =
        Number(item.sale_price || 0) > 0 ||
        Number(item.tag_price || 0) > 0 ||
        Number(item.cost_price || 0) > 0

      const matchPrice =
        priceFilter === 'ALL' ||
        (priceFilter === 'HAS_PRICE' && hasPrice) ||
        (priceFilter === 'NO_PRICE' && !hasPrice)

      return matchKeyword && matchStatus && matchPrice
    })
  }, [products, searchTerm, statusFilter, priceFilter])

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
        const modelName = String(row.모델명 || row.model_name || '').trim()
        if (!modelName) return null

        const parsed = parseModelName(modelName)

        return {
          model_name: modelName,
          ...parsed,
          sale_price: parseNumber(String(row.판매가 || row.sale_price || '')),
          tag_price: parseNumber(String(row.TAG가 || row.tag_price || '')),
          cost_price: parseNumber(String(row.원가 || row.cost_price || '')),
          gender: String(row.성별 || row.gender || '').trim() || null,
          product_status:
            String(row.상태 || row.product_status || '').trim() || '운영중',
          status: String(row.상태 || row.product_status || '').trim() || '운영중',
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

    await fetchData()
  }

  function downloadExcel() {
    const rows = filteredProducts.map((item, index) => ({
      NO: index + 1,
      모델명: item.model_name,
      판매가: item.sale_price || 0,
      TAG가: item.tag_price || 0,
      원가: item.cost_price || 0,
      색상종류: getModelColorCount(item.model_name),
      사이즈그룹: item.size_group || '',
      상태: item.product_status || item.status || '',
      성별: item.gender || '',
      비고: item.note || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, '상품마스터')
    XLSX.writeFile(workbook, `상품마스터_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">상품 기준정보 등록/수정</h2>
            <p className="mt-1 text-sm text-gray-500">
              모델 기준 가격, 색상/사이즈 기준정보를 관리합니다.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? '접기' : '등록/수정 열기'}
          </Button>
        </div>

        {showForm && (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Field label="모델명">
                <Input
                  value={form.model_name}
                  onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                  placeholder="A40TK022L3"
                  disabled={!!editingId}
                />
              </Field>

              <Field label="판매가">
                <Input
                  value={form.sale_price}
                  onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                  inputMode="numeric"
                />
              </Field>

              <Field label="TAG가">
                <Input
                  value={form.tag_price}
                  onChange={(e) => setForm({ ...form, tag_price: e.target.value })}
                  inputMode="numeric"
                />
              </Field>

              <Field label="원가">
                <Input
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  inputMode="numeric"
                />
              </Field>

              <Field label="상품상태">
                <select
                  value={form.product_status}
                  onChange={(e) =>
                    setForm({ ...form, product_status: e.target.value })
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
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  placeholder="남성/여성/공용"
                />
              </Field>

              <Field label="사이즈그룹">
                <select
                  value={form.size_group}
                  onChange={(e) => setForm({ ...form, size_group: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
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
        <h2 className="font-semibold text-gray-900">엑셀 업로드</h2>
        <p className="mt-1 text-sm text-gray-500">
          헤더: 모델명, 판매가, TAG가, 원가, 상태, 성별, 사이즈그룹, 비고
        </p>

        <div className="mt-4">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={uploading}
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
          <div>
            <h2 className="font-semibold text-gray-900">상품마스터 목록</h2>
            <p className="mt-1 text-sm text-gray-500">
              총 {filteredProducts.length.toLocaleString()}건
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              onChange={(e) => setPriceFilter(e.target.value)}
              className="h-10 rounded-md border px-3 text-sm"
            >
              <option value="ALL">가격 전체</option>
              <option value="HAS_PRICE">가격 있음</option>
              <option value="NO_PRICE">가격 없음</option>
            </select>

            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="모델명/상태/비고 검색"
              className="w-72"
            />

            <Button type="button" variant="outline" onClick={downloadExcel}>
              엑셀
            </Button>

            <Button type="button" variant="outline" onClick={fetchData}>
              새로고침
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-center">NO</th>
                <th className="p-3 text-center">이미지</th>
                <th className="p-3 text-left">모델명</th>
                <th className="p-3 text-right">판매가</th>
                <th className="p-3 text-right">TAG가</th>
                <th className="p-3 text-right">원가</th>
                <th className="p-3 text-center">색상종류</th>
                <th className="p-3 text-center">사이즈그룹</th>
                <th className="p-3 text-center">상태</th>
                <th className="p-3 text-left">비고</th>
                <th className="w-[140px] p-3 text-right">관리</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-gray-500">
                    등록된 상품마스터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((item, index) => {
                  const imageUrl = getProductImage(item.model_name)

                  return (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="p-3 text-center">{index + 1}</td>

                      <td className="p-3 text-center">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.model_name}
                            className="mx-auto h-12 w-12 rounded border object-cover"
                          />
                        ) : (
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded border bg-gray-50 text-[10px] text-gray-400">
                            NO IMG
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-left font-medium">{item.model_name}</td>
                      <td className="p-3 text-right">{formatNumber(item.sale_price)}</td>
                      <td className="p-3 text-right">{formatNumber(item.tag_price)}</td>
                      <td className="p-3 text-right">{formatNumber(item.cost_price)}</td>
                      <td className="p-3 text-center">
                        {formatNumber(getModelColorCount(item.model_name))}
                      </td>
                      <td className="p-3 text-center">{item.size_group || '-'}</td>
                      <td className="p-3 text-center">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                          {item.product_status || item.status || '-'}
                        </span>
                      </td>
                      <td className="p-3 text-left">{item.note || '-'}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
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
                  )
                })
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