import { createClient } from '@/lib/supabase/server'
import { ItemCardList } from '@/components/item-card-list'
import type { ColorCode, SampleEntry, Studio } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function getSamples(): Promise<SampleEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sample_entries')
    .select('*')
    .not('item_card_status', 'is', null)
    .order('checked_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching item cards:', error)
    return []
  }

  return data || []
}

async function getColorCodes(): Promise<ColorCode[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('color_codes')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching color codes:', error)
    return []
  }

  return data || []
}

export default async function ItemCardsPage() {
  const [samples, colorCodes, studios] = await Promise.all([
    getSamples(),
    getColorCodes(),
    getStudios(),
  ])

  return (
    <ItemCardList
      initialSamples={samples}
      colorCodes={colorCodes}
      studios={studios}
    />
  )
}

async function getStudios(): Promise<Studio[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('studios')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching studios:', error)
    return []
  }

  return data || []
}