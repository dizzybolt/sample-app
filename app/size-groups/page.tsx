import { createClient } from '@/lib/supabase/server'
import type { SizeGroup } from '@/lib/types'
import { SizeGroupManager } from '@/components/size-group-manager'

export const dynamic = 'force-dynamic'

async function getSizeGroups(): Promise<SizeGroup[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('size_groups')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching size groups:', error)
    return []
  }

  return data || []
}

export default async function SizeGroupsPage() {
  const sizeGroups = await getSizeGroups()

  return <SizeGroupManager initialSizeGroups={sizeGroups} />
}