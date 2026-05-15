import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import type { SampleEntry } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

interface OrderSheetPageProps {
  params: Promise<{
    date: string
    china_code: string
  }>
}

async function getOrderSheetSamples(
  date: string,
  chinaCode: string
): Promise<SampleEntry[]> {
  const supabase = await createClient()
  const decodedChinaCode = decodeURIComponent(chinaCode)

  const { data, error } = await supabase
    .from('sample_entries')
    .select('*')
    .eq('china_code', decodedChinaCode)
    .not('order_status', 'is', null)
    .order('color_code', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching order sheet samples:', error)
    return []
  }

  return (data || []).filter((sample) => {
    const dateKey =
      sample.order_requested_at?.slice(0, 10) ||
      sample.checked_at?.slice(0, 10) ||
      sample.created_at?.slice(0, 10) ||
      '날짜없음'

    return dateKey === date
  })
}

export default async function OrderSheetPage({ params }: OrderSheetPageProps) {
  const resolvedParams = await params

  const date = decodeURIComponent(resolvedParams.date)
  const chinaCode = decodeURIComponent(resolvedParams.china_code)
  const samples = await getOrderSheetSamples(date, resolvedParams.china_code)

  const totalOrderQty = samples.reduce(
    (sum, item) => sum + Number(item.order_qty || item.quantity || item.qty || 0),
    0
  )

  const representative = samples[0]

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">발주서</h1>
          <p className="mt-1 text-sm text-gray-500">
            중국품번 기준 발주서입니다.
          </p>
        </section>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-sm">
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
                        {sample.order_qty || sample.quantity || sample.qty || 0}
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