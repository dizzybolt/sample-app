import Image from 'next/image'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Camera,
  ClipboardList,
  FileText,
  IdCard,
  PackageCheck,
  Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { SampleEntry } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/format'
import { DashboardStatusPanel } from '@/components/dashboard-status-panel'

export const dynamic = 'force-dynamic'

type StudioRow = {
  id: string
  name: string
}

type DashboardSample = SampleEntry & {
  studio_id?: string | null
  studio_name?: string | null
}

async function getSamples(): Promise<DashboardSample[]> {
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

async function getStudios(): Promise<StudioRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('studios')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching studios:', error)
    return []
  }

  return data || []
}

function countBy(
  samples: DashboardSample[],
  getter: (sample: DashboardSample) => string | null | undefined
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

function formatDate(value?: string | null) {
  if (!value) return '-'
  return value.slice(0, 10)
}

function getLongWaitingItems(samples: DashboardSample[]) {
  return samples
    .map((sample) => {
      const sampleStatus = sample.sample_status || sample.status
      const itemStatus = sample.item_card_status
      const orderStatus = sample.order_status
      const inboundStatus = sample.inbound_status

      if (sampleStatus === '샘플입고') {
        const days = diffDays(sample.checked_at || sample.created_at)
        if (days !== null && days >= 7) {
          return {
            title: sample.china_code,
            status: '샘플입고',
            days,
            href: '/samples?status=샘플입고',
            image_url: sample.image_url,
            studio_name: sample.studio_name,
          }
        }
      }

      if (itemStatus === '촬영대기') {
        const days = diffDays(sample.checked_at || sample.created_at)
        if (days !== null && days >= 5) {
          return {
            title: sample.china_code,
            status: '촬영대기',
            days,
            href: '/item-cards',
            image_url: sample.image_url,
            studio_name: sample.studio_name,
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
            image_url: sample.image_url,
            studio_name: sample.studio_name,
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
            image_url: sample.image_url,
            studio_name: sample.studio_name,
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
            image_url: sample.image_url,
            studio_name: sample.studio_name,
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
            href: '/orders?status=발주대기',
            image_url: sample.image_url,
            studio_name: sample.studio_name,
          }
        }
      }

      if (orderStatus === '발주완료' && inboundStatus !== '입고완료') {
        const days = diffDays(sample.ordered_at)
        if (days !== null && days >= 14) {
          return {
            title: sample.china_code,
            status: inboundStatus || '입고대기',
            days,
            href: '/inbound',
            image_url: sample.image_url,
            studio_name: sample.studio_name,
          }
        }
      }

      return null
    })
    .filter(Boolean)
    .sort((a, b) => (b?.days || 0) - (a?.days || 0))
    .slice(0, 12)
}

function getRecentItems(samples: DashboardSample[]) {
  const map = new Map<string, DashboardSample[]>()

  samples.forEach((sample) => {
    if (!sample.china_code) return
    const prev = map.get(sample.china_code) || []
    map.set(sample.china_code, [...prev, sample])
  })

  return Array.from(map.entries())
    .map(([chinaCode, items]) => {
      const representative = items[0]
      const colorCount = new Set(
        items.map((item) => `${item.color_code || ''}-${item.color_name || ''}`)
      ).size

      return {
        chinaCode,
        representative,
        colorCount,
      }
    })
    .slice(0, 8)
}

function getStudioStats(samples: DashboardSample[], studios: StudioRow[]) {
  return studios
    .map((studio) => {
      const items = samples.filter((sample) => sample.studio_id === studio.id)

      return {
        id: studio.id,
        name: studio.name,
        shootingWaiting: items.filter(
          (sample) => sample.item_card_status === '촬영대기'
        ).length,
        shooting: items.filter((sample) => sample.item_card_status === '촬영중')
          .length,
        working: items.filter((sample) => sample.item_card_status === '작업중')
          .length,
      }
    })
    .map((studio) => ({
      ...studio,
      total: studio.shootingWaiting + studio.shooting + studio.working,
    }))
    .filter((studio) => studio.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
}

type LatestStatusItem = {
  chinaCode: string
  koreaCode: string
  date: string
  summary: string
}

function getLatestByStatus(
  samples: DashboardSample[],
  matcher: (sample: DashboardSample) => boolean,
  dateGetter: (sample: DashboardSample) => string | null | undefined,
  summaryGetter: (sample: DashboardSample) => string
): LatestStatusItem | null {
  const found = samples
    .filter(matcher)
    .sort((a, b) =>
      String(dateGetter(b) || b.updated_at || b.created_at || '').localeCompare(
        String(dateGetter(a) || a.updated_at || a.created_at || '')
      )
    )[0]

  if (!found) return null

  return {
    chinaCode: found.china_code || '-',
    koreaCode: found.korea_code || '-',
    date: formatDate(dateGetter(found) || found.updated_at || found.created_at),
    summary: summaryGetter(found),
  }
}

function getLatestInboundCompletedGroup(
  samples: DashboardSample[]
): LatestStatusItem | null {
  const completedSamples = samples.filter(
    (sample) => sample.inbound_status === '입고완료'
  )

  if (completedSamples.length === 0) return null

  const latest = completedSamples.sort((a, b) =>
    String(b.inbound_at || b.updated_at || b.created_at || '').localeCompare(
      String(a.inbound_at || a.updated_at || a.created_at || '')
    )
  )[0]

  const latestDate = formatDate(
    latest.inbound_at || latest.updated_at || latest.created_at
  )

  const sameGroupSamples = completedSamples.filter(
    (sample) =>
      sample.china_code === latest.china_code &&
      formatDate(sample.inbound_at || sample.updated_at || sample.created_at) ===
        latestDate
  )

  const totalReceivedQty = sameGroupSamples.reduce(
    (sum, sample) => sum + Number(sample.inbound_received_qty || 0),
    0
  )

  return {
    chinaCode: latest.china_code || '-',
    koreaCode: latest.korea_code || '-',
    date: latestDate,
    summary: `누적입고 ${formatNumber(totalReceivedQty)}개`,
  }
}

  interface DashboardPageProps {
    searchParams?: Promise<{
      images?: string
    }>
  }

  export default async function DashboardPage({
    searchParams,
  }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams
  const showImages = resolvedSearchParams?.images === 'on'
  const [samples, studios] = await Promise.all([getSamples(), getStudios()])

  const sampleStatusCounts = countBy(samples, (s) => s.sample_status || s.status)
  const orderStatusCounts = countBy(samples, (s) => s.order_status)
  const inboundStatusCounts = countBy(samples, (s) => s.inbound_status)
  const itemCardStatusCounts = countBy(samples, (s) => s.item_card_status)

  const kpiCards = [
    {
      title: '샘플입고',
      value: sampleStatusCounts.get('샘플입고') || 0,
      desc: '상품화 판단 전',
      href: '/samples?status=샘플입고',
      icon: ClipboardList,
      latest: getLatestByStatus(
        samples,
        (s) => (s.sample_status || s.status) === '샘플입고',
        (s) => s.checked_at || s.created_at,
        (s) => `수량 ${formatNumber(s.qty || s.quantity || 0)}개`
      ),
    },
    {
      title: '진행',
      value: sampleStatusCounts.get('진행') || 0,
      desc: '상품화 진행 중',
      href: '/samples?status=진행',
      icon: IdCard,
      latest: getLatestByStatus(
        samples,
        (s) => (s.sample_status || s.status) === '진행',
        (s) => s.updated_at || s.created_at,
        (s) => s.product_name || s.korea_code || '상품정보 없음'
      ),
    },
    {
      title: '등록대기',
      value: sampleStatusCounts.get('등록대기') || 0,
      desc: '작업 완료 후 등록 대기',
      href: '/samples?status=등록대기',
      icon: BarChart3,
      latest: getLatestByStatus(
        samples,
        (s) => (s.sample_status || s.status) === '등록대기',
        (s) => s.work_completed_at || s.updated_at,
        (s) => s.product_name || s.korea_code || '상품정보 없음'
      ),
    },
    {
      title: '발주대기',
      value: orderStatusCounts.get('발주대기') || 0,
      desc: '발주 처리 필요',
      href: '/orders?status=발주대기',
      icon: FileText,
      latest: getLatestByStatus(
        samples,
        (s) => s.order_status === '발주대기',
        (s) => s.order_requested_at || s.updated_at,
        (s) => `발주수량 ${formatNumber(s.order_qty || 0)}개`
      ),
    },
    {
      title: '입고대기',
      value: inboundStatusCounts.get('입고대기') || 0,
      desc: '입고 확인 필요',
      href: '/inbound?status=입고대기',
      icon: PackageCheck,
      latest: getLatestByStatus(
        samples,
        (s) => s.inbound_status === '입고대기',
        (s) => s.ordered_at || s.updated_at,
        (s) => `입고예정 ${formatNumber(s.inbound_expected_qty || s.order_qty || 0)}개`
      ),
    },
    {
      title: '입고완료',
      value: inboundStatusCounts.get('입고완료') || 0,
      desc: '입고 처리 완료',
      href: '/inbound?status=입고완료',
      icon: PackageCheck,
      latest: getLatestInboundCompletedGroup(samples),
    },
  ]

  const flowCards = [
    { title: '샘플입고', value: sampleStatusCounts.get('샘플입고') || 0 },
    { title: '진행', value: sampleStatusCounts.get('진행') || 0 },
    { title: '촬영대기', value: itemCardStatusCounts.get('촬영대기') || 0 },
    { title: '촬영중', value: itemCardStatusCounts.get('촬영중') || 0 },
    { title: '작업중', value: itemCardStatusCounts.get('작업중') || 0 },
    { title: '등록대기', value: sampleStatusCounts.get('등록대기') || 0 },
    { title: '발주완료', value: orderStatusCounts.get('발주완료') || 0 },
    { title: '입고완료', value: inboundStatusCounts.get('입고완료') || 0 },
  ]

  const longWaitingItems = getLongWaitingItems(samples)
  const recentItems = getRecentItems(samples)
  const studioStats = getStudioStats(samples, studios)

  const quickLinks = [
    { title: '샘플 등록', href: '/samples', icon: Plus },
    { title: '아이템카드', href: '/item-cards', icon: IdCard },
    { title: '발주관리', href: '/orders', icon: FileText },
    { title: '입고관리', href: '/inbound', icon: PackageCheck },
    { title: '스튜디오', href: '/studios', icon: Camera },
  ]

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
            <p className="mt-1 text-sm text-gray-500">
              샘플, 아이템카드, 발주, 입고 흐름의 현재 상태를 확인합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={showImages ? '/dashboard' : '/dashboard?images=on'}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                showImages
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {showImages ? '이미지 숨기기' : '이미지 표시'}
            </Link>            
            {quickLinks.map((link) => {
              const Icon = link.icon

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Icon className="h-4 w-4" />
                  {link.title}
                </Link>
              )
            })}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {kpiCards.map((card) => {
            const Icon = card.icon

            return (
              <Link key={card.title} href={card.href}>
                <Card className="h-full transition hover:-translate-y-1 hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-gray-500">{card.title}</p>
                        <p className="mt-2 text-3xl font-bold text-gray-900">
                          {formatNumber(card.value)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-100 p-2">
                        <Icon className="h-5 w-5 text-gray-700" />
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-gray-500">{card.desc}</p>
                    {card.latest && (
                      <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                        <p className="font-semibold text-gray-900">
                          최근 {card.latest.chinaCode}
                        </p>
                        <p className="font-semibold text-gray-900">
                          최근 {card.latest.koreaCode}
                        </p>
                        <p className="mt-1">{card.latest.date}</p>
                        <p className="mt-1">{card.latest.summary}</p>
                      </div>
                    )}                    
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    장기 대기 경고
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    기준일 이상 머문 상품을 우선 확인합니다.
                  </p>
                </div>

                <Badge variant={longWaitingItems.length > 0 ? 'destructive' : 'outline'}>
                  {longWaitingItems.length}건
                </Badge>
              </div>

              <div className="mt-4 space-y-2">
                {longWaitingItems.length === 0 ? (
                  <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                    현재 장기 대기 항목이 없습니다.
                  </div>
                ) : (
                  longWaitingItems.map((item, index) => (
                    <Link
                      key={`${item?.title}-${item?.status}-${index}`}
                      href={item?.href || '/dashboard'}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3 hover:bg-gray-50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        {showImages && item?.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.title || ''}
                            fill
                            className="object-contain p-1"
                            sizes="48px"
                            quality={45}
                            loading="lazy"
                          />
                        ) : null}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">
                            {item?.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {item?.status}
                            {item?.studio_name ? ` · ${item.studio_name}` : ''}
                          </p>
                        </div>
                      </div>

                      <Badge variant="outline">{item?.days}일</Badge>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <DashboardStatusPanel samples={samples} />
          
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            업무 흐름 보드
          </h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {flowCards.map((card) => (
              <Card key={card.title}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-gray-500">{card.title}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {formatNumber(card.value)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              최근 등록 상품
            </h2>

            <Link
              href="/samples"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              전체 보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentItems.map((item) => (
              <Link key={item.chinaCode} href="/samples">
                <Card className="overflow-hidden transition hover:-translate-y-1 hover:shadow-md">
                  <div className="relative aspect-[4/3] bg-gray-100">
                    {showImages && item.representative.image_url ? (
                      <Image
                        src={item.representative.image_url}
                        alt={item.chinaCode}
                        fill
                        className="object-contain p-2"
                        sizes="180px"
                        quality={50}
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-400">
                        이미지 숨김
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <p className="truncate font-bold text-gray-900">
                      {item.chinaCode}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      컬러 {formatNumber(item.colorCount)}개 ·{' '}
                      {item.representative.sample_status ||
                        item.representative.status ||
                        '-'}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      등록일 {formatDate(item.representative.created_at)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}