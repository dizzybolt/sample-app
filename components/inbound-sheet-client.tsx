'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Printer, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  InboundBatch,
  InboundBatchQuantity,
  InboundSizeQuantity,
  InboundStatus,
  OrderExtraRow,
  OrderSizeQuantity,
  PrintColumnHeader,
  PrintHeader,
  SampleEntry,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ImagePreviewDialog } from '@/components/image-preview-dialog'
import * as XLSX from 'xlsx'
import { Download } from 'lucide-react'
import { formatNumber } from '@/lib/format'

interface InboundSheetClientProps {
  date: string
  chinaCode: string
  initialSamples: SampleEntry[]
  orderQuantities: OrderSizeQuantity[]
  initialInboundQuantities: InboundSizeQuantity[]
  printHeader: PrintHeader | null
  columnHeaders: PrintColumnHeader[]
  orderExtraRows: OrderExtraRow[]
  inboundBatches: InboundBatch[]
  inboundBatchQuantities: InboundBatchQuantity[]
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function toKoreaDate(value?: string | null) {
  if (!value) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  return `${year}-${month}-${day}`
}

function getAutoInboundStatus(
  expectedQty: number,
  receivedQty: number
): InboundStatus {
  if (receivedQty === 0) return '입고누락'
  if (receivedQty < expectedQty) return '부분입고'
  if (receivedQty === expectedQty) return '입고완료'
  return '추가입고'
}

export function InboundSheetClient({
  date,
  chinaCode,
  initialSamples,
  orderQuantities,
  initialInboundQuantities,
  printHeader,
  columnHeaders,
  orderExtraRows,
  inboundBatches,
  inboundBatchQuantities,
}: InboundSheetClientProps) {
  const [samples, setSamples] = useState(initialSamples)
  const [inboundQuantities, setInboundQuantities] = useState(
    initialInboundQuantities
  )
  const [extraRows, setExtraRows] = useState(orderExtraRows)
  const [isSaving, setIsSaving] = useState(false)

  const [batches, setBatches] = useState<InboundBatch[]>(inboundBatches)
  const [batchQuantities, setBatchQuantities] =
    useState<InboundBatchQuantity[]>(inboundBatchQuantities)

  const [selectedBatchId, setSelectedBatchId] = useState(
    inboundBatches[0]?.id || ''
  )

  const representative = samples[0]

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId)

  const firstInboundDate =
    batches
      .map((batch) => batch.inbound_date)
      .filter(Boolean)
      .sort()[0] || '-'

  const latestInboundDate =
    batches
      .map((batch) => batch.inbound_date)
      .filter(Boolean)
      .sort()
      .at(-1) || '-'

  const [inboundDate, setInboundDate] = useState(
    toKoreaDate(representative?.inbound_at) || ''
  )

  const orderBaseDate =
    toKoreaDate(representative?.order_requested_at) ||
    toKoreaDate(representative?.ordered_at) ||
    '-'

  const sizeGroupName =
    representative?.size_group_name ||
    orderQuantities[0]?.size_group_name ||
    'FREE'

  const sizeLabels = useMemo(() => {
    const labels = orderQuantities
      .filter((item) => item.size_group_name === sizeGroupName)
      .map((item) => item.size_label)

    return Array.from(new Set(labels))
  }, [orderQuantities, sizeGroupName])

  const getColumnLabel = (key: string, fallback: string) => {
    return (
      columnHeaders.find((item) => item.column_key === key)?.column_label ||
      fallback
    )
  }

