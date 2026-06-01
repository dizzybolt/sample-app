'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Printer, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { OrderSizeQuantity, PrintHeader, PrintColumnHeader, SampleEntry, SizeGroup, OrderExtraRow, OrderRequest, OrderRequestItem, } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImagePreviewDialog } from '@/components/image-preview-dialog'
import * as XLSX from 'xlsx'
import { Download } from 'lucide-react'
import { formatNumber } from '@/lib/format'

interface OrderSheetClientProps {
  date: string
  chinaCode: string
  initialSamples: SampleEntry[]
  sizeGroups: SizeGroup[]
  initialQuantities: OrderSizeQuantity[]
  initialOrderRequest: OrderRequest | null
  printHeader: PrintHeader | null
  printColumnHeaders: PrintColumnHeader[]
  initialExtraRows: OrderExtraRow[]
  initialOrderRequestItems: OrderRequestItem[]
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

export function OrderSheetClient({
  date,
  chinaCode,
  initialSamples,
  sizeGroups,
  initialQuantities,
  printHeader,
  printColumnHeaders,
  initialExtraRows,
  initialOrderRequest,
  initialOrderRequestItems,
}: OrderSheetClientProps) {
  const [samples, setSamples] = useState(initialSamples)
  const [quantities, setQuantities] =
    useState<OrderSizeQuantity[]>(initialQuantities)
  const [selectedSizeGroup, setSelectedSizeGroup] = useState(
    initialSamples[0]?.size_group_name || sizeGroups[0]?.name || ''
  )
  const [isSaving, setIsSaving] = useState(false)

  const selectedGroup = useMemo(() => {
    return sizeGroups.find((group) => group.name === selectedSizeGroup)
  }, [sizeGroups, selectedSizeGroup])

  const sizeLabels = selectedGroup?.sizes || []

  const representative = samples[0]
  const [extraRows, setExtraRows] = useState<OrderExtraRow[]>(initialExtraRows)
  const appendixRepresentative = samples[0]
  const appendixOtherSamples = samples.slice(1)

  const [orderRequestItems, setOrderRequestItems] = useState<
    (OrderRequestItem & { file?: File | null; previewUrl?: string | null })[]
  >(
    initialOrderRequestItems.map((item) => ({
      ...item,
      file: null,
      previewUrl: item.request_image_url || null,
    }))
  )

  const [showSampleNotes, setShowSampleNotes] = useState(true)

  const [requestMemo, setRequestMemo] = useState(
    initialOrderRequest?.request_memo || ''
  )

  const [requestImageUrl, setRequestImageUrl] = useState(
    initialOrderRequest?.request_image_url || ''
  )

  const [requestImageFile, setRequestImageFile] = useState<File | null>(null)

  const getColumnLabel = (key: string, fallback: string) => {
  return (
    printColumnHeaders.find((item) => item.column_key === key)?.column_label ||
    fallback
  )
}

  const exportOrderExcel = () => {
    const rows = samples.map((sample) => {
      const row: Record<string, string | number> = {
        중국품번: sample.china_code || '',
        한국품번: sample.korea_code || '',
        색상코드: sample.color_code || '',
        색상명: sample.color_name || '',
      }

      sizeLabels.forEach((size) => {
        row[size] = getQty(sample.id, size)
      })

      row.합계 = getSampleTotal(sample.id)
      row.상태 = sample.order_status || ''
      row.비고 = sample.note || ''
      row.이미지URL = sample.image_url || ''

      return row
    })

    const extraRowsForExcel = extraRows.map((row) => {
      const excelRow: Record<string, string | number> = {
        중국품번: chinaCode,
        한국품번: row.korea_code || '',
        색상코드: row.color_code || '',
        색상명: row.color_name || '',
      }

      sizeLabels.forEach((size) => {
        excelRow[size] = Number(row.size_quantities?.[size] || 0)
      })

      excelRow.합계 = getExtraTotal(row)
      excelRow.상태 = '추가행'
      excelRow.비고 = row.memo || ''
      excelRow.이미지URL = row.image_url || ''

      return excelRow
    })

    const worksheet = XLSX.utils.json_to_sheet([...rows, ...extraRowsForExcel])
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, '발주서')

    XLSX.writeFile(workbook, `발주서_${date}_${chinaCode}.xlsx`)
  }

