import { createClient } from '@/lib/supabase/server'
import type {
  InboundSizeQuantity,
  OrderExtraRow,
  OrderSizeQuantity,
  PrintColumnHeader,
  PrintHeader,
  SampleEntry,
} from '@/lib/types'
import { InboundSheetClient } from '@/components/inbound-sheet-client'

export const dynamic = 'force-dynamic'

interface InboundSheetPageProps {
  params: Promise<{
    date: string
    china_code: string
  }>
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
      toKoreaDate(sample.order_requested_at) ||
      toKoreaDate(sample.ordered_at) ||
      toKoreaDate(sample.created_at) ||
      '날짜없음'

    return dateKey === date
  })
}

async function getOrderSizeQuantities(
  sampleIds: string[]
): Promise<OrderSizeQuantity[]> {
  if (sampleIds.length === 0) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('order_size_quantities')
    .select('*')
    .in('sample_entry_id', sampleIds)

  if (error) {
    console.error('Error fetching order size quantities:', error)
    return []
  }

  return data || []
}

async function getInboundSizeQuantities(
  date: string,
  sampleIds: string[]
): Promise<InboundSizeQuantity[]> {
  if (sampleIds.length === 0) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inbound_size_quantities')
    .select('*')
    .eq('inbound_date', date)
    .in('sample_entry_id', sampleIds)

  if (error) {
    console.error('Error fetching inbound size quantities:', error)
    return []
  }

  return data || []
}

async function getPrintHeader(): Promise<PrintHeader | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('print_headers')
    .select('*')
    .eq('type', 'inbound')
    .single()

  if (error) {
    console.error('Error fetching inbound print header:', error)
    return null
  }

  return data
}

async function getPrintColumnHeaders(): Promise<PrintColumnHeader[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('print_column_headers')
    .select('*')
    .eq('type', 'inbound')

  if (error) {
    console.error('Error fetching inbound print column headers:', error)
    return []
  }

  return data || []
}

async function getOrderExtraRows(
  date: string,
  chinaCode: string
): Promise<OrderExtraRow[]> {
  const supabase = await createClient()

  // 1차: 날짜 + 중국품번이 정확히 맞는 추가 행 조회
  const { data, error } = await supabase
    .from('order_extra_rows')
    .select('*')
    .eq('order_date', date)
    .eq('china_code', chinaCode)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching order extra rows:', error)
    return []
  }

  if (data && data.length > 0) {
    return data
  }

  // 2차: 날짜가 어긋난 기존 저장 데이터 대비용
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('order_extra_rows')
    .select('*')
    .eq('china_code', chinaCode)
    .order('order_date', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (fallbackError) {
    console.error('Error fetching fallback order extra rows:', fallbackError)
    return []
  }

  return fallbackData || []
}

export default async function InboundSheetPage({
  params,
}: InboundSheetPageProps) {
  const resolvedParams = await params

  const date = decodeURIComponent(resolvedParams.date)
  const chinaCode = decodeURIComponent(resolvedParams.china_code)

  const samples = await getInboundSheetSamples(date, resolvedParams.china_code)
  const sampleIds = samples.map((sample) => sample.id)

  const [
    orderQuantities,
    inboundQuantities,
    printHeader,
    columnHeaders,
    orderExtraRows,
  ] = await Promise.all([
    getOrderSizeQuantities(sampleIds),
    getInboundSizeQuantities(date, sampleIds),
    getPrintHeader(),
    getPrintColumnHeaders(),
    getOrderExtraRows(date, chinaCode),
  ])

  return (
    <InboundSheetClient
      date={date}
      chinaCode={chinaCode}
      initialSamples={samples}
      orderQuantities={orderQuantities}
      initialInboundQuantities={inboundQuantities}
      printHeader={printHeader}
      columnHeaders={columnHeaders}
      orderExtraRows={orderExtraRows}
    />
  )
}