  const exportInboundExcel = () => {
    const rows = samples.map((sample) => {
      const row: Record<string, string | number> = {
        중국품번: sample.china_code || '',
        한국품번: sample.korea_code || '',
        색상코드: sample.color_code || '',
        색상명: sample.color_name || '',
      }

      sizeLabels.forEach((size) => {
        row[size] = getReceivedQty(sample.id, size)
      })

      row.입고합계 = getReceivedTotal(sample.id)
      row.입고상태 = sample.inbound_status || ''
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
        excelRow[size] = Number(
          row.inbound_size_quantities?.[size] ??
            row.size_quantities?.[size] ??
            0
        )
      })

      excelRow.입고합계 = getExtraReceivedTotal(row)
      excelRow.입고상태 = '추가행'
      excelRow.비고 = row.memo || ''
      excelRow.이미지URL = row.image_url || ''

      return excelRow
    })

    const worksheet = XLSX.utils.json_to_sheet([...rows, ...extraRowsForExcel])
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, '입고확인서')

    XLSX.writeFile(workbook, `입고확인서_${inboundDate || date}_${chinaCode}.xlsx`)
  }

  const getExpectedQty = (sampleId: string, sizeLabel: string) => {
    const found = orderQuantities.find(
      (item) =>
        item.sample_entry_id === sampleId &&
        item.size_group_name === sizeGroupName &&
        item.size_label === sizeLabel
    )

    return found?.qty || 0
  }

  const getReceivedQty = (sampleId: string, sizeLabel: string) => {
    const found = inboundQuantities.find(
      (item) =>
        item.sample_entry_id === sampleId &&
        item.size_group_name === sizeGroupName &&
        item.size_label === sizeLabel
    )

    if (found) return found.qty || 0

    return getExpectedQty(sampleId, sizeLabel)
  }

  const getBatchReceivedQty = (sampleId: string, sizeLabel: string) => {
    if (!selectedBatchId) return 0

    const found = batchQuantities.find(
      (item) =>
        item.batch_id === selectedBatchId &&
        item.sample_entry_id === sampleId &&
        item.size_group_name === sizeGroupName &&
        item.size_label === sizeLabel
    )

    return found?.qty || 0
  }

  const updateReceivedQty = (
    sample: SampleEntry,
    sizeLabel: string,
    value: string
  ) => {
    const nextQty = value === '' ? 0 : Number(value)

    setInboundQuantities((prev) => {
      const exists = prev.find(
        (item) =>
          item.sample_entry_id === sample.id &&
          item.size_group_name === sizeGroupName &&
          item.size_label === sizeLabel
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
          inbound_date: date,
          china_code: sample.china_code,
          color_code: sample.color_code,
          size_group_name: sizeGroupName,
          size_label: sizeLabel,
          qty: nextQty,
        },
      ]
    })
  }

  const updateBatchReceivedQty = (
    sample: SampleEntry,
    sizeLabel: string,
    value: string
  ) => {
    if (!selectedBatchId) {
      alert('먼저 입고 회차를 추가해 주세요.')
      return
    }

    const rawValue = value.replace(/,/g, '')
    const nextQty = rawValue === '' ? 0 : Number(rawValue)

    setBatchQuantities((prev) => {
      const exists = prev.find(
        (item) =>
          item.batch_id === selectedBatchId &&
          item.sample_entry_id === sample.id &&
          item.size_group_name === sizeGroupName &&
          item.size_label === sizeLabel
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
          batch_id: selectedBatchId,
          sample_entry_id: sample.id,
          china_code: sample.china_code,
          korea_code: sample.korea_code,
          color_code: sample.color_code,
          color_name: sample.color_name,
          size_group_name: sizeGroupName,
          size_label: sizeLabel,
          qty: nextQty,
          is_extra: false,
        },
      ]
    })
  }

  const updateBatchExtraReceivedQty = (
    row: OrderExtraRow,
    sizeLabel: string,
    value: string
  ) => {
    if (!selectedBatchId) {
      alert('먼저 입고 회차를 추가해 주세요.')
      return
    }

    const rawValue = value.replace(/,/g, '')
    const nextQty = rawValue === '' ? 0 : Number(rawValue)

    setBatchQuantities((prev) => {
      const exists = prev.find(
        (item) =>
          item.batch_id === selectedBatchId &&
          item.is_extra === true &&
          item.sample_entry_id === row.id &&
          item.size_group_name === sizeGroupName &&
          item.size_label === sizeLabel
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
          batch_id: selectedBatchId,
          sample_entry_id: row.id,
          china_code: chinaCode,
          korea_code: row.korea_code || null,
          color_code: row.color_code || null,
          color_name: row.color_name || null,
          size_group_name: sizeGroupName,
          size_label: sizeLabel,
          qty: nextQty,
          is_extra: true,
          memo: row.memo || null,
        },
      ]
    })
  }

  const getExpectedTotal = (sampleId: string) => {
    return sizeLabels.reduce(
      (sum, size) => sum + Number(getExpectedQty(sampleId, size) || 0),
      0
    )
  }

  const getReceivedTotal = (sampleId: string) => {
    return sizeLabels.reduce(
      (sum, size) => sum + Number(getReceivedQty(sampleId, size) || 0),
      0
    )
  }

  const getCumulativeReceivedTotal = (sampleId: string) => {
    return batchQuantities
      .filter((item) => item.sample_entry_id === sampleId)
      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  }

  const getCumulativeExtraReceivedTotal = (row: OrderExtraRow) => {
    return batchQuantities
      .filter(
        (item) =>
          item.is_extra === true &&
          item.sample_entry_id === row.id
      )
      .reduce((sum, item) => sum + Number(item.qty || 0), 0)
  }

  const totalCumulativeReceivedQty =
    samples.reduce(
      (sum, sample) => sum + getCumulativeReceivedTotal(sample.id),
      0
    ) +
    extraRows.reduce(
      (sum, row) => sum + getCumulativeExtraReceivedTotal(row),
      0
    )

  const getExtraExpectedQty = (row: OrderExtraRow, size: string) => {
    return Number(row.size_quantities?.[size] || 0)
  }

  const getExtraReceivedQty = (row: OrderExtraRow, size: string) => {
    return Number(
      row.inbound_size_quantities?.[size] ??
        row.size_quantities?.[size] ??
        0
    )
  }

  const getBatchExtraReceivedQty = (row: OrderExtraRow, sizeLabel: string) => {
    if (!selectedBatchId) return 0

    const found = batchQuantities.find(
      (item) =>
        item.batch_id === selectedBatchId &&
        item.is_extra === true &&
        item.sample_entry_id === row.id &&
        item.size_group_name === sizeGroupName &&
        item.size_label === sizeLabel
    )

    return found?.qty || 0
  }  

  const updateExtraReceivedQty = (
    rowId: string,
    size: string,
    value: string
  ) => {
    const qty = value === '' ? 0 : Number(value)

    setExtraRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              inbound_size_quantities: {
                ...(row.inbound_size_quantities || {}),
                [size]: qty,
              },
            }
          : row
      )
    )
  }

  const getExtraExpectedTotal = (row: OrderExtraRow) => {
    return sizeLabels.reduce(
      (sum, size) => sum + getExtraExpectedQty(row, size),
      0
    )
  }

  const getExtraReceivedTotal = (row: OrderExtraRow) => {
    return sizeLabels.reduce(
      (sum, size) => sum + getExtraReceivedQty(row, size),
      0
    )
  }

  const totalExpectedQty = useMemo(() => {
    const sampleTotal = samples.reduce(
      (sum, sample) => sum + getExpectedTotal(sample.id),
      0
    )

    const extraTotal = extraRows.reduce(
      (sum, row) => sum + getExtraExpectedTotal(row),
      0
    )

    return sampleTotal + extraTotal
  }, [samples, orderQuantities, extraRows, sizeLabels])

  const totalReceivedQty = useMemo(() => {
    const sampleTotal = samples.reduce(
      (sum, sample) => sum + getReceivedTotal(sample.id),
      0
    )

    const extraTotal = extraRows.reduce(
      (sum, row) => sum + getExtraReceivedTotal(row),
      0
    )

    return sampleTotal + extraTotal
  }, [samples, inboundQuantities, extraRows, sizeLabels])

  const saveExtraRows = async () => {
    const supabase = createClient()

    for (const row of extraRows) {
      const { error } = await supabase
        .from('order_extra_rows')
        .update({
          inbound_size_quantities:
            row.inbound_size_quantities || row.size_quantities || {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      if (error) {
        alert('추가 행 입고수량 저장에 실패했습니다.')
        return false
      }
    }

    return true
  }

  const handleAddBatch = async () => {
    setIsSaving(true)

    const supabase = createClient()

    const nextBatchNo =
      batches.length === 0
        ? 1
        : Math.max(...batches.map((batch) => batch.batch_no || 0)) + 1

    const { data, error } = await supabase
      .from('inbound_batches')
      .insert({
        order_date: date,
        china_code: chinaCode,
        batch_no: nextBatchNo,
        inbound_date: inboundDate || getToday(),
      })
      .select('*')
      .single()

    setIsSaving(false)

    if (error) {
      console.error(error)

      alert(
        `입고 회차 추가 실패\n\n${error.message}`
      )

      return
    }

    setBatches((prev) => [...prev, data])
    setSelectedBatchId(data.id)
    setInboundDate(data.inbound_date || getToday())
  }

  const handleDeleteBatch = async (batchId: string) => {
    const targetBatch = batches.find((batch) => batch.id === batchId)

    if (!targetBatch) return

    const ok = window.confirm(
      `${targetBatch.batch_no}차 입고 회차를 삭제할까요?\n저장된 해당 회차 수량도 함께 삭제됩니다.`
    )

    if (!ok) return

    setIsSaving(true)

    const supabase = createClient()

    const { error } = await supabase
      .from('inbound_batches')
      .delete()
      .eq('id', batchId)

    setIsSaving(false)

    if (error) {
      alert(`입고 회차 삭제 실패\n\n${error.message}`)
      return
    }

    const nextBatches = batches.filter((batch) => batch.id !== batchId)

    setBatches(nextBatches)

    setBatchQuantities((prev) =>
      prev.filter((item) => item.batch_id !== batchId)
    )

    const nextSelectedBatch = nextBatches[0]

    setSelectedBatchId(nextSelectedBatch?.id || '')
    setInboundDate(nextSelectedBatch?.inbound_date || '')
  }

  const handleSaveQty = async () => {
    if (!selectedBatchId) {
      alert('입고 회차를 먼저 추가해 주세요.')
      return
    }

    setIsSaving(true)

    const supabase = createClient()

    const selectedBatch = batches.find((batch) => batch.id === selectedBatchId)

    if (!selectedBatch) {
      setIsSaving(false)
      alert('선택된 입고 회차를 찾을 수 없습니다.')
      return
    }

    const finalInboundDate = inboundDate || getToday()

    const { error: batchUpdateError } = await supabase
      .from('inbound_batches')
      .update({
        inbound_date: finalInboundDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedBatchId)

    if (batchUpdateError) {
      setIsSaving(false)
      alert('입고 회차 날짜 저장에 실패했습니다.')
      return
    }

    await supabase
      .from('inbound_batch_quantities')
      .delete()
      .eq('batch_id', selectedBatchId)

    const rowsToInsert = batchQuantities
      .filter((item) => item.batch_id === selectedBatchId)
      .map((item) => ({
        batch_id: selectedBatchId,
        sample_entry_id: item.sample_entry_id || null,
        china_code: item.china_code || chinaCode,
        korea_code: item.korea_code || null,
        color_code: item.color_code || null,
        color_name: item.color_name || null,
        size_group_name: item.size_group_name || sizeGroupName,
        size_label: item.size_label || '',
        qty: Number(item.qty || 0),
        is_extra: item.is_extra || false,
        memo: item.memo || null,
      }))

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('inbound_batch_quantities')
        .insert(rowsToInsert)

      if (insertError) {
        setIsSaving(false)
        alert('회차별 입고수량 저장에 실패했습니다.')
        return
      }
    }

    const updatedBatches = batches.map((batch) =>
      batch.id === selectedBatchId
        ? {
            ...batch,
            inbound_date: finalInboundDate,
            updated_at: new Date().toISOString(),
          }
        : batch
    )

    setBatches(updatedBatches)

    for (const sample of samples) {
      const expectedTotal = getExpectedTotal(sample.id)
      const cumulativeTotal = getCumulativeReceivedTotal(sample.id)
      const nextStatus = getAutoInboundStatus(expectedTotal, cumulativeTotal)

      const { error: sampleError } = await supabase
        .from('sample_entries')
        .update({
          inbound_expected_qty: expectedTotal,
          inbound_received_qty: cumulativeTotal,
          inbound_status: nextStatus,
          inbound_at: finalInboundDate,
          size_group_name: sizeGroupName,
        })
        .eq('id', sample.id)

      if (sampleError) {
        setIsSaving(false)
        alert('누적 입고수량 저장에 실패했습니다.')
        return
      }
    }

    setSamples((prev) =>
      prev.map((sample) => {
        const expectedTotal = getExpectedTotal(sample.id)
        const cumulativeTotal = getCumulativeReceivedTotal(sample.id)

        return {
          ...sample,
          inbound_expected_qty: expectedTotal,
          inbound_received_qty: cumulativeTotal,
          inbound_status: getAutoInboundStatus(expectedTotal, cumulativeTotal),
          inbound_at: finalInboundDate,
          size_group_name: sizeGroupName,
        }
      })
    )

    setIsSaving(false)
    alert(`${selectedBatch.batch_no}차 입고수량이 저장되었습니다.`)
  }

  const handleDelay = async () => {
    const ok = window.confirm('이 입고건을 입고지연 처리할까요?')
    if (!ok) return

    setIsSaving(true)

    const supabase = createClient()

    for (const sample of samples) {
      const { error } = await supabase
        .from('sample_entries')
        .update({
          inbound_status: '입고지연',
        })
        .eq('id', sample.id)

      if (error) {
        setIsSaving(false)
        alert('입고지연 처리에 실패했습니다.')
        return
      }
    }

    setSamples((prev) =>
      prev.map((sample) => ({
        ...sample,
        inbound_status: '입고지연',
      }))
    )

    setIsSaving(false)
    alert('입고지연 처리되었습니다.')
  }

  const handleCompleteInbound = async () => {
    const ok = window.confirm(
      '입고완료 처리할까요?\n모든 회차의 누적 입고수량 기준으로 입고상태가 자동 저장됩니다.'
    )

    if (!ok) return

    await handleSaveQty()

    alert('입고완료 처리가 완료되었습니다.')
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="print-header rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-wide text-gray-900">
                {printHeader?.title || '입 고 확 인 서'}
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                {printHeader?.subtitle || 'INBOUND CONFIRMATION'}
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

              <p className="mt-2 text-gray-500">입고예정일</p>
              <p className="font-semibold">{inboundDate || '-'}</p>
            </div>
          </div>
        </div>

        <section className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">입고 상세</h1>
            <p className="mt-1 text-sm text-gray-500">
              발주서의 사이즈별 수량을 기준으로 실제 입고수량을 관리합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/inbound">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                입고관리
              </Button>
            </Link>

            <Button variant="outline" onClick={exportInboundExcel}>
              <Download className="mr-2 h-4 w-4" />
              엑셀 다운로드
            </Button>

            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              프린트
            </Button>

            <Button variant="outline" onClick={handleSaveQty} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              수량 저장
            </Button>

            <Button variant="outline" onClick={handleDelay} disabled={isSaving}>
              입고지연
            </Button>

            <Button
              onClick={handleCompleteInbound}
              disabled={isSaving || samples.length === 0}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              입고완료
            </Button>
          </div>
        </section>

        <Card className="print-break-inside-avoid">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-7">
              <div>
                <p className="text-xs text-gray-500">발주요청일</p>
                <p className="font-semibold">{orderBaseDate}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">입고예정일</p>
                <input
                  type="date"
                  value={inboundDate}
                  onChange={(e) => setInboundDate(e.target.value)}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm font-semibold"
                />
              </div>

              <div>
                <p className="text-xs text-gray-500">입고회차</p>

                <div className="mt-1 flex flex-wrap gap-1">
                  {batches.map((batch) => (
                    <div key={batch.id} className="flex overflow-hidden rounded-md border">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBatchId(batch.id)
                          setInboundDate(batch.inbound_date || '')
                        }}
                        className={`px-2 py-1 text-xs font-medium ${
                          selectedBatchId === batch.id
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-700'
                        }`}
                      >
                        {batch.batch_no}차
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBatch(batch.id)}
                        disabled={isSaving}
                        className="border-l bg-white px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                        title="회차 삭제"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddBatch}
                    disabled={isSaving}
                    className="rounded-md border bg-white px-2 py-1 text-xs font-medium text-gray-700"
                  >
                    + 회차
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500">중국품번</p>
                <p className="font-semibold">{chinaCode}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">입고상태</p>
                <Badge variant="outline">
                  {representative?.inbound_status || '입고대기'}
                </Badge>
              </div>

              <div>
                <p className="text-xs text-gray-500">입고예정수량</p>
                <p className="font-semibold">{formatNumber(totalExpectedQty)}개</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">누적입고수량</p>
                <p className="font-semibold">
                  {formatNumber(totalCumulativeReceivedQty)}개
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">최초입고일</p>
                <p className="font-semibold">{firstInboundDate}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">최근입고일</p>
                <p className="font-semibold">{latestInboundDate}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 print:p-0">
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
                      <th key={size} className="border px-2 py-2">
                        {size}
                      </th>
                    ))}

                    <th className="border px-3 py-2">
                      {getColumnLabel('total_qty', '입고합계')}
                    </th>
                    <th className="border px-3 py-2">
                      {getColumnLabel('status', '상태')}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {samples.map((sample) => (
                    <tr key={sample.id} className="border-b text-center">
                      <td className="border px-3 py-2">{sample.china_code}</td>
                      <td className="border px-3 py-2">
                        {sample.korea_code || '-'}
                      </td>
                      <td className="border px-3 py-2">
                        {sample.color_code || '-'}
                      </td>
                      <td className="border px-3 py-2">
                        {sample.color_name || '-'}
                      </td>

                      {sizeLabels.map((size) => (
                        <td key={size} className="border px-2 py-2">
                          <input
                            inputMode="numeric"
                            value={formatNumber(getBatchReceivedQty(sample.id, size))}
                            onChange={(e) => {
                              updateBatchReceivedQty(sample, size, e.target.value)
                            }}
                            className="mx-auto w-16 rounded-md border px-2 py-1 text-center print:border-0 print:bg-transparent"
                          />
                        </td>
                      ))}

                      <td className="border px-3 py-2 font-semibold">
                        {formatNumber(
                          sizeLabels.reduce(
                            (sum, size) => sum + getBatchReceivedQty(sample.id, size),
                            0
                          )
                        )}
                      </td>

                      <td className="border px-3 py-2">
                        {sample.inbound_status || '입고대기'}
                      </td>
                    </tr>
                  ))}

                  {extraRows.map((row) => (
                    <tr key={row.id} className="border-b bg-blue-50/40 text-center">
                      <td className="border px-3 py-2">{chinaCode}</td>
                      <td className="border px-3 py-2">
                        {row.korea_code || '-'}
                      </td>
                      <td className="border px-3 py-2">
                        {row.color_code || '-'}
                      </td>
                      <td className="border px-3 py-2">
                        {row.color_name || '-'}
                      </td>

                      {sizeLabels.map((size) => (
                        <td key={size} className="border px-2 py-2">
                          <input
                            inputMode="numeric"

                            value={formatNumber(getBatchExtraReceivedQty(row, size))}
                            onChange={(e) =>
                              updateBatchExtraReceivedQty(row, size, e.target.value)
                            }
                            className="mx-auto w-16 rounded-md border px-2 py-1 text-center print:border-0 print:bg-transparent"
                          />
                        </td>
                      ))}

                      <td className="border px-3 py-2 font-semibold">
                        {formatNumber(
                          sizeLabels.reduce(
                            (sum, size) => sum + getBatchExtraReceivedQty(row, size),
                            0
                          )
                        )}
                      </td>

                      <td className="border px-3 py-2">추가</td>
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
                      {formatNumber(totalReceivedQty)}
                    </td>
                    <td className="border px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="print-image-appendix">
          <CardContent className="space-y-4 p-5">
            <h2 className="font-semibold text-gray-900">이미지 별첨</h2>

            {samples.length === 0 ? (
              <p className="text-sm text-gray-500">표시할 샘플이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {samples.map((sample) => (
                  <div key={sample.id} className="print-image-item space-y-2">
                    <ImagePreviewDialog
                      src={sample.image_url}
                      alt={`${sample.china_code} ${sample.color_name || ''}`}
                    >
                      <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                        {sample.image_url ? (
                          <Image
                            src={sample.image_url}
                            alt={sample.china_code || ''}
                            fill
                            className="object-contain p-2"
                            sizes="160px"
                            quality={55}
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-gray-400">
                            이미지 없음
                          </div>
                        )}
                      </div>
                    </ImagePreviewDialog>

                    <div className="text-xs">
                      <p className="font-semibold text-red-500">
                        {sample.color_code || '-'}
                      </p>
                      <p className="truncate text-gray-500">
                        {sample.color_name || '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}