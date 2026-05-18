export type SampleStatus =
  | '샘플입고'
  | '미진행'
  | '진행'
  | '보류'
  | '등록대기'

export type OrderStatus =
  | '발주대기'
  | '발주보류'
  | '발주완료'

export type InboundStatus =
  | '입고대기'
  | '입고완료'
  | '입고지연'
  | '입고누락'
  | '부분입고'
  | '추가입고'

export type ItemCardStatus =
  | '촬영대기'
  | '촬영중'
  | '작업대기'
  | '작업중'
  | '작업완료'

export interface SampleEntry {
  id: string
  china_code: string
  korea_code?: string | null
  color_code?: string | null
  color_name?: string | null
  qty?: number | null
  quantity?: number | null
  size_group_name?: string | null

  // 기존 status는 호환용으로 잠시 유지
  status?: string | null

  sample_status?: SampleStatus | null
  order_status?: OrderStatus | null
  inbound_status?: InboundStatus | null
  item_card_status?: ItemCardStatus | null

  checked_at?: string | null
  confirmed_at?: string | null
  created_at?: string | null
  updated_at?: string | null

  order_requested_at?: string | null
  ordered_at?: string | null
  order_qty?: number | null

  inbound_expected_at?: string | null
  inbound_at?: string | null
  inbound_expected_qty?: number | null

  shoot_requested_at?: string | null
  shoot_completed_at?: string | null
  work_started_at?: string | null
  work_completed_at?: string | null

  offline_qty?: number | null
  size?: string | null
  note?: string | null
  memo?: string | null
  image_url?: string | null

  inbound_received_qty?: number | null
  inbound_memo?: string | null

  product_name?: string | null
  sale_price?: number | null
  tag_price?: number | null
  cost_price?: number | null

  studio_id?: string | null
  studio_name?: string | null
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

export interface OrderDateGroup {
  ordered_date: string
  items: SampleEntry[]
  china_codes: string[]
}

export interface OrderSheetGroup {
  ordered_date: string
  china_code: string
  representative: SampleEntry
  items: SampleEntry[]
}

export interface InboundSheetGroup {
  inbound_date: string
  china_code: string
  representative: SampleEntry
  items: SampleEntry[]
}

export interface SizeGroup {
  id: string
  name: string
  sizes: string[]
  sort_order?: number | null
  is_active?: boolean | null
  created_at?: string | null
}

export interface OrderSizeQuantity {
  id: string

  sample_entry_id?: string | null

  order_date?: string | null

  china_code?: string | null

  color_code?: string | null

  size_group_name?: string | null

  size_label: string

  qty?: number | null

  created_at?: string | null

  updated_at?: string | null
}

export interface InboundSizeQuantity {
  id: string

  sample_entry_id?: string | null

  inbound_date?: string | null

  china_code?: string | null

  color_code?: string | null

  size_group_name?: string | null

  size_label: string

  qty?: number | null

  created_at?: string | null

  updated_at?: string | null
}

export interface Studio {
  id: string
  name: string
  manager_name?: string | null
  phone?: string | null
  memo?: string | null
  sort_order?: number | null
  is_active?: boolean | null
  created_at?: string | null
}

export interface PrintHeader {
  id: string
  type: 'order' | 'inbound'
  title?: string | null
  subtitle?: string | null
  company_name?: string | null
  company_info?: string | null
  footer_memo?: string | null
  created_at?: string | null
  updated_at?: string | null
}