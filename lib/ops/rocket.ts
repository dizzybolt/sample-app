import { createClient } from '@/lib/supabase/client'
import type { RocketSkuPriceRow } from '@/lib/ops/sales'

const PAGE_SIZE = 1000

export async function fetchAllRocketSkuPrices() {
  const supabase = createClient()
  const allRows: RocketSkuPriceRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('rocket_sku_prices')
      .select('sku, model_name, rocket_supply_price')
      .order('sku', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...(data as RocketSkuPriceRow[]))

    if (data.length < PAGE_SIZE) {
      break
    }
  }

  return allRows
}