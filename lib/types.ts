export interface SampleEntry {
  id: string

  // 기본 정보
  china_code: string
  korea_code?: string | null

  // 색상
  color_code?: string | null
  color_name?: string | null

  // 수량
  qty?: number | null

  // 상태
  status?: '확인' | '진행' | '미진행' | '발주' | null

  // 날짜
  checked_at?: string | null       // 검수일
  confirmed_at?: string | null     // 확인일
  ordered_at?: string | null       // 발주일자
  created_at?: string | null
  updated_at?: string | null

  // 발주
  order_qty?: number | null

  // 기타
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