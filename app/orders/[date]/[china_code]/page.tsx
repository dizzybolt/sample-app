import { createClient } from '@/lib/supabase/server'
import type { SampleEntry } from '@/lib/types'
import { OrderSheetClient } from '@/components/order-sheet-client'

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

  return (
    <OrderSheetClient
      date={date}
      chinaCode={chinaCode}
      initialSamples={samples}
    />
  )
}