'use client'

import * as XLSX from 'xlsx'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  fetchOpsSalesRowsByRange,
  type OpsSalesRow,
} from '@/lib/ops/sales'
import {
  groupGiftShipments,
  type GiftModel,
} from '@/lib/ops/gifts'

type GiftForm = {
  model_name: string
  gift_name: string
  is_active: boolean
  note: string
}

const emptyForm: GiftForm = {
  model_name: '',
  gift_name: '',
  is_active: true,
  note: '',
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('ko-KR')
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getDefaultStartDate() {
  const date = new Date()
  date.setDate(date.getDate() - 6)
  return formatDate(date)
}

function getDefaultEndDate() {
  return formatDate(new Date())
}

export function GiftShipmentManager() {
  const supabase = createClient()

  const [giftModels, setGiftModels] = useState<GiftModel[]>([])
  const [salesRows, setSalesRows] = useState<OpsSalesRow[]>([])

  const [showModelForm, setShowModelForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState<GiftForm>(emptyForm)

  const [startDate, setStartDate] = useState(getDefaultStartDate())
  const [endDate, setEndDate] = useState(getDefaultEndDate())
  const [modelFilter, setModelFilter] = useState('ALL')
  const [shopFilter, setShopFilter] = useState('ALL')
  const [warehouseFilter, setWarehouseFilter] = useState('ALL')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchGiftModels()
  }, [])

  useEffect(() => {
    if (giftModels.length > 0) {
      fetchGiftShipments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giftModels])

  async function fetchGiftModels() {
    const { data, error } = await supabase
      .from('ops_gift_models')
      .select(
        'id, model_name, gift_name, is_active, note, created_at, updated_at'
      )
      .order('model_name', { ascending: true })

    if (error) {
      alert(`사은품 모델 조회 실패\n\n${error.message}`)
      return
    }

    setGiftModels((data || []) as GiftModel[])
  }

  async function fetchGiftShipments() {
    if (!startDate || !endDate) {
      alert('시작일과 종료일을 입력해 주세요.')
      return
    }

    if (startDate > endDate) {
      alert('시작일은 종료일보다 늦을 수 없습니다.')
      return
    }

    setLoading(true)

    try {
      const data = await fetchOpsSalesRowsByRange({
        startDate,
        endDate,
      })

      setSalesRows(data)
    } catch (error: any) {
      alert(`사은품 출고내역 조회 실패\n\n${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  function handleEdit(model: GiftModel) {
    setEditingId(model.id)
    setShowModelForm(true)

    setForm({
      model_name: model.model_name || '',
      gift_name: model.gift_name || '',
      is_active: model.is_active,
      note: model.note || '',
    })
  }

  async function handleSaveModel() {
    const modelName = form.model_name.trim().toUpperCase()

    if (!modelName) {
      alert('모델명을 입력해 주세요.')
      return
    }

    const payload = {
      model_name: modelName,
      gift_name: form.gift_name.trim() || null,
      is_active: form.is_active,
      note: form.note.trim() || null,
      updated_at: new Date().toISOString(),
    }

    setSaving(true)

    const { error } = editingId
      ? await supabase
          .from('ops_gift_models')
          .update(payload)
          .eq('id', editingId)
      : await supabase
          .from('ops_gift_models')
          .upsert(payload, {
            onConflict: 'model_name',
          })

    setSaving(false)

    if (error) {
      alert(`사은품 모델 저장 실패\n\n${error.message}`)
      return
    }

    resetForm()
    await fetchGiftModels()
  }

  async function handleDeleteModel(model: GiftModel) {
    const ok = window.confirm(
      `${model.model_name} 사은품 모델을 삭제할까요?\n\n삭제하면 주문통계 제외 대상에서도 즉시 해제됩니다.`
    )

    if (!ok) return

    const { error } = await supabase
      .from('ops_gift_models')
      .delete()
      .eq('id', model.id)

    if (error) {
      alert(`사은품 모델 삭제 실패\n\n${error.message}`)
      return
    }

    await fetchGiftModels()
  }

  const activeGiftModels = useMemo(
    () => giftModels.filter((item) => item.is_active),
    [giftModels]
  )

  const giftNameMap = useMemo(() => {
    const map = new Map<string, string>()

    giftModels.forEach((item) => {
      map.set(
        item.model_name.trim().toUpperCase(),
        item.gift_name || '사은품'
      )
    })

    return map
  }, [giftModels])

  const groupedRows = useMemo(() => {
    return groupGiftShipments(salesRows, activeGiftModels)
  }, [salesRows, activeGiftModels])

  const shopOptions = useMemo(() => {
    return Array.from(
      new Set(groupedRows.map((item) => item.shop).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [groupedRows])

  const warehouseOptions = useMemo(() => {
    return Array.from(
      new Set(groupedRows.map((item) => item.warehouse).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [groupedRows])

  const filteredRows = useMemo(() => {
    return groupedRows.filter((item) => {
      const matchModel =
        modelFilter === 'ALL' || item.model === modelFilter

      const matchShop =
        shopFilter === 'ALL' || item.shop === shopFilter

      const matchWarehouse =
        warehouseFilter === 'ALL' ||
        item.warehouse === warehouseFilter

      return matchModel && matchShop && matchWarehouse
    })
  }, [
    groupedRows,
    modelFilter,
    shopFilter,
    warehouseFilter,
  ])

  const totalQty = useMemo(
    () =>
      filteredRows.reduce(
        (sum, item) => sum + Number(item.qty || 0),
        0
      ),
    [filteredRows]
  )

  const modelCount = useMemo(
    () => new Set(filteredRows.map((item) => item.model)).size,
    [filteredRows]
  )

  const shopCount = useMemo(
    () => new Set(filteredRows.map((item) => item.shop)).size,
    [filteredRows]
  )

  const warehouseCount = useMemo(
    () => new Set(filteredRows.map((item) => item.warehouse)).size,
    [filteredRows]
  )

  function downloadExcel() {
    const rows = filteredRows.map((item, index) => ({
      NO: index + 1,
      출고일자: item.date,
      모델명: item.model,
      사은품명: giftNameMap.get(item.model) || '사은품',
      쇼핑몰: item.shop,
      출고지: item.warehouse,
      출고수량: item.qty,
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      '사은품출고내역'
    )

    XLSX.writeFile(
      workbook,
      `사은품출고내역_${startDate}_${endDate}.xlsx`
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              사은품 모델 관리
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              주문통계에서 제외하고 별도로 조회할 사은품 모델을 관리합니다.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setShowModelForm((previous) => !previous)
            }
          >
            {showModelForm ? '접기' : '등록/수정 열기'}
          </Button>
        </div>

        {showModelForm && (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Field label="모델명">
                <Input
                  value={form.model_name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      model_name: event.target.value.toUpperCase(),
                    })
                  }
                  placeholder="ZZZAC003L5"
                  disabled={Boolean(editingId)}
                />
              </Field>

              <Field label="사은품명">
                <Input
                  value={form.gift_name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      gift_name: event.target.value,
                    })
                  }
                  placeholder="파우치"
                />
              </Field>

              <Field label="사용 여부">
                <select
                  value={form.is_active ? 'true' : 'false'}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      is_active: event.target.value === 'true',
                    })
                  }
                  className="h-10 w-full rounded-md border px-3 text-sm"
                >
                  <option value="true">사용</option>
                  <option value="false">미사용</option>
                </select>
              </Field>

              <Field label="비고">
                <Input
                  value={form.note}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      note: event.target.value,
                    })
                  }
                />
              </Field>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                disabled={saving}
                onClick={handleSaveModel}
              >
                {editingId ? '수정 저장' : '등록'}
              </Button>

              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  취소
                </Button>
              )}
            </div>
          </>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-center">NO</th>
                <th className="p-3 text-left">모델명</th>
                <th className="p-3 text-left">사은품명</th>
                <th className="p-3 text-center">사용 여부</th>
                <th className="p-3 text-left">비고</th>
                <th className="p-3 text-center">등록일</th>
                <th className="w-[140px] p-3 text-right">관리</th>
              </tr>
            </thead>

            <tbody>
              {giftModels.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center text-gray-500"
                  >
                    등록된 사은품 모델이 없습니다.
                  </td>
                </tr>
              ) : (
                giftModels.map((item, index) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-0"
                  >
                    <td className="p-3 text-center">
                      {index + 1}
                    </td>

                    <td className="p-3 text-left font-medium">
                      {item.model_name}
                    </td>

                    <td className="p-3 text-left">
                      {item.gift_name || '-'}
                    </td>

                    <td className="p-3 text-center">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          item.is_active
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {item.is_active ? '사용' : '미사용'}
                      </span>
                    </td>

                    <td className="p-3 text-left">
                      {item.note || '-'}
                    </td>

                    <td className="p-3 text-center">
                      {item.created_at?.slice(0, 10) || '-'}
                    </td>

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
                          onClick={() => handleDeleteModel(item)}
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

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">
          사은품 출고 조회
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <Field label="시작일">
            <Input
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(event.target.value)
              }
            />
          </Field>

          <Field label="종료일">
            <Input
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(event.target.value)
              }
            />
          </Field>

          <Field label="사은품 모델">
            <select
              value={modelFilter}
              onChange={(event) =>
                setModelFilter(event.target.value)
              }
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="ALL">전체 모델</option>

              {activeGiftModels.map((item) => (
                <option
                  key={item.id}
                  value={item.model_name}
                >
                  {item.model_name}
                  {item.gift_name ? ` · ${item.gift_name}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="쇼핑몰">
            <select
              value={shopFilter}
              onChange={(event) =>
                setShopFilter(event.target.value)
              }
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="ALL">전체 쇼핑몰</option>

              {shopOptions.map((shop) => (
                <option key={shop} value={shop}>
                  {shop}
                </option>
              ))}
            </select>
          </Field>

          <Field label="출고지">
            <select
              value={warehouseFilter}
              onChange={(event) =>
                setWarehouseFilter(event.target.value)
              }
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="ALL">전체 출고지</option>

              {warehouseOptions.map((warehouse) => (
                <option key={warehouse} value={warehouse}>
                  {warehouse}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              disabled={loading}
              onClick={fetchGiftShipments}
            >
              {loading ? '조회 중...' : '조회'}
            </Button>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          조회 기준: {startDate} ~ {endDate}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="총 출고수량"
          value={`${formatNumber(totalQty)}개`}
        />

        <SummaryCard
          title="사은품 모델"
          value={`${formatNumber(modelCount)}개`}
        />

        <SummaryCard
          title="쇼핑몰"
          value={`${formatNumber(shopCount)}개`}
        />

        <SummaryCard
          title="출고지"
          value={`${formatNumber(warehouseCount)}개`}
        />
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              사은품 출고 목록
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              총 {filteredRows.length.toLocaleString()}건
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={downloadExcel}
          >
            엑셀 다운로드
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-center">NO</th>
                <th className="p-3 text-center">출고일자</th>
                <th className="p-3 text-left">모델명</th>
                <th className="p-3 text-left">사은품명</th>
                <th className="p-3 text-left">쇼핑몰</th>
                <th className="p-3 text-left">출고지</th>
                <th className="p-3 text-right">출고수량</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center text-gray-500"
                  >
                    조회된 사은품 출고내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRows.map((item, index) => (
                  <tr
                    key={[
                      item.date,
                      item.model,
                      item.shop,
                      item.warehouse,
                    ].join('__')}
                    className="border-b last:border-0"
                  >
                    <td className="p-3 text-center">
                      {index + 1}
                    </td>

                    <td className="p-3 text-center">
                      {item.date}
                    </td>

                    <td className="p-3 text-left font-medium">
                      {item.model}
                    </td>

                    <td className="p-3 text-left">
                      {giftNameMap.get(item.model) || '사은품'}
                    </td>

                    <td className="p-3 text-left">
                      {item.shop}
                    </td>

                    <td className="p-3 text-left">
                      {item.warehouse}
                    </td>

                    <td className="p-3 text-right font-semibold">
                      {formatNumber(item.qty)}
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
      <span className="text-xs text-gray-500">
        {label}
      </span>

      <div className="mt-1">
        {children}
      </div>
    </label>
  )
}

function SummaryCard({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  )
}