'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Printer, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  InboundSizeQuantity,
  InboundStatus,
  OrderSizeQuantity,
  SampleEntry,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface InboundSheetClientProps {
  date: string
  chinaCode: string
  initialSamples: SampleEntry[]
  orderQuantities: OrderSizeQuantity[]
  initialInboundQuantities: InboundSizeQuantity[]
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
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
}: InboundSheetClientProps) {
  const [samples, setSamples] = useState(initialSamples)
  const [inboundQuantities, setInboundQuantities] = useState(
    initialInboundQuantities
  )
  const [isSaving, setIsSaving] = useState(false)

  const sizeGroupName =
    samples[0]?.size_group_name ||
    orderQuantities[0]?.size_group_name ||
    'FREE'

  const sizeLabels = useMemo(() => {
    const labels = orderQuantities
      .filter((item) => item.size_group_name === sizeGroupName)
      .map((item) => item.size_label)

    return Array.from(new Set(labels))
  }, [orderQuantities, sizeGroupName])

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

  const totalExpectedQty = useMemo(() => {
    return samples.reduce(
      (sum, sample) => sum + getExpectedTotal(sample.id),
      0
    )
  }, [samples, orderQuantities, sizeLabels])

  const totalReceivedQty = useMemo(() => {
    return samples.reduce(
      (sum, sample) => sum + getReceivedTotal(sample.id),
      0
    )
  }, [samples, inboundQuantities, sizeLabels])

  const representative = samples[0]

  const handleSaveQty = async () => {
    setIsSaving(true)

    const supabase = createClient()

    for (const sample of samples) {
      const expectedTotal = getExpectedTotal(sample.id)
      const receivedTotal = getReceivedTotal(sample.id)
      const nextStatus = getAutoInboundStatus(expectedTotal, receivedTotal)

      await supabase
        .from('inbound_size_quantities')
        .delete()
        .eq('sample_entry_id', sample.id)
        .eq('inbound_date', date)
        .eq('size_group_name', sizeGroupName)

      const rows = sizeLabels.map((size) => ({
        sample_entry_id: sample.id,
        inbound_date: date,
        china_code: sample.china_code,
        color_code: sample.color_code,
        size_group_name: sizeGroupName,
        size_label: size,
        qty: getReceivedQty(sample.id, size),
      }))

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('inbound_size_quantities')
          .insert(rows)

        if (insertError) {
          setIsSaving(false)
          alert('사이즈별 입고수량 저장에 실패했습니다.')
          return
        }
      }

      const { error: sampleError } = await supabase
        .from('sample_entries')
        .update({
          inbound_expected_qty: expectedTotal,
          inbound_received_qty: receivedTotal,
          inbound_status: nextStatus,
          size_group_name: sizeGroupName,
        })
        .eq('id', sample.id)

      if (sampleError) {
        setIsSaving(false)
        alert('입고수량 합계 저장에 실패했습니다.')
        return
      }
    }

    setSamples((prev) =>
      prev.map((sample) => ({
        ...sample,
        inbound_expected_qty: getExpectedTotal(sample.id),
        inbound_received_qty: getReceivedTotal(sample.id),
        inbound_status: getAutoInboundStatus(
          getExpectedTotal(sample.id),
          getReceivedTotal(sample.id)
        ),
        size_group_name: sizeGroupName,
      }))
    )

    setIsSaving(false)
    alert('입고수량이 저장되었습니다.')
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
      '입고완료 처리할까요?\n실제입고수량 기준으로 입고상태가 자동 저장됩니다.'
    )

    if (!ok) return

    await handleSaveQty()

    setIsSaving(true)

    const supabase = createClient()
    const today = getToday()

    for (const sample of samples) {
      const expectedTotal = getExpectedTotal(sample.id)
      const receivedTotal = getReceivedTotal(sample.id)
      const nextStatus = getAutoInboundStatus(expectedTotal, receivedTotal)

      const { error } = await supabase
        .from('sample_entries')
        .update({
          inbound_expected_qty: expectedTotal,
          inbound_received_qty: receivedTotal,
          inbound_status: nextStatus,
          inbound_at: today,
          size_group_name: sizeGroupName,
        })
        .eq('id', sample.id)

      if (error) {
        setIsSaving(false)
        alert('입고완료 처리에 실패했습니다.')
        return
      }
    }

    setSamples((prev) =>
      prev.map((sample) => ({
        ...sample,
        inbound_expected_qty: getExpectedTotal(sample.id),
        inbound_received_qty: getReceivedTotal(sample.id),
        inbound_status: getAutoInboundStatus(
          getExpectedTotal(sample.id),
          getReceivedTotal(sample.id)
        ),
        inbound_at: today,
        size_group_name: sizeGroupName,
      }))
    )

    setIsSaving(false)
    alert('입고 처리되었습니다.')
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
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

            <Button onClick={handleCompleteInbound} disabled={isSaving || samples.length === 0}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              입고완료
            </Button>
          </div>
        </section>

        <Card className="print-break-inside-avoid">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-5">
              <div>
                <p className="text-xs text-gray-500">입고기준일</p>
                <p className="font-semibold">{date}</p>
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
                <p className="font-semibold">{totalExpectedQty}개</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">실제입고수량</p>
                <p className="font-semibold">{totalReceivedQty}개</p>
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
                    <th className="border px-3 py-2">중국품번</th>
                    <th className="border px-3 py-2">한국품번</th>
                    <th className="border px-3 py-2">색상코드</th>
                    <th className="border px-3 py-2">색상명</th>

                    {sizeLabels.map((size) => (
                      <th key={size} className="border px-2 py-2">
                        {size}
                      </th>
                    ))}

                    <th className="border px-3 py-2">입고합계</th>
                    <th className="border px-3 py-2">상태</th>
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
                            type="number"
                            min={0}
                            value={getReceivedQty(sample.id, size)}
                            onChange={(e) =>
                              updateReceivedQty(sample, size, e.target.value)
                            }
                            className="mx-auto w-16 rounded-md border px-2 py-1 text-center"
                          />
                        </td>
                      ))}

                      <td className="border px-3 py-2 font-semibold">
                        {getReceivedTotal(sample.id)}
                      </td>

                      <td className="border px-3 py-2">
                        {sample.inbound_status || '입고대기'}
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
                      {totalReceivedQty}
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
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                      {sample.image_url ? (
                        <Image
                          src={sample.image_url}
                          alt={sample.china_code}
                          fill
                          className="object-contain p-2"
                          sizes="180px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-400">
                          이미지 없음
                        </div>
                      )}
                    </div>

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