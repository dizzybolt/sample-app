'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Printer, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { OrderSizeQuantity, SampleEntry, SizeGroup } from '@/lib/types'
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

interface OrderSheetClientProps {
  date: string
  chinaCode: string
  initialSamples: SampleEntry[]
  sizeGroups: SizeGroup[]
  initialQuantities: OrderSizeQuantity[]
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

  const totalOrderQty = useMemo(() => {
    return samples.reduce(
      (sum, sample) => sum + getSampleTotal(sample.id),
      0
    )
  }, [samples, quantities, selectedSizeGroup, sizeLabels])

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
        <div className="print-header rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-wide text-gray-900">
                발 주 서
              </h1>
              <p className="mt-1 text-sm text-gray-500">PURCHASE ORDER</p>
            </div>

            <div className="text-right text-sm">
              <p className="text-gray-500">발주요청일</p>
              <p className="font-semibold">{date}</p>
            </div>
          </div>
        </div>

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

        <Card className="no-print">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  사이즈 구분 선택
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  선택한 사이즈 기준으로 발주 수량 입력 열이 생성됩니다.
                </p>
              </div>

              <div className="w-full sm:w-52">
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-4">
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
                <p className="font-semibold">{totalOrderQty}개</p>
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
                    <th className="border px-3 py-2 text-center">중국품번</th>
                    <th className="border px-3 py-2 text-center">한국품번</th>
                    <th className="border px-3 py-2 text-center">색상코드</th>
                    <th className="border px-3 py-2 text-center">색상명</th>

                    {sizeLabels.map((size) => (
                      <th key={size} className="border px-2 py-2 text-center">
                        {size}
                      </th>
                    ))}

                    <th className="border px-3 py-2 text-center">합계</th>
                    <th className="border px-3 py-2 text-center">상태</th>
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
                            type="number"
                            min={0}
                            value={getQty(sample.id, size)}
                            onChange={(e) =>
                              updateQty(sample, size, e.target.value)
                            }
                            className="mx-auto w-16 rounded-md border px-2 py-1 text-center print:border-0 print:bg-transparent"
                          />
                        </td>
                      ))}

                      <td className="border px-3 py-2 text-center font-semibold">
                        {getSampleTotal(sample.id)}
                      </td>

                      <td className="border px-3 py-2 text-center">
                        {sample.order_status || '발주대기'}
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
                      {totalOrderQty}
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