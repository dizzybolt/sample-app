import { createClient } from '@/lib/supabase/server'
import { SampleDateList } from '@/components/sample-date-list'
import type { SampleEntry, ColorCode } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function getSamples(): Promise<SampleEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sample_entries')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching samples:', error)
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

export default async function SamplesPage() {
  const [samples, colorCodes] = await Promise.all([
    getSamples(),
    getColorCodes(),
  ])

  return <SampleDateList initialSamples={samples} colorCodes={colorCodes} />
}