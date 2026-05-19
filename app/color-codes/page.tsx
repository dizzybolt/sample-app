import { createClient } from '@/lib/supabase/server'
import type { ColorCode } from '@/lib/types'
import { ColorCodeManager } from '@/components/color-code-manager'

export const dynamic = 'force-dynamic'

async function getColorCodes(): Promise<ColorCode[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('color_codes')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('color_code', { ascending: true })

  if (error) {
    console.error('Error fetching color codes:', error)
    return []
  }

  return data || []
}

export default async function ColorCodesPage() {
  const colorCodes = await getColorCodes()

  return <ColorCodeManager initialColorCodes={colorCodes} />
}