'use client'

import * as XLSX from 'xlsx'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { batchUpsert, type BulkProgress } from '@/lib/bulk-upload'

type RocketSkuPrice = {
  id: string
  sku: string
  rocket_sku_id: string | null
  model_name: string | null
  rocket_supply_price: number | null
  rocket_sale_price: number | null
  rocket_fee_rate: number | null
  note: string | null
  created_at: string | null
  updated_at: string | null
}

type ProductImage = {
  model_name: string
  image_url: string | null
}

type RocketSkuForm = {
  sku: string
  rocket_sku_id: string
  model_name: string
  rocket_supply_price: string
  rocket_sale_price: string
  rocket_fee_rate: string
  note: string
}

const emptyForm: RocketSkuForm = {
  sku: '',
  rocket_sku_id: '',
  model_name: '',
  rocket_supply_price: '',
  rocket_sale_price: '',
  rocket_fee_rate: '38',
  note: '',
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('ko-KR')
}

function parseNumber(value: string) {
  const parsed = Number(String(value || '').replaceAll(',', '').trim())
  return Number.isNaN(parsed) ? 0 : parsed
}

function getModelFromSku(sku: string) {
  return String(sku || '').split('_')[0] || ''
}

export function RocketSkuManager() {
  const supabase = createClient()

  const [items, setItems] = useState<RocketSkuPrice[]>([])
  const [images, setImages] = useState<ProductImage[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<BulkProgress | null>(null)

  const [form, setForm] = useState<RocketSkuForm>(emptyForm)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsSaving(true)

    const { data, error } = await supabase
      .from('rocket_sku_prices')
      .select('*')
      .order('rocket_sku_id', { ascending: true })

    setIsSaving(false)

    if (error) {
      alert(`로켓SKU 조회 실패\n\n${error.message}`)
      return
    }

    const nextItems = (data || []) as RocketSkuPrice[]
    setItems(nextItems)

    await fetchImages(nextItems)
  }

  async function fetchImages(nextItems: RocketSkuPrice[]) {
    const modelNames = Array.from(
      new Set(
        nextItems
          .map((item) => item.model_name || getModelFromSku(item.sku))
          .filter(Boolean)
      )
    )

    if (modelNames.length === 0) {
      setImages([])
      return
    }

    const { data, error } = await supabase
      .from('product_images')
      .select('model_name, image_url')
      .in('model_name', modelNames)

    if (error) {
      console.error(error)
      setImages([])
      return
    }

    setImages((data || []) as ProductImage[])
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  function handleEdit(item: RocketSkuPrice) {
    setEditingId(item.id)
    setShowForm(true)

    setForm({
      sku: item.sku || '',
      rocket_sku_id: item.rocket_sku_id || '',
      model_name: item.model_name || getModelFromSku(item.sku),
      rocket_supply_price: String(item.rocket_supply_price || ''),
      rocket_sale_price: String(item.rocket_sale_price || ''),
      rocket_fee_rate: String(item.rocket_fee_rate || 38),
      note: item.note || '',
    })
  }

  async function handleSave() {
    const sku = form.sku.trim().toUpperCase()

    if (!sku) {
      alert('SKU를 입력해 주세요.')
      return
    }

    const payload = {
      sku,
      rocket_sku_id: form.rocket_sku_id.trim() || null,
      model_name: form.model_name.trim() || getModelFromSku(sku),
      rocket_supply_price: parseNumber(form.rocket_supply_price),
      rocket_sale_price: parseNumber(form.rocket_sale_price),
      rocket_fee_rate: parseNumber(form.rocket_fee_rate),
      note: form.note.trim() || null,
      updated_at: new Date().toISOString(),
    }

    setIsSaving(true)

    const { error } = editingId
      ? await supabase.from('rocket_sku_prices').update(payload).eq('id', editingId)
      : await supabase.from('rocket_sku_prices').upsert(payload, {
          onConflict: 'sku',
        })

    setIsSaving(false)

    if (error) {
      alert(`저장 실패\n\n${error.message}`)
      return
    }

    resetForm()
    await fetchData()
  }

  async function handleDelete(item: RocketSkuPrice) {
    const ok = window.confirm(`${item.sku} 로켓SKU를 삭제할까요?`)
    if (!ok) return

    const { error } = await supabase
      .from('rocket_sku_prices')
      .delete()
      .eq('id', item.id)

    if (error) {
      alert(`삭제 실패\n\n${error.message}`)
      return
    }

    await fetchData()
  }

  function getImage(modelName?: string | null) {
    if (!modelName) return null
    return images.find((item) => item.model_name === modelName)?.image_url || null
  }

  const filteredItems = useMemo(() => {
    const keyword = searchTerm.trim().toUpperCase()

    const result = items.filter((item) => {
      if (!keyword) return true

      const sku = item.sku?.toUpperCase() || ''
      const rocketSkuId = item.rocket_sku_id?.toUpperCase() || ''
      const model = item.model_name?.toUpperCase() || ''
      const note = item.note?.toUpperCase() || ''

      return (
        sku.includes(keyword) ||
        rocketSkuId.includes(keyword) ||
        model.includes(keyword) ||
        note.includes(keyword)
      )
    })

    return result.sort((a, b) =>
      String(a.rocket_sku_id || '').localeCompare(
        String(b.rocket_sku_id || ''),
        'ko',
        { numeric: true }
      )
    )
  }, [items, searchTerm])

  function shouldShowModelImage(item: RocketSkuPrice, index: number) {
    const modelName = item.model_name || getModelFromSku(item.sku)

    const prevItem = filteredItems[index - 1]
    const prevModelName = prevItem
      ? prevItem.model_name || getModelFromSku(prevItem.sku)
      : null

    return modelName !== prevModelName
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
        const sku = String(row.SKU || row.sku || '').trim().toUpperCase()
        if (!sku) return null

        return {
          sku,
          rocket_sku_id:
            String(
              row['Rocket SKU ID'] ||
                row.RocketSKU_ID ||
                row.로켓SKU_ID ||
                row.로켓SKUID ||
                row.rocket_sku_id ||
                ''
            ).trim() || null,
          model_name:
            String(row.모델명 || row.model_name || '').trim() || getModelFromSku(sku),
          rocket_supply_price: parseNumber(
            String(row.로켓매입가 || row.rocket_supply_price || '')
          ),
          rocket_sale_price: parseNumber(
            String(row.로켓판매가 || row.rocket_sale_price || '')
          ),
          rocket_fee_rate: parseNumber(
            String(row.로켓수수료 || row.rocket_fee_rate || '')
          ),
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
      new Map(uploadRows.map((row) => [row!.sku, row])).values()
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
      tableName: 'rocket_sku_prices',
      rows: uniqueRows,
      onConflict: 'sku',
      chunkSize: 500,
      onProgress: setUploadProgress,
    })

    setUploading(false)

    alert(
      `로켓SKU 업로드 완료\n\n성공 ${result.success.toLocaleString()}건\n실패 ${result.fail.toLocaleString()}건`
    )

    await fetchData()
  }

  function downloadExcel() {
    const rows = filteredItems.map((item, index) => ({
      NO: index + 1,
      RocketSKU_ID: item.rocket_sku_id || '',
      SKU: item.sku,
      모델명: item.model_name || getModelFromSku(item.sku),
      로켓매입가: item.rocket_supply_price || 0,
      로켓판매가: item.rocket_sale_price || 0,
      로켓수수료: item.rocket_fee_rate || 0,
      등록일: item.created_at?.slice(0, 10) || '',
      수정일: item.updated_at?.slice(0, 10) || '',
      비고: item.note || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, '로켓SKU')
    XLSX.writeFile(workbook, `로켓SKU_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">로켓SKU 등록/수정</h2>
            <p className="mt-1 text-sm text-gray-500">
              로켓 전용 SKU ID, 매입가, 판매가, 수수료율을 관리합니다.
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
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Field label="SKU">
                <Input
                  value={form.sku}
                  onChange={(e) => {
                    const sku = e.target.value.toUpperCase()
                    setForm({
                      ...form,
                      sku,
                      model_name: form.model_name || getModelFromSku(sku),
                    })
                  }}
                  placeholder="A40TK022L3_02_F"
                  disabled={!!editingId}
                />
              </Field>

              <Field label="Rocket SKU ID">
                <Input
                  value={form.rocket_sku_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rocket_sku_id: e.target.value,
                    })
                  }
                  placeholder="쿠팡 로켓 전용 SKU ID"
                />
              </Field>

              <Field label="모델명">
                <Input
                  value={form.model_name}
                  onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                  placeholder="A40TK022L3"
                />
              </Field>

              <Field label="로켓매입가">
                <Input
                  value={form.rocket_supply_price}
                  onChange={(e) =>
                    setForm({ ...form, rocket_supply_price: e.target.value })
                  }
                  inputMode="numeric"
                />
              </Field>

              <Field label="로켓판매가">
                <Input
                  value={form.rocket_sale_price}
                  onChange={(e) =>
                    setForm({ ...form, rocket_sale_price: e.target.value })
                  }
                  inputMode="numeric"
                />
              </Field>

              <Field label="로켓수수료(%)">
                <Input
                  value={form.rocket_fee_rate}
                  onChange={(e) =>
                    setForm({ ...form, rocket_fee_rate: e.target.value })
                  }
                  inputMode="numeric"
                />
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
          헤더: Rocket SKU ID, SKU, 모델명, 로켓매입가, 로켓판매가, 로켓수수료, 비고
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
            <h2 className="font-semibold text-gray-900">로켓SKU 목록</h2>
            <p className="mt-1 text-sm text-gray-500">
              총 {filteredItems.length.toLocaleString()}건
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rocket SKU ID / SKU / 모델명 검색"
              className="w-80"
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
                <th className="p-3 text-left">Rocket SKU ID</th>
                <th className="p-3 text-left">SKU</th>
                <th className="p-3 text-left">모델명</th>
                <th className="p-3 text-right">로켓매입가</th>
                <th className="p-3 text-right">로켓판매가</th>
                <th className="p-3 text-right">수수료</th>
                <th className="p-3 text-center">등록일</th>
                <th className="p-3 text-left">비고</th>
                <th className="w-[140px] p-3 text-right">관리</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-gray-500">
                    등록된 로켓SKU가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const modelName = item.model_name || getModelFromSku(item.sku)
                  const imageUrl = getImage(modelName)
                  const showImage = shouldShowModelImage(item, index)

                  return (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="p-3 text-center">{index + 1}</td>

                      <td className="p-3 text-center">
                        {showImage ? (
                          imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={modelName}
                              className="mx-auto h-12 w-12 rounded border object-cover"
                            />
                          ) : (
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded border bg-gray-50 text-[10px] text-gray-400">
                              NO IMG
                            </div>
                          )
                        ) : null}
                      </td>

                      <td className="p-3 text-left">{item.rocket_sku_id || '-'}</td>
                      <td className="p-3 text-left font-medium">{item.sku}</td>
                      <td className="p-3 text-left">{modelName}</td>
                      <td className="p-3 text-right font-semibold text-blue-700">
                        {formatNumber(item.rocket_supply_price)}
                      </td>
                      <td className="p-3 text-right">
                        {formatNumber(item.rocket_sale_price)}
                      </td>
                      <td className="p-3 text-right">
                        {formatNumber(item.rocket_fee_rate)}%
                      </td>
                      <td className="p-3 text-center">
                        {item.created_at?.slice(0, 10) || '-'}
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