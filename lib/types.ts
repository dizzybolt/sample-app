export type StatusType = '확인' | '진행' | '미진행' | '발주'

export interface SampleEntry {
  id: string

  china_code: string
  korea_code?: string | null

  color_code?: string | null
  color_name?: string | null

  qty?: number | null

  status?: StatusType | null

  checked_at?: string | null
  confirmed_at?: string | null
  ordered_at?: string | null
  created_at?: string | null
  updated_at?: string | null

  order_qty?: number | null

  note?: string | null
  memo?: string | null
  image_url?: string | null
}

export interface ColorCode {
  id: string
  color_code: string
  color_name: string
  is_active?: boolean | null
  sort_order?: number | null
  created_at?: string | null
}

export interface SampleGroup {
  china_code: string
  representative: SampleEntry
  items: SampleEntry[]
}