  const exportOrderExcelWithImages = async () => {
    const rows = samples.flatMap((sample) =>
      sizeLabels.map((size) => ({
        이미지URL: sample.image_url || '',
        썸네일: '',
        중국품번: sample.china_code || '',
        한국품번: sample.korea_code || '',
        색상코드: sample.color_code || '',
        색상명: sample.color_name || '',
        사이즈: size,
        발주수량: getQty(sample.id, size),
        구분: '발주',
        비고: sample.note || sample.memo || '',
      }))
    )

    const extraRowsForExcel = extraRows.flatMap((row) =>
      sizeLabels.map((size) => ({
        이미지URL: row.image_url || '',
        썸네일: '',
        중국품번: chinaCode,
        한국품번: row.korea_code || '',
        색상코드: row.color_code || '',
        색상명: row.color_name || '',
        사이즈: size,
        발주수량: Number(row.size_quantities?.[size] || 0),
        구분: '추가행',
        비고: row.memo || '',
      }))
    )

    const templateRes = await fetch('/excel/order-sheet-template.xlsm')
    const templateBuffer = await templateRes.arrayBuffer()

    const workbook = XLSX.read(templateBuffer, {
      type: 'array',
      bookVBA: true,
    })

    const worksheetName = workbook.SheetNames[0]
    const worksheet = XLSX.utils.json_to_sheet([...rows, ...extraRowsForExcel])

    workbook.Sheets[worksheetName] = worksheet

    XLSX.writeFile(workbook, `발주서_${date}_${chinaCode}.xlsm`, {
      bookType: 'xlsm',
    })
  }

  const getQty = (sampleId: string, sizeLabel: string) => {
    const found = quantities.find(
      (item) =>
        item.sample_entry_id === sampleId &&
        item.size_label === sizeLabel &&
        item.size_group_name === selectedSizeGroup
    )

    return found?.qty || 0
  }

  const updateQty = (
    sample: SampleEntry,
    sizeLabel: string,
    value: string
  ) => {
    const nextQty = value === '' ? 0 : Number(value)

    setQuantities((prev) => {
      const exists = prev.find(
        (item) =>
          item.sample_entry_id === sample.id &&
          item.size_label === sizeLabel &&
          item.size_group_name === selectedSizeGroup
      )

      if (exists) {
        return prev.map((item) =>
          item.id === exists.id
            ? {
                ...item,
                qty: nextQty,
              }
            : item
        )
      }

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          sample_entry_id: sample.id,
          order_date: date,
          china_code: sample.china_code,
          color_code: sample.color_code,
          size_group_name: selectedSizeGroup,
          size_label: sizeLabel,
          qty: nextQty,
        },
      ]
    })
  }

  const getSampleTotal = (sampleId: string) => {
    return sizeLabels.reduce(
      (sum, size) => sum + Number(getQty(sampleId, size) || 0),
      0
    )
  }

  const getExtraQty = (row: OrderExtraRow, sizeLabel: string) => {
    return Number(row.size_quantities?.[sizeLabel] || 0)
  }

  const getExtraTotal = (row: OrderExtraRow) => {
    return sizeLabels.reduce(
      (sum, size) => sum + getExtraQty(row, size),
      0
    )
  }

  const updateExtraRow = (
    id: string,
    patch: Partial<OrderExtraRow>
  ) => {
    setExtraRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              ...patch,
            }
          : row
      )
    )
  }

  const updateExtraQty = (
    id: string,
    sizeLabel: string,
    value: string
  ) => {
    const qty = value === '' ? 0 : Number(value)

    setExtraRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              size_quantities: {
                ...(row.size_quantities || {}),
                [sizeLabel]: qty,
              },
            }
          : row
      )
    )
  }

  const addExtraRow = () => {
    setExtraRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        order_date: date,
        china_code: chinaCode,
        korea_code: '',
        color_code: '',
        color_name: '',
        memo: '',
        sort_order: prev.length + 1,
        size_quantities: {},
      },
    ])
  }

  const deleteExtraRow = (id: string) => {
    setExtraRows((prev) => prev.filter((row) => row.id !== id))
  }

  const totalOrderQty = useMemo(() => {
    const sampleTotal = samples.reduce(
      (sum, sample) => sum + getSampleTotal(sample.id),
      0
    )

    const extraTotal = extraRows.reduce(
      (sum, row) => sum + getExtraTotal(row),
      0
    )

    return sampleTotal + extraTotal
  }, [samples, quantities, extraRows, selectedSizeGroup, sizeLabels])

const saveExtraRows = async () => {
  const supabase = createClient()

  await supabase
    .from('order_extra_rows')
    .delete()
    .eq('order_date', date)
    .eq('china_code', chinaCode)

  const rowsToInsert = extraRows
    .filter(
      (row) =>
        row.korea_code ||
        row.color_code ||
        row.color_name ||
        row.memo ||
        getExtraTotal(row) > 0
    )
    .map((row, index) => ({
      order_date: date,
      china_code: chinaCode,
      korea_code: row.korea_code || null,
      color_code: row.color_code || null,
      color_name: row.color_name || null,
      memo: row.memo || null,
      sort_order: index + 1,
      size_quantities: row.size_quantities || {},
    }))

  if (rowsToInsert.length > 0) {
    const { error } = await supabase
      .from('order_extra_rows')
      .insert(rowsToInsert)

    if (error) {
      alert('추가 행 저장에 실패했습니다.')
      return false
    }
  }

  return true
}

  const uploadRequestImage = async () => {
    if (!requestImageFile) return requestImageUrl || null

    const formData = new FormData()
    formData.append('file', requestImageFile)
    formData.append('china_code', chinaCode || 'NOCHINA')
    formData.append('color_code', 'ORDER_REQUEST')

    const res = await fetch('https://sample-upload-api.onrender.com/upload-only', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()

    if (!res.ok || !data.success) {
      throw new Error(data.detail || data.message || '요청사항 이미지 업로드 실패')
    }

    return data.image_url || data.url
  }

  const handleSaveOrderRequest = async () => {
    setIsSaving(true)

    try {
      const uploadedImageUrl = await uploadRequestImage()
      const supabase = createClient()

      const payload = {
        order_date: date,
        china_code: chinaCode,
        request_memo: requestMemo.trim() || null,
        request_image_url: uploadedImageUrl || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('order_requests')
        .upsert(payload, {
          onConflict: 'order_date,china_code',
        })

      if (error) {
        throw error
      }

      setRequestImageUrl(uploadedImageUrl || '')
      setRequestImageFile(null)

      alert('발주 요청사항이 저장되었습니다.')
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : '발주 요청사항 저장에 실패했습니다.'
      )
    } finally {
      setIsSaving(false)
    }
  }

const addOrderRequestItem = () => {
  setOrderRequestItems((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      order_date: date,
      china_code: chinaCode,
      sort_order: prev.length + 1,
      request_memo: '',
      request_image_url: null,
      file: null,
      previewUrl: null,
    },
  ])
}

const updateOrderRequestItem = (
  id: string,
  patch: Partial<OrderRequestItem & { file?: File | null; previewUrl?: string | null }>
) => {
  setOrderRequestItems((prev) =>
    prev.map((item) =>
      item.id === id
        ? {
            ...item,
            ...patch,
          }
        : item
    )
  )
}

const removeOrderRequestItem = (id: string) => {
  setOrderRequestItems((prev) => prev.filter((item) => item.id !== id))
}

