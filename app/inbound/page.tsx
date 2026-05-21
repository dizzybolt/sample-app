import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import type { InboundBatch, InboundBatchQuantity, SampleEntry } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/format'

export const dynamic = 'force-dynamic'

async function getInboundSamples(): Promise<SampleEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sample_entries')
    .select('*')
    .not('inbound_status', 'is', null)
    .order('inbound_expected_at', { ascending: false, nullsFirst: false })
    .order('ordered_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching inbound samples:', error)
    return []
  }

  return data || []
}

async function getInboundBatches(): Promise<InboundBatch[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inbound_batches')
    .select('*')
    .order('order_date', { ascending: false })
    .order('china_code', { ascending: true })
    .order('batch_no', { ascending: true })

  if (error) {
    console.error('Error fetching inbound batches:', error)
    return []
  }

  return data || []
}

async function getInboundBatchQuantities(): Promise<InboundBatchQuantity[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inbound_batch_quantities')
    .select('*')

  if (error) {
    console.error('Error fetching inbound batch quantities:', error)
    return []
  }

  return data || []
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

function getDateKey(sample: SampleEntry) {
  return (
    toKoreaDate(sample.order_requested_at) ||
    toKoreaDate(sample.ordered_at) ||
    toKoreaDate(sample.created_at) ||
    '날짜없음'
  )
}

function getFirstInboundDate(batches: InboundBatch[]) {
  const dates = batches
    .map((batch) => batch.inbound_date)
    .filter(Boolean)
    .sort()

  return dates[0] || '-'
}

function getLatestInboundDate(batches: InboundBatch[]) {
  const dates = batches
    .map((batch) => batch.inbound_date)
    .filter(Boolean)
    .sort()

  return dates.at(-1) || '-'
}

function getCumulativeInboundQty(
  batches: InboundBatch[],
  quantities: InboundBatchQuantity[]
) {
  const batchIds = batches.map((batch) => batch.id)

  return quantities
    .filter((qty) => batchIds.includes(qty.batch_id))
    .reduce((sum, qty) => sum + Number(qty.qty || 0), 0)
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

interface InboundPageProps {
  searchParams?: Promise<{
    status?: string
  }>
}

export default async function InboundPage({ searchParams }: InboundPageProps) {
  const resolvedSearchParams = await searchParams
  const statusFilter = resolvedSearchParams?.status || 'all'

  const [samples, inboundBatches, inboundBatchQuantities] =
    await Promise.all([
      getInboundSamples(),
      getInboundBatches(),
      getInboundBatchQuantities(),
    ])

  const filteredSamples =
    statusFilter === 'all'
      ? samples
      : samples.filter((sample) => sample.inbound_status === statusFilter)
  const groupedInbound = groupByDateAndChinaCode(filteredSamples)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">입고관리</h1>
            <p className="mt-1 text-sm text-gray-500">
              입고대기, 입고완료, 입고지연 샘플을 발주요청일과 중국품번 기준으로 확인합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: '전체', value: 'all' },
              { label: '입고대기', value: '입고대기' },
              { label: '입고완료', value: '입고완료' },
              { label: '입고지연', value: '입고지연' },
            ].map((item) => (
              <Link
                key={item.value}
                href={item.value === 'all' ? '/inbound' : `/inbound?status=${encodeURIComponent(item.value)}`}
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

        {groupedInbound.length === 0 ? (
          <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-medium text-gray-900">입고관리 항목이 없습니다.</p>
            <p className="mt-1 text-sm text-gray-500">
              발주서에서 발주완료 처리하면 입고관리 항목이 생성됩니다.
            </p>
          </section>
        ) : (
          <section className="space-y-5">
            {groupedInbound.map(([date, chinaMap]) => (
              <div key={date} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">{date}</h2>
                  <Badge variant="secondary">{chinaMap.size}개 품번</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from(chinaMap.entries()).map(([chinaCode, items]) => {
                  const representative = items[0]

                  const expectedQty = items.reduce(
                    (sum, item) =>
                      sum +
                      Number(
                        item.inbound_expected_qty ||
                          item.order_qty ||
                          item.quantity ||
                          item.qty ||
                          0
                      ),
                    0
                  )

                  const relatedBatches = inboundBatches.filter(
                    (batch) =>
                      batch.order_date === date &&
                      batch.china_code === chinaCode
                  )

                  const cumulativeInboundQty = getCumulativeInboundQty(
                    relatedBatches,
                    inboundBatchQuantities
                  )

                  const firstInboundDate = getFirstInboundDate(relatedBatches)
                  const latestInboundDate = getLatestInboundDate(relatedBatches)

                  const href = `/inbound/${date}/${encodeURIComponent(chinaCode)}`

                    return (
                      <Link key={`${date}-${chinaCode}`} href={href}>
                        <Card className="h-full transition hover:-translate-y-1 hover:shadow-md">
                          <CardContent className="flex gap-3 p-3">
                            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
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
                                  {chinaCode}
                                </h3>
                                <Badge variant="outline">
                                  {representative.inbound_status || '입고대기'}
                                </Badge>
                              </div>

                              <p className="mt-1 text-sm text-gray-500">
                                색상/옵션 {formatNumber(items.length)}개
                              </p>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                                <div className="rounded-lg bg-gray-50 p-2">
                                  <p className="text-gray-400">입고예정</p>
                                  <p className="font-semibold text-gray-900">
                                    {formatNumber(expectedQty)}개
                                  </p>
                                </div>

                                <div className="rounded-lg bg-gray-50 p-2">
                                  <p className="text-gray-400">누적입고</p>
                                  <p className="font-semibold text-gray-900">
                                    {formatNumber(cumulativeInboundQty)}개
                                  </p>
                                </div>

                                <div className="rounded-lg bg-gray-50 p-2">
                                  <p className="text-gray-400">최초입고일</p>
                                  <p className="font-semibold text-gray-900">
                                    {firstInboundDate}
                                  </p>
                                </div>

                                <div className="rounded-lg bg-gray-50 p-2">
                                  <p className="text-gray-400">최근입고일</p>
                                  <p className="font-semibold text-gray-900">
                                    {latestInboundDate}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-2 text-xs text-gray-400">
                                입고회차 {formatNumber(relatedBatches.length)}회
                              </p>
                              <p className="mt-2 text-xs text-gray-400">
                                클릭하면 입고 상세로 이동
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