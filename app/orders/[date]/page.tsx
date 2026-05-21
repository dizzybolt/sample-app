import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SampleEntry } from '@/lib/types'
import { formatDateLabel } from '@/lib/order-utils'
import { Button } from '@/components/ui/button'

function sumQty(online?: number | null, offline?: number | null) {
  return (online || 0) + (offline || 0)
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params

  if (!date) {
    notFound()
  }

  const start = `${date}T00:00:00.000Z`
  const next = new Date(`${date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const end = next.toISOString()

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sample_entries')
    .select('*')
    .eq('status', '발주')
    .gte('ordered_at', start)
    .lt('ordered_at', end)
    .order('china_code', { ascending: true })
    .order('color_code', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data || []) as SampleEntry[]

  if (rows.length === 0) {
    notFound()
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">발주서</h1>
          <p className="text-sm text-muted-foreground">
            발주일자: {formatDateLabel(date)}
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/orders">목록으로</Link>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="min-w-[1400px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50 text-center">
              <th className="border px-3 py-2">NO</th>
              <th className="border px-3 py-2">중국품번</th>
              <th className="border px-3 py-2">이미지</th>
              <th className="border px-3 py-2">한국품번</th>
              <th className="border px-3 py-2">중국컬러</th>
              <th className="border px-3 py-2">한국컬러</th>
              <th className="border px-3 py-2">컬러NO.</th>
              <th className="border px-3 py-2">사이즈</th>
              <th className="border px-3 py-2">온라인</th>
              <th className="border px-3 py-2">오프라인</th>
              <th className="border px-3 py-2">합계</th>
              <th className="border px-3 py-2">비고</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="align-middle text-center">
                <td className="border px-2 py-2">{index + 1}</td>
                <td className="border px-2 py-2">{row.china_code || ''}</td>

                <td className="border px-2 py-2">
                  <div className="mx-auto flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded border bg-white">
                    {row.image_url ? (
                      <div className="relative h-full w-full">
                        <Image
                          src={row.image_url}
                          alt={row.china_code || ''}
                          fill
                          className="object-contain bg-white"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        이미지 없음
                      </span>
                    )}
                  </div>
                </td>

                <td className="border px-2 py-2">{row.korea_code || ''}</td>

                <td className="border px-2 py-2"></td>

                <td className="border px-2 py-2">{row.color_name || ''}</td>

                <td className="border px-2 py-2">{row.color_code || ''}</td>

                <td className="border px-2 py-2">{row.size || ''}</td>

                <td className="border px-2 py-2">{row.order_qty || 0}</td>

                <td className="border px-2 py-2">{row.offline_qty || 0}</td>

                <td className="border px-2 py-2">
                  {sumQty(row.order_qty, row.offline_qty)}
                </td>

                <td className="border px-2 py-2 whitespace-pre-wrap break-words text-left">
                  {row.note || row.memo || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}