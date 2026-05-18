import { createClient } from '@/lib/supabase/server'
import type { OrderSizeQuantity, PrintHeader, PrintColumnHeader, SampleEntry, SizeGroup, OrderExtraRow, } from '@/lib/types'
import { OrderSheetClient } from '@/components/order-sheet-client'
import { get } from 'http'

export const dynamic = 'force-dynamic'

interface OrderSheetPageProps {
  params: Promise<{
    date: string
    china_code: string
  }>
}

async function getOrderExtraRows(
  date: string,
  chinaCode: string
): Promise<OrderExtraRow[]> {
  const supabase = await createClient()

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

  return data || []
}

async function getPrintHeader(): Promise<PrintHeader | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('print_headers')
    .select('*')
    .eq('type', 'order')
    .single()

  if (error) {
    console.error('Error fetching order print header:', error)
    return null
  }

  return data
}

async function getPrintColumnHeaders(): Promise<PrintColumnHeader[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('print_column_headers')
    .select('*')
    .eq('type', 'order')

  if (error) {
    console.error('Error fetching order print column headers:', error)
    return []
  }

  return data || []
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

async function getSizeGroups(): Promise<SizeGroup[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('size_groups')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching size groups:', error)
    return []
  }

  return data || []
}

async function getOrderSizeQuantities(
  date: string,
  sampleIds: string[]
): Promise<OrderSizeQuantity[]> {
  if (sampleIds.length === 0) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('order_size_quantities')
    .select('*')
    .eq('order_date', date)
    .in('sample_entry_id', sampleIds)

  if (error) {
    console.error('Error fetching order size quantities:', error)
    return []
  }

  return data || []
}

export default async function OrderSheetPage({ params }: OrderSheetPageProps) {
  const resolvedParams = await params

  const date = decodeURIComponent(resolvedParams.date)
  const chinaCode = decodeURIComponent(resolvedParams.china_code)

  const samples = await getOrderSheetSamples(date, resolvedParams.china_code)
  const extraRows = await getOrderExtraRows(date, chinaCode)

  const [sizeGroups, printHeader, printColumnHeaders ] = await Promise.all([
    getSizeGroups(),
    getPrintHeader(),
    getPrintColumnHeaders(),
  ])

  const quantities = await getOrderSizeQuantities(
    date,
    samples.map((sample) => sample.id)
  )

  return (
    <OrderSheetClient
      date={date}
      chinaCode={chinaCode}
      initialSamples={samples}
      sizeGroups={sizeGroups}
      initialQuantities={quantities}
      printHeader={printHeader}
      printColumnHeaders={printColumnHeaders}
      initialExtraRows={extraRows}
    />
  )
}