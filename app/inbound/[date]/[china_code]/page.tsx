import { createClient } from '@/lib/supabase/server'
import type { SampleEntry } from '@/lib/types'
import { InboundSheetClient } from '@/components/inbound-sheet-client'

export const dynamic = 'force-dynamic'

interface InboundSheetPageProps {
  params: Promise<{
    date: string
    china_code: string
  }>
}

async function getInboundSheetSamples(
  date: string,
  chinaCode: string
): Promise<SampleEntry[]> {
  const supabase = await createClient()
  const decodedChinaCode = decodeURIComponent(chinaCode)

  const { data, error } = await supabase
    .from('sample_entries')
    .select('*')
    .eq('china_code', decodedChinaCode)
    .not('inbound_status', 'is', null)
    .order('color_code', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching inbound sheet samples:', error)
    return []
  }

  return (data || []).filter((sample) => {
    const dateKey =
      sample.inbound_expected_at?.slice(0, 10) ||
      sample.ordered_at?.slice(0, 10) ||
      sample.created_at?.slice(0, 10) ||
      '날짜없음'

    return dateKey === date
  })
}

export default async function InboundSheetPage({
  params,
}: InboundSheetPageProps) {
  const resolvedParams = await params

  const date = decodeURIComponent(resolvedParams.date)
  const chinaCode = decodeURIComponent(resolvedParams.china_code)

  const samples = await getInboundSheetSamples(
    date,
    resolvedParams.china_code
  )

  return (
    <InboundSheetClient
      date={date}
      chinaCode={chinaCode}
      initialSamples={samples}
    />
  )
}