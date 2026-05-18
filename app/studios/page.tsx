import { createClient } from '@/lib/supabase/server'
import type { Studio } from '@/lib/types'
import { StudioManager } from '@/components/studio-manager'

export const dynamic = 'force-dynamic'

async function getStudios(): Promise<Studio[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('studios')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching studios:', error)
    return []
  }

  return data || []
}

export default async function StudiosPage() {
  const studios = await getStudios()

  return <StudioManager initialStudios={studios} />
}