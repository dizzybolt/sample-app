export interface SampleEntry {
  id: string
  china_code: string
  korea_code: string | null
  color_code: string | null
  color_name: string | null
  quantity: number
  checked_at: string | null
  status: string
  image_url: string | null
  memo: string | null
  created_at: string
}

export interface ColorCode {
  id: string
  color_code: string
  color_name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export type SampleStatus = '미진행' | '진행중' | '완료'