const uploadOrderRequestImage = async (
  item: OrderRequestItem & { file?: File | null }
) => {
  if (!item.file) {
    return item.request_image_url || null
  }

  const formData = new FormData()
  formData.append('file', item.file)
  formData.append('china_code', chinaCode || 'NOCHINA')
  formData.append('color_code', 'ORDER_REQUEST')

  const res = await fetch('https://sample-upload-api.onrender.com/upload-only', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()

  if (!res.ok || !data.success) {
    throw new Error(data.detail || data.message || '요청사항 이미지 업로드 실패')
  }

  return data.image_url || data.url
}

  const saveOrderRequestItems = async () => {
    setIsSaving(true)

    try {
      const supabase = createClient()

      await supabase
        .from('order_request_items')
        .delete()
        .eq('order_date', date)
        .eq('china_code', chinaCode)

      const rows = []

      for (const [index, item] of orderRequestItems.entries()) {
        const imageUrl = await uploadOrderRequestImage(item)

        if (
          !item.request_memo?.trim() &&
          !imageUrl &&
          !item.previewUrl
        ) {
          continue
        }

        rows.push({
          order_date: date,
          china_code: chinaCode,
          sort_order: index + 1,
          request_memo: item.request_memo || null,
          request_image_url: imageUrl || null,
          updated_at: new Date().toISOString(),
        })
      }

      if (rows.length > 0) {
        const { error } = await supabase.from('order_request_items').insert(rows)

        if (error) throw error
      }

      alert('발주 요청사항이 저장되었습니다.')
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : '발주 요청사항 저장에 실패했습니다.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveQty = async () => {
    setIsSaving(true)

    const supabase = createClient()

    for (const sample of samples) {
      const sampleTotal = getSampleTotal(sample.id)

      await supabase
        .from('order_size_quantities')
        .delete()
        .eq('sample_entry_id', sample.id)
        .eq('order_date', date)
        .eq('size_group_name', selectedSizeGroup)

      const rows = sizeLabels.map((size) => ({
        sample_entry_id: sample.id,
        order_date: date,
        china_code: sample.china_code,
        color_code: sample.color_code,
        size_group_name: selectedSizeGroup,
        size_label: size,
        qty: getQty(sample.id, size),
      }))

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('order_size_quantities')
          .insert(rows)

        if (insertError) {
          setIsSaving(false)
          alert('사이즈별 발주수량 저장에 실패했습니다.')
          return
        }
      }

      const { error: sampleError } = await supabase
        .from('sample_entries')
        .update({
          size_group_name: selectedSizeGroup,
          order_qty: sampleTotal,
        })
        .eq('id', sample.id)

      if (sampleError) {
        setIsSaving(false)
        alert('발주수량 합계 저장에 실패했습니다.')
        return
      }
    }

    setSamples((prev) =>
      prev.map((sample) => ({
        ...sample,
        size_group_name: selectedSizeGroup,
        order_qty: getSampleTotal(sample.id),
      }))
    )

    setIsSaving(false)
    const extraSaved = await saveExtraRows()

    if (!extraSaved) {
      setIsSaving(false)
      return
    }
    alert('발주수량이 저장되었습니다.')
  }

  const handleCompleteOrder = async () => {
    const ok = window.confirm(
      '이 발주서를 발주완료 처리할까요?\n발주일자는 오늘 날짜로 저장됩니다.'
    )

    if (!ok) return

    await handleSaveQty()

    setIsSaving(true)

    const supabase = createClient()
    const today = getToday()

    for (const sample of samples) {
      const sampleTotal = getSampleTotal(sample.id)

      const { error } = await supabase
        .from('sample_entries')
        .update({
          order_status: '발주완료',
          ordered_at: today,
          inbound_status: sample.inbound_status || '입고대기',
          inbound_expected_qty: sampleTotal,
          order_qty: sampleTotal,
          size_group_name: selectedSizeGroup,
        })
        .eq('id', sample.id)

      if (error) {
        setIsSaving(false)
        alert(`발주완료 처리 실패: ${sample.china_code}`)
        return
      }
    }

    setSamples((prev) =>
      prev.map((sample) => ({
        ...sample,
        order_status: '발주완료',
        ordered_at: today,
        inbound_status: sample.inbound_status || '입고대기',
        inbound_expected_qty: getSampleTotal(sample.id),
        order_qty: getSampleTotal(sample.id),
        size_group_name: selectedSizeGroup,
      }))
    )

    setIsSaving(false)
    alert('발주완료 처리되었습니다.')
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">

        <section className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">발주서</h1>
            <p className="mt-1 text-sm text-gray-500">
              중국품번 기준 발주서입니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/orders">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                발주관리
              </Button>
            </Link>
            {/*
            <Button variant="outline" onClick={exportOrderExcel}>
              <Download className="mr-2 h-4 w-4" />
              엑셀 다운로드
            </Button>
            */}
            <Button
              type="button"
              variant="outline"
              onClick={exportOrderExcelWithImages}
            >
              <Download className="mr-2 h-4 w-4" />
              엑셀 다운(이미지 포함)
            </Button>

            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              프린트
            </Button>

            <Button
              variant="outline"
              onClick={handleSaveQty}
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              수량 저장
            </Button>

            <Button
              onClick={handleCompleteOrder}
              disabled={isSaving || samples.length === 0}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              발주완료
            </Button>
          </div>
        </section>

      <div className="print-header rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-wide text-gray-900">
              {printHeader?.title || '발 주 서'}
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {printHeader?.subtitle || 'PURCHASE ORDER'}
            </p>

            {printHeader?.footer_memo && (
              <p className="mt-2 text-sm text-gray-500">
                {printHeader.footer_memo}
              </p>
            )}
          </div>

          <div className="text-right text-sm">
            {printHeader?.company_name && (
              <p className="font-semibold text-gray-900">
                {printHeader.company_name}
              </p>
            )}

            {printHeader?.company_info && (
              <p className="mt-1 text-gray-500">
                {printHeader.company_info}
              </p>
            )}

            <p className="mt-2 text-gray-500">발주요청일</p>
            <p className="font-semibold">{date}</p>
          </div>
        </div>
      </div>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-5">
              <div>
                <p className="text-xs text-gray-500">발주요청일</p>
                <p className="font-semibold">{date}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">중국품번</p>
                <p className="font-semibold">{chinaCode}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">발주상태</p>
                <Badge variant="outline">
                  {representative?.order_status || '발주대기'}
                </Badge>
              </div>

              <div>
                <p className="text-xs text-gray-500">총 발주수량</p>
                <p className="font-semibold">{formatNumber(totalOrderQty)}개</p>
              </div>
              <div className="no-print">
                <p className="text-xs text-gray-500">사이즈 구분</p>

                <div className="mt-1">
                  <Select
                    value={selectedSizeGroup}
                    onValueChange={setSelectedSizeGroup}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="사이즈 구분 선택" />
                    </SelectTrigger>

                    <SelectContent>
                      {sizeGroups.map((group) => (
                        <SelectItem key={group.id} value={group.name}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-100 text-center">
                    <th className="border px-3 py-2">
                      {getColumnLabel('china_code', '중국품번')}
                    </th>
                    <th className="border px-3 py-2">
                      {getColumnLabel('korea_code', '한국품번')}
                    </th>
                    <th className="border px-3 py-2">
                      {getColumnLabel('color_code', '색상코드')}
                    </th>
                    <th className="border px-3 py-2">
                      {getColumnLabel('color_name', '색상명')}
                    </th>

                    {sizeLabels.map((size) => (
                      <th key={size} className="border px-2 py-2 text-center">
                        {size}
                      </th>
                    ))}

                    <th className="border px-3 py-2">
                      {getColumnLabel('total_qty', '합계')}
                    </th>
                    <th className="border px-3 py-2">
                      {getColumnLabel('status', '상태')}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {samples.map((sample) => (
                    <tr key={sample.id} className="border-b">
                      <td className="border px-3 py-2 text-center">{sample.china_code}</td>
                      <td className="border px-3 py-2 text-center">
                        {sample.korea_code || '-'}
                      </td>
                      <td className="border px-3 py-2 text-center">
                        {sample.color_code || '-'}
                      </td>
                      <td className="border px-3 py-2 text-center">
                        {sample.color_name || '-'}
                      </td>

                      {sizeLabels.map((size) => (
                        <td key={size} className="border px-2 py-2 text-center">
                          <input
                            inputMode="numeric"
                            value={formatNumber(getQty(sample.id, size))}
                            onChange={(e) => {
                              const value = e.target.value.replace(/,/g, '')
                              updateQty(sample, size, e.target.value)
                            }}
                            className="mx-auto w-16 rounded-md border px-2 py-1 text-center print:border-0 print:bg-transparent"
                          />
                        </td>
                      ))}

                      <td className="border px-3 py-2 text-center font-semibold">
                        {formatNumber(getSampleTotal(sample.id))}
                      </td>

                      <td className="border px-3 py-2 text-center">
                        {sample.order_status || '발주대기'}
                      </td>
                    </tr>
                  ))}
                    {extraRows.map((row) => (
                      <tr key={row.id} className="border-b bg-blue-50/40">
                        <td className="border px-3 py-2 text-center">
                          {chinaCode}
                        </td>

                        <td className="border px-2 py-2">
                          <input
                            value={row.korea_code || ''}
                            onChange={(e) =>
                              updateExtraRow(row.id, {
                                korea_code: e.target.value,
                              })
                            }
                            className="w-full rounded-md border px-2 py-1 text-center"
                            placeholder="한국품번"
                          />
                        </td>

                        <td className="border px-2 py-2">
                          <input
                            value={row.color_code || ''}
                            onChange={(e) =>
                              updateExtraRow(row.id, {
                                color_code: e.target.value,
                              })
                            }
                            className="w-full rounded-md border px-2 py-1 text-center"
                            placeholder="색상코드"
                          />
                        </td>

                        <td className="border px-2 py-2">
                          <input
                            value={row.color_name || ''}
                            onChange={(e) =>
                              updateExtraRow(row.id, {
                                color_name: e.target.value,
                              })
                            }
                            className="w-full rounded-md border px-2 py-1 text-center"
                            placeholder="색상명/요청내용"
                          />
                        </td>

                        {sizeLabels.map((size) => (
                          <td key={size} className="border px-2 py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              value={getExtraQty(row, size)}
                              onChange={(e) =>
                                updateExtraQty(row.id, size, e.target.value)
                              }
                              className="mx-auto w-16 rounded-md border px-2 py-1 text-center print:border-0 print:bg-transparent"
                            />
                          </td>
                        ))}

                        <td className="border px-3 py-2 text-center font-semibold">
                          {formatNumber(getExtraTotal(row))}
                        </td>

                        <td className="border px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => deleteExtraRow(row.id)}
                            className="no-print text-xs text-red-500"
                          >
                            삭제
                          </button>
                          <span className="hidden print:inline">추가</span>
                        </td>
                      </tr>
                    ))}
                </tbody>

                <tfoot>
                  <tr className="bg-yellow-50 font-semibold">
                    <td
                      className="border px-3 py-2 text-right"
                      colSpan={4 + sizeLabels.length}
                    >
                      합계
                    </td>
                    <td className="border px-3 py-2 text-center">
                      {formatNumber(totalOrderQty)}
                    </td>
                    <td className="border px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="no-print flex justify-end">
          <Button variant="outline" onClick={addExtraRow}>
            추가 행 추가
          </Button>
        </div>

{/* 대표 이미지 */}
<Card className="print-main-image-page">
  <CardContent className="space-y-5 p-5">
    <h2 className="font-semibold text-gray-900">대표 이미지</h2>

    <div className="mx-auto print-main-image-box relative aspect-square overflow-hidden rounded-2xl border bg-gray-50">
      {appendixRepresentative?.image_url ? (
        <Image
          src={appendixRepresentative.image_url}
          alt={appendixRepresentative.china_code || ''}
          fill
          className="object-contain p-5"
          sizes="720px"
          quality={70}
          loading="eager"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
          이미지 없음
        </div>
      )}
    </div>

    <div className="text-sm">
      <p className="font-bold text-red-500">
        {appendixRepresentative?.color_code || '-'}
      </p>
      <p className="text-gray-500">
        {appendixRepresentative?.color_name || '-'}
      </p>
    </div>
  </CardContent>
</Card>

{/* 그 외 컬러 이미지 */}
<Card className="print-sub-images-page">
  <CardContent className="space-y-5 p-5">
    <h2 className="font-semibold text-gray-900">그 외 컬러 이미지</h2>

    {appendixOtherSamples.length === 0 ? (
      <p className="text-sm text-gray-500">추가 컬러 이미지가 없습니다.</p>
    ) : (
      <div className="print-sub-image-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {appendixOtherSamples.map((sample) => (
          <div key={sample.id} className="print-image-item space-y-2">
            <div className="print-sub-image-box relative aspect-square overflow-hidden rounded-xl border bg-gray-50">
              {sample.image_url ? (
                <Image
                  src={sample.image_url}
                  alt={sample.china_code || ''}
                  fill
                  className="object-contain p-2"
                  sizes="160px"
                  quality={60}
                  loading="eager"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">
                  이미지 없음
                </div>
              )}
            </div>

            <div className="text-xs">
              <p className="font-bold text-red-500">
                {sample.color_code || '-'}
              </p>
              <p className="text-gray-500">{sample.color_name || '-'}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>

      {showSampleNotes && (
        <Card className="print-break-inside-avoid">
          <CardContent className="space-y-4 p-5 print:space-y-2 print:p-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">비고</h2>
              </div>

              <button
                type="button"
                onClick={() => setShowSampleNotes(false)}
                className="no-print rounded-md border bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
              >
                샘플 비고 OFF
              </button>
            </div>

            <div className="space-y-3">
              {samples
                .filter((sample) => sample.memo || sample.note)
                .map((sample) => (
                  <div
                    key={sample.id}
                    className="rounded-xl border bg-gray-50 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-700">
                        {sample.color_code || '-'}
                      </span>

                      <span className="text-sm font-medium text-gray-900">
                        {sample.color_name || '-'}
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                      {sample.memo || sample.note}
                    </p>
                  </div>
                ))}

              {extraRows
                .filter((row) => row.memo)
                .map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-dashed bg-gray-50 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-700">
                        추가행
                      </span>

                      <span className="text-sm font-medium text-gray-900">
                        {row.color_code || '-'} / {row.color_name || '-'}
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                      {row.memo}
                    </p>
                  </div>
                ))}

              {samples.filter((sample) => sample.memo || sample.note).length ===
                0 &&
                extraRows.filter((row) => row.memo).length === 0 && (
                  <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                    등록된 비고가 없습니다.
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      )}

        <Card className="print-break-inside-avoid">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">발주 요청사항</h2>
              </div>

              <div className="no-print grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              {!showSampleNotes && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSampleNotes(true)}
                >
                  샘플 비고 ON
                </Button>
              )}
                <Button type="button" variant="outline" onClick={addOrderRequestItem}>
                  요청 추가
                </Button>

                <Button
                  type="button"
                  onClick={saveOrderRequestItems}
                  disabled={isSaving}
                >
                  저장
                </Button>
              </div>
            </div>

            {orderRequestItems.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                등록된 요청사항이 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {orderRequestItems.map((item, index) => {
                  const hasImage = Boolean(item.previewUrl || item.request_image_url)

                  return (
                    <div
                      key={item.id}
                      className={`grid gap-4 rounded-xl border bg-white p-4 print:break-inside-avoid print:p-2 ${
                        hasImage
                          ? 'lg:grid-cols-[480px_1fr_auto] print:grid-cols-[220px_1fr]'
                          : 'lg:grid-cols-[1fr_auto] print:grid-cols-1'
                      }`}
                    >
                      {hasImage && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700 print:hidden">
                            이미지 {index + 1}
                          </p>

                          <input
                            id={`order-request-image-${item.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return

                              updateOrderRequestItem(item.id, {
                                file,
                                previewUrl: URL.createObjectURL(file),
                              })
                            }}
                          />

                          <div className="relative w-full max-w-[480px]">
                            <ImagePreviewDialog
                              src={item.previewUrl || item.request_image_url}
                              alt={`${chinaCode} 요청사항 ${index + 1}`}
                            >
                              <div className="relative aspect-square overflow-hidden rounded-xl border bg-gray-50 print:h-56 print:w-56 print:rounded-md">
                                <img
                                  src={item.previewUrl || item.request_image_url || ''}
                                  alt={`${chinaCode} 요청사항 ${index + 1}`}
                                  className="h-full w-full object-contain p-2 print:p-1"
                                />
                              </div>
                            </ImagePreviewDialog>

                            <button
                              type="button"
                              onClick={() =>
                                updateOrderRequestItem(item.id, {
                                  file: null,
                                  previewUrl: null,
                                  request_image_url: null,
                                })
                              }
                              className="no-print absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold text-red-500 shadow ring-1 ring-gray-200 hover:bg-red-50"
                              aria-label="요청사항 이미지 제거"
                            >
                              ×
                            </button>
                          </div>

                          <label
                            htmlFor={`order-request-image-${item.id}`}
                            className="no-print inline-block cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900"
                          >
                            이미지 선택
                          </label>
                        </div>
                      )}

                      {!hasImage && (
                        <input
                          id={`order-request-image-${item.id}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return

                            updateOrderRequestItem(item.id, {
                              file,
                              previewUrl: URL.createObjectURL(file),
                            })
                          }}
                        />
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-700">
                            요청사항 {index + 1}
                          </p>

                          {!hasImage && (
                            <label
                              htmlFor={`order-request-image-${item.id}`}
                              className="no-print cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900"
                            >
                              이미지 추가
                            </label>
                          )}
                        </div>

                        <textarea
                          value={item.request_memo || ''}
                          onChange={(e) =>
                            updateOrderRequestItem(item.id, {
                              request_memo: e.target.value,
                            })
                          }
                          rows={hasImage ? 5 : 3}
                          placeholder="예: 컬러 변경, 자수 위치 변경, 원단 수정 요청 등을 입력하세요."
                          className="no-print w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                        />

                        <div className="hidden whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-sm text-gray-700 print:block print:bg-white print:p-0">
                          {item.request_memo || '-'}
                        </div>
                      </div>

                      <div className="no-print flex items-start justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => removeOrderRequestItem(item.id)}
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  )
                })}

              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </main>
  )
}