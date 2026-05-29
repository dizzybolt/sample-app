import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import type { SampleEntry } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

async function getOrderSamples(): Promise<SampleEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sample_entries')
    .select('*')
    .not('order_status', 'is', null)
    .order('order_requested_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching order samples:', error)
    return []
  }

  return data || []
}

function getDateKey(sample: SampleEntry) {
  return (
    sample.order_requested_at?.slice(0, 10) ||
    sample.checked_at?.slice(0, 10) ||
    sample.created_at?.slice(0, 10) ||
    '날짜없음'
  )
}

function groupByDateAndChinaCode(samples: SampleEntry[]) {
  const dateMap = new Map<string, Map<string, SampleEntry[]>>()

  samples.forEach((sample) => {
    const dateKey = getDateKey(sample)
    const chinaCode = sample.china_code || '품번없음'

    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, new Map())
    }

    const chinaMap = dateMap.get(dateKey)!
    const current = chinaMap.get(chinaCode) || []
    current.push(sample)
    chinaMap.set(chinaCode, current)
  })

  return Array.from(dateMap.entries()).sort(([a], [b]) => b.localeCompare(a))
}

interface OrdersPageProps {
  searchParams?: Promise<{
    status?: string
    q?: string
  }>
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const resolvedSearchParams = await searchParams
  const statusFilter = resolvedSearchParams?.status || 'all'
  const keywordRaw = (resolvedSearchParams?.q || '').trim()
  const keyword = keywordRaw.toLowerCase()
  const samples = await getOrderSamples()

  const filteredSamples = samples.filter((sample) => {
    const matchesStatus =
      statusFilter === 'all' || sample.order_status === statusFilter

    const matchesKeyword =
      !keyword ||
      sample.china_code?.toLowerCase().includes(keyword) ||
      sample.korea_code?.toLowerCase().includes(keyword)

    return matchesStatus && matchesKeyword
  })
  const groupedOrders = groupByDateAndChinaCode(filteredSamples)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">발주관리</h1>
            <p className="mt-1 text-sm text-gray-500">
              발주대기, 발주완료, 발주보류 상태의 샘플을 발주요청일과 중국품번 기준으로 확인합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: '전체', value: 'all' },
              { label: '발주대기', value: '발주대기' },
              { label: '발주완료', value: '발주완료' },
              { label: '발주보류', value: '발주보류' },
            ].map((item) => (
              <Link
                key={item.value}
                href={item.value === 'all' ? '/orders' : `/orders?status=${encodeURIComponent(item.value)}`}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  statusFilter === item.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <form className="flex flex-col gap-2 sm:flex-row">
            <input
              name="q"
              defaultValue={keywordRaw}
              placeholder="중국품번, 한국품번 검색"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />

            <input type="hidden" name="status" value={statusFilter} />

            <Button type="submit" variant="outline" className="sm:w-24">
              검색
            </Button>
          </form>
        </section>

        {groupedOrders.length === 0 ? (
          <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-medium text-gray-900">발주관리 항목이 없습니다.</p>
            <p className="mt-1 text-sm text-gray-500">
              샘플관리에서 상태를 진행으로 변경하면 발주관리 항목이 생성됩니다.
            </p>
          </section>
        ) : (
          <section className="space-y-5">
            {groupedOrders.map(([date, chinaMap]) => (
              <div key={date} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">{date}</h2>
                  <Badge variant="secondary">{chinaMap.size}개 품번</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from(chinaMap.entries()).map(([chinaCode, items]) => {
                    const representative = items[0]
                    const totalQty = items.reduce(
                      (sum, item) =>
                        sum + Number(item.order_qty || item.quantity || item.qty || 0),
                      0
                    )

                    const href = `/orders/${date}/${encodeURIComponent(chinaCode)}`

                    return (
                      <Link key={`${date}-${chinaCode}`} href={href}>
                        <Card className="block w-full rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md">
                          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                            <div className="relative h-32 w-full overflow-hidden rounded-xl bg-gray-100 sm:h-28 sm:w-28 sm:shrink-0">
                              {representative.image_url ? (
                                <Image
                                  src={representative.image_url}
                                  alt={chinaCode}
                                  fill
                                  className="object-cover"
                                  sizes="96px"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xs text-gray-400">
                                  이미지 없음
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="truncate font-semibold text-gray-900">
                                  {representative.korea_code || '-'}
                                </h3>
                                <Badge variant="outline">
                                  {representative.order_status || '발주대기'}
                                </Badge>
                              </div>

                              <p className="mt-1 text-sm text-gray-500">
                                색상/옵션 {items.length}개
                              </p>
                              <p className="mt-1 text-sm text-gray-500">
                                발주수량 {formatNumber(totalQty)}개
                              </p>
                              <p className="mt-2 text-xs text-gray-400">
                                클릭하면 발주서로 이동
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}