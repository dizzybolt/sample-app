import { createClient } from '@/lib/supabase/server'
import type { PrintColumnHeader, PrintHeader } from '@/lib/types'
import { PrintHeaderManager } from '@/components/print-header-manager'

export const dynamic = 'force-dynamic'

async function getPrintHeaders(): Promise<PrintHeader[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('print_headers')
    .select('*')
    .order('type', { ascending: true })

  if (error) {
    console.error('Error fetching print headers:', error)
    return []
  }

  return data || []
}

async function getPrintColumnHeaders(): Promise<PrintColumnHeader[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('print_column_headers')
    .select('*')
    .order('type', { ascending: true })
    .order('column_key', { ascending: true })

  if (error) {
    console.error('Error fetching print column headers:', error)
    return []
  }

  return data || []
}

export default async function PrintHeadersPage() {
  const [headers, columnHeaders] = await Promise.all([
    getPrintHeaders(),
    getPrintColumnHeaders(),
  ])

  return (
    <PrintHeaderManager
      initialHeaders={headers}
      initialColumnHeaders={columnHeaders}
    />
  )
}