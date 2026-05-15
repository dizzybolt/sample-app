import Link from 'next/link'
import { FileText, Package, Home } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { SampleEntry } from '@/lib/types'
import { groupOrdersByDate, formatDateLabel } from '@/lib/order-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function OrdersPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sample_entries')
    .select('*')
    .eq('status', '발주')
    .not('ordered_at', 'is', null)
    .order('ordered_at', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data || []) as SampleEntry[]
  const grouped = groupOrdersByDate(rows)

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="text-2xl font-bold">발주서 생성</h1>
    <p className="text-sm text-muted-foreground">
      발주 상태 샘플을 발주일자별로 정리했습니다.
    </p>
  </div>

  <div className="flex flex-wrap items-center gap-2">
    <Link href="/">
      <Button variant="outline" size="sm">
        <Home className="mr-2 h-4 w-4" />
        메뉴
      </Button>
    </Link>

    <Link href="/samples">
      <Button variant="outline" size="sm">
        샘플 리스트
      </Button>
    </Link>
  </div>
</div>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            발주 상태 데이터가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <Link key={group.ordered_date} href={`/orders/${group.ordered_date}`}>
              <Card className="transition hover:bg-muted/30">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <div className="text-lg font-semibold">
                      {formatDateLabel(group.ordered_date)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      품번 {group.china_codes.length}종 / 행 {group.items.length}건
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    발주서 보기
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}