'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { InboundStatus, SampleEntry } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface InboundSheetClientProps {
  date: string
  chinaCode: string
  initialSamples: SampleEntry[]
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function getExpectedQty(sample: SampleEntry) {
  return Number(
    sample.inbound_expected_qty ||
      sample.order_qty ||
      sample.quantity ||
      sample.qty ||
      0
  )
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
}: InboundSheetClientProps) {
  const [samples, setSamples] = useState(initialSamples)
  const [isSaving, setIsSaving] = useState(false)

  const totalExpectedQty = useMemo(() => {
    return samples.reduce((sum, item) => sum + getExpectedQty(item), 0)
  }, [samples])

  const totalReceivedQty = useMemo(() => {
    return samples.reduce(
      (sum, item) =>
        sum +
        Number(
          item.inbound_received_qty ??
            item.inbound_expected_qty ??
            item.order_qty ??
            item.quantity ??
            item.qty ??
            0
        ),
      0
    )
  }, [samples])

  const representative = samples[0]

  const updateReceivedQty = (id: string, value: string) => {
    const nextQty = value === '' ? null : Number(value)

    setSamples((prev) =>
      prev.map((sample) =>
        sample.id === id
          ? {
              ...sample,
              inbound_received_qty: nextQty,
            }
          : sample
      )
    )
  }

  const handleSaveQty = async () => {
    setIsSaving(true)

    const supabase = createClient()

    for (const sample of samples) {
      const expectedQty = getExpectedQty(sample)
      const receivedQty = Number(
        sample.inbound_received_qty ?? expectedQty ?? 0
      )
      const nextStatus = getAutoInboundStatus(expectedQty, receivedQty)

      const { error } = await supabase
        .from('sample_entries')
        .update({
          inbound_expected_qty: expectedQty,
          inbound_received_qty: receivedQty,
          inbound_status: nextStatus,
        })
        .eq('id', sample.id)

      if (error) {
        setIsSaving(false)
        alert(`입고수량 저장 실패: ${sample.china_code}`)
        return
      }
    }

    setSamples((prev) =>
      prev.map((sample) => {
        const expectedQty = getExpectedQty(sample)
        const receivedQty = Number(
          sample.inbound_received_qty ?? expectedQty ?? 0
        )

        return {
          ...sample,
          inbound_expected_qty: expectedQty,
          inbound_received_qty: receivedQty,
          inbound_status: getAutoInboundStatus(expectedQty, receivedQty),
        }
      })
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
        alert(`입고지연 처리 실패: ${sample.china_code}`)
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
      '입고완료 처리할까요?\n실제입고수량 기준으로 입고완료/부분입고/추가입고/입고누락 상태가 자동 저장됩니다.'
    )

    if (!ok) return

    setIsSaving(true)

    const supabase = createClient()
    const today = getToday()

    for (const sample of samples) {
      const expectedQty = getExpectedQty(sample)
      const receivedQty = Number(
        sample.inbound_received_qty ?? expectedQty ?? 0
      )
      const nextStatus = getAutoInboundStatus(expectedQty, receivedQty)

      const { error } = await supabase
        .from('sample_entries')
        .update({
          inbound_expected_qty: expectedQty,
          inbound_received_qty: receivedQty,
          inbound_status: nextStatus,
          inbound_at: today,
        })
        .eq('id', sample.id)

      if (error) {
        setIsSaving(false)
        alert(`입고완료 처리 실패: ${sample.china_code}`)
        return
      }
    }

    setSamples((prev) =>
      prev.map((sample) => {
        const expectedQty = getExpectedQty(sample)
        const receivedQty = Number(
          sample.inbound_received_qty ?? expectedQty ?? 0
        )

        return {
          ...sample,
          inbound_expected_qty: expectedQty,
          inbound_received_qty: receivedQty,
          inbound_status: getAutoInboundStatus(expectedQty, receivedQty),
          inbound_at: today,
        }
      })
    )

    setIsSaving(false)
    alert('입고 처리되었습니다.')
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">입고 상세</h1>
            <p className="mt-1 text-sm text-gray-500">
              중국품번 기준 입고 수량과 입고 상태를 관리합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/inbound">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                입고관리
              </Button>
            </Link>

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

        <Card>
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
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-100">
                    <th className="border px-3 py-2 text-left">중국품번</th>
                    <th className="border px-3 py-2 text-left">한국품번</th>
                    <th className="border px-3 py-2 text-left">색상코드</th>
                    <th className="border px-3 py-2 text-left">색상명</th>
                    <th className="border px-3 py-2 text-right">발주수량</th>
                    <th className="border px-3 py-2 text-right">입고예정</th>
                    <th className="border px-3 py-2 text-right">실제입고</th>
                    <th className="border px-3 py-2 text-left">상태</th>
                  </tr>
                </thead>

                <tbody>
                  {samples.map((sample) => {
                    const expectedQty = getExpectedQty(sample)
                    const receivedQty =
                      sample.inbound_received_qty ?? expectedQty

                    return (
                      <tr key={sample.id} className="border-b">
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
                        <td className="border px-3 py-2 text-right">
                          {sample.order_qty || 0}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {expectedQty}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            value={receivedQty}
                            onChange={(e) =>
                              updateReceivedQty(sample.id, e.target.value)
                            }
                            className="ml-auto w-24 text-right"
                          />
                        </td>
                        <td className="border px-3 py-2">
                          {sample.inbound_status || '입고대기'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                <tfoot>
                  <tr className="bg-yellow-50 font-semibold">
                    <td className="border px-3 py-2" colSpan={5}>
                      합계
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {totalExpectedQty}
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {totalReceivedQty}
                    </td>
                    <td className="border px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <h2 className="font-semibold text-gray-900">이미지</h2>

            {samples.length === 0 ? (
              <p className="text-sm text-gray-500">표시할 샘플이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {samples.map((sample) => (
                  <div key={sample.id} className="space-y-2">
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                      {sample.image_url ? (
                        <Image
                          src={sample.image_url}
                          alt={sample.china_code}
                          fill
                          className="object-cover"
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