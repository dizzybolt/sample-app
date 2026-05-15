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

function countBy<T extends string>(
  samples: SampleEntry[],
  getter: (sample: SampleEntry) => T | null | undefined
) {
  const result = new Map<T, number>()

  samples.forEach((sample) => {
    const key = getter(sample)
    if (!key) return

    result.set(key, (result.get(key) || 0) + 1)
  })

  return result
}

export default async function DashboardPage() {
  const samples = await getSamples()

  const sampleStatusCounts = countBy(samples, (s) => s.sample_status || s.status)
  const orderStatusCounts = countBy(samples, (s) => s.order_status)
  const inboundStatusCounts = countBy(samples, (s) => s.inbound_status)
  const itemCardStatusCounts = countBy(samples, (s) => s.item_card_status)

  const total = samples.length

  const cards = [
    { title: '전체 샘플', value: total, desc: '등록된 전체 샘플' },
    { title: '샘플입고', value: sampleStatusCounts.get('샘플입고') || 0, desc: '진행 여부 확인 전' },
    { title: '진행', value: sampleStatusCounts.get('진행') || 0, desc: '발주/아이템카드 대상' },
    { title: '등록대기', value: sampleStatusCounts.get('등록대기') || 0, desc: '작업완료 후 등록 대기' },
    { title: '발주대기', value: orderStatusCounts.get('발주대기') || 0, desc: '발주 처리 필요' },
    { title: '발주완료', value: orderStatusCounts.get('발주완료') || 0, desc: '입고관리 대상' },
    { title: '입고대기', value: inboundStatusCounts.get('입고대기') || 0, desc: '입고 확인 필요' },
    { title: '입고완료', value: inboundStatusCounts.get('입고완료') || 0, desc: '입고 완료' },
    { title: '촬영대기', value: itemCardStatusCounts.get('촬영대기') || 0, desc: '촬영 시작 전' },
    { title: '촬영중', value: itemCardStatusCounts.get('촬영중') || 0, desc: '촬영 진행 중' },
    { title: '작업대기', value: itemCardStatusCounts.get('작업대기') || 0, desc: '촬영완료 후 작업 대기' },
    { title: '작업중', value: itemCardStatusCounts.get('작업중') || 0, desc: '상세페이지 작업 중' },
    { title: '작업완료', value: itemCardStatusCounts.get('작업완료') || 0, desc: '작업 완료' },
  ]

  const bottleneck = cards
    .filter((card) => card.title !== '전체 샘플')
    .sort((a, b) => b.value - a.value)[0]

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="mt-1 text-sm text-gray-500">
            샘플 상태, 발주 상태, 입고 상태, 아이템카드 작업 상태를 한눈에 확인합니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">현재 병목 예상 구간</p>
              <h2 className="text-xl font-bold text-gray-900">
                {bottleneck?.title || '-'}
              </h2>
            </div>

            <Badge variant="outline" className="w-fit text-sm">
              {bottleneck?.value || 0}개 대기/진행 중
            </Badge>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {card.value}
                </p>
                <p className="mt-2 text-xs text-gray-500">{card.desc}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  )
}