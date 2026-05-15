'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Printer, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SampleEntry } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface OrderSheetClientProps {
  date: string
  chinaCode: string
  initialSamples: SampleEntry[]
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

export function OrderSheetClient({
  date,
  chinaCode,
  initialSamples,
}: OrderSheetClientProps) {
  const [samples, setSamples] = useState(initialSamples)
  const [isSaving, setIsSaving] = useState(false)

  const totalOrderQty = useMemo(() => {
    return samples.reduce(
      (sum, item) => sum + Number(item.order_qty || item.quantity || item.qty || 0),
      0
    )
  }, [samples])

  const representative = samples[0]

  const updateOrderQty = (id: string, value: string) => {
    const nextQty = value === '' ? null : Number(value)

    setSamples((prev) =>
      prev.map((sample) =>
        sample.id === id
          ? {
              ...sample,
              order_qty: nextQty,
            }
          : sample
      )
    )
  }

  const handleSaveQty = async () => {
    setIsSaving(true)

    const supabase = createClient()

    for (const sample of samples) {
      const { error } = await supabase
        .from('sample_entries')
        .update({
          order_qty: Number(sample.order_qty || 0),
        })
        .eq('id', sample.id)

      if (error) {
        setIsSaving(false)
        alert(`발주수량 저장 실패: ${sample.china_code}`)
        return
      }
    }

    setIsSaving(false)
    alert('발주수량이 저장되었습니다.')
  }

  const handleCompleteOrder = async () => {
    const ok = window.confirm(
      '이 발주서를 발주완료 처리할까요?\n발주일자는 오늘 날짜로 저장됩니다.'
    )

    if (!ok) return

    setIsSaving(true)

    const supabase = createClient()
    const today = getToday()

    for (const sample of samples) {
      const { error } = await supabase
        .from('sample_entries')
        .update({
          order_status: '발주완료',
          ordered_at: today,
          inbound_status: sample.inbound_status || '입고대기',
          inbound_expected_qty:
            sample.inbound_expected_qty || sample.order_qty || sample.quantity || sample.qty || 0,
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
        inbound_expected_qty:
          sample.inbound_expected_qty || sample.order_qty || sample.quantity || sample.qty || 0,
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
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-xl border bg-white">
              <Image
                src="/logo.png"
                alt="Company Logo"
                fill
                className="object-contain p-1"
                sizes="56px"
              />
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-wide text-gray-900">
                발 주 서
              </h1>
              <p className="mt-1 text-sm text-gray-500">PURCHASE ORDER</p>
            </div>
          </div>

          <div className="text-right text-sm">
            <p className="text-gray-500">발주요청일</p>
            <p className="font-semibold">{date}</p>
          </div>
        </div>
      </div>

      <section className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        

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

            <Button variant="outline" onClick={handleSaveQty} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              수량 저장
            </Button>

            <Button onClick={handleCompleteOrder} disabled={isSaving || samples.length === 0}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              발주완료
            </Button>
          </div>
        </section>

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
                  <tr className="border-b bg-gray-100">
                    <th className="border px-3 py-2 text-left">중국품번</th>
                    <th className="border px-3 py-2 text-left">한국품번</th>
                    <th className="border px-3 py-2 text-left">색상코드</th>
                    <th className="border px-3 py-2 text-left">색상명</th>
                    <th className="border px-3 py-2 text-right">샘플수량</th>
                    <th className="border px-3 py-2 text-right">발주수량</th>
                    <th className="border px-3 py-2 text-left">상태</th>
                  </tr>
                </thead>

                <tbody>
                  {samples.map((sample) => (
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
                        {sample.quantity || sample.qty || 0}
                      </td>
                      <td className="border px-3 py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          value={sample.order_qty ?? sample.quantity ?? sample.qty ?? 0}
                          onChange={(e) =>
                            updateOrderQty(sample.id, e.target.value)
                          }
                          className="ml-auto w-24 text-right"
                        />
                      </td>
                      <td className="border px-3 py-2">
                        {sample.order_status || '발주대기'}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-yellow-50 font-semibold">
                    <td className="border px-3 py-2" colSpan={5}>
                      합계
                    </td>
                    <td className="border px-3 py-2 text-right">
                      {totalOrderQty}
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