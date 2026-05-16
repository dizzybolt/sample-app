import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { SampleEntry } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

async function getSamples(): Promise<SampleEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sample_entries')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching dashboard samples:', error)
    return []
  }

  return data || []
}

function countBy(
  samples: SampleEntry[],
  getter: (sample: SampleEntry) => string | null | undefined
) {
  const result = new Map<string, number>()

  samples.forEach((sample) => {
    const key = getter(sample)
    if (!key) return
    result.set(key, (result.get(key) || 0) + 1)
  })

  return result
}

function diffDays(dateString?: string | null) {
  if (!dateString) return null

  const base = new Date(dateString)
  const today = new Date()

  if (Number.isNaN(base.getTime())) return null

  const diff = today.getTime() - base.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getLongWaitingItems(samples: SampleEntry[]) {
  return samples
    .map((sample) => {
      const sampleStatus = sample.sample_status || sample.status
      const itemStatus = sample.item_card_status
      const orderStatus = sample.order_status
      const inboundStatus = sample.inbound_status

      if (sampleStatus === '샘플입고') {
        const days = diffDays(sample.checked_at || sample.created_at)
        if (days !== null && days >= 3) {
          return {
            title: sample.china_code,
            status: '샘플입고',
            days,
            href: '/samples',
          }
        }
      }

      if (itemStatus === '촬영중') {
        const days = diffDays(sample.shoot_requested_at)
        if (days !== null && days >= 3) {
          return {
            title: sample.china_code,
            status: '촬영중',
            days,
            href: '/item-cards',
          }
        }
      }

      if (itemStatus === '작업대기') {
        const days = diffDays(sample.shoot_completed_at)
        if (days !== null && days >= 3) {
          return {
            title: sample.china_code,
            status: '작업대기',
            days,
            href: '/item-cards',
          }
        }
      }

      if (itemStatus === '작업중') {
        const days = diffDays(sample.work_started_at)
        if (days !== null && days >= 5) {
          return {
            title: sample.china_code,
            status: '작업중',
            days,
            href: '/item-cards',
          }
        }
      }

      if (orderStatus === '발주대기') {
        const days = diffDays(sample.order_requested_at || sample.checked_at)
        if (days !== null && days >= 3) {
          return {
            title: sample.china_code,
            status: '발주대기',
            days,
            href: '/orders',
          }
        }
      }

      if (inboundStatus === '입고대기') {
        const days = diffDays(sample.ordered_at)
        if (days !== null && days >= 7) {
          return {
            title: sample.china_code,
            status: '입고대기',
            days,
            href: '/inbound',
          }
        }
      }

      return null
    })
    .filter(Boolean)
    .sort((a, b) => (b?.days || 0) - (a?.days || 0))
    .slice(0, 10)
}

export default async function DashboardPage() {
  const samples = await getSamples()

  const sampleStatusCounts = countBy(samples, (s) => s.sample_status || s.status)
  const orderStatusCounts = countBy(samples, (s) => s.order_status)
  const inboundStatusCounts = countBy(samples, (s) => s.inbound_status)
  const itemCardStatusCounts = countBy(samples, (s) => s.item_card_status)

  const cards = [
    { title: '전체 샘플', value: samples.length, desc: '등록된 전체 샘플', href: '/samples' },
    { title: '샘플입고', value: sampleStatusCounts.get('샘플입고') || 0, desc: '진행 여부 확인 전', href: '/samples' },
    { title: '진행', value: sampleStatusCounts.get('진행') || 0, desc: '발주/아이템카드 대상', href: '/samples' },
    { title: '등록대기', value: sampleStatusCounts.get('등록대기') || 0, desc: '작업완료 후 등록 대기', href: '/samples' },
    { title: '발주대기', value: orderStatusCounts.get('발주대기') || 0, desc: '발주 처리 필요', href: '/orders' },
    { title: '발주완료', value: orderStatusCounts.get('발주완료') || 0, desc: '입고관리 대상', href: '/orders' },
    { title: '입고대기', value: inboundStatusCounts.get('입고대기') || 0, desc: '입고 확인 필요', href: '/inbound' },
    { title: '입고완료', value: inboundStatusCounts.get('입고완료') || 0, desc: '입고 완료', href: '/inbound' },
    { title: '촬영대기', value: itemCardStatusCounts.get('촬영대기') || 0, desc: '촬영 시작 전', href: '/item-cards' },
    { title: '촬영중', value: itemCardStatusCounts.get('촬영중') || 0, desc: '촬영 진행 중', href: '/item-cards' },
    { title: '작업대기', value: itemCardStatusCounts.get('작업대기') || 0, desc: '촬영완료 후 작업 대기', href: '/item-cards' },
    { title: '작업중', value: itemCardStatusCounts.get('작업중') || 0, desc: '상세페이지 작업 중', href: '/item-cards' },
    { title: '작업완료', value: itemCardStatusCounts.get('작업완료') || 0, desc: '상품 등록 대기 전 단계', href: '/item-cards' },
  ]

  const bottleneck = cards
    .filter((card) => card.title !== '전체 샘플')
    .sort((a, b) => b.value - a.value)[0]

  const longWaitingItems = getLongWaitingItems(samples)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="mt-1 text-sm text-gray-500">
            상태별 수량, 병목 예상 구간, 장기 대기 항목을 확인합니다.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">현재 병목 예상 구간</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {bottleneck?.title || '-'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    단순 수량 기준으로 가장 많이 쌓인 구간입니다.
                  </p>
                </div>

                <Badge variant="outline" className="text-sm">
                  {bottleneck?.value || 0}개
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-gray-700" />
                <p className="text-sm text-gray-500">장기 대기 항목</p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {longWaitingItems.length}건
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    기준일 이상 머문 샘플입니다.
                  </p>
                </div>

                <Badge variant="destructive" className="text-sm">
                  확인 필요
                </Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.title} href={card.href}>
              <Card className="h-full transition hover:-translate-y-1 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-gray-500">{card.title}</p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">
                        {card.value}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 text-gray-400" />
                  </div>

                  <p className="mt-2 text-xs text-gray-500">{card.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            장기 대기 상세
          </h2>

          {longWaitingItems.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-gray-500">
                현재 기준으로 장기 대기 항목이 없습니다.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {longWaitingItems.map((item, index) => (
                <Link
                  key={`${item?.title}-${item?.status}-${index}`}
                  href={item?.href || '/dashboard'}
                >
                  <Card className="transition hover:bg-gray-50">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {item?.title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {item?.status}
                        </p>
                      </div>

                      <Badge variant="outline">
                        {item?.days}일 경과
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}