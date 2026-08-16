export type DemandReferenceKind = 'period' | 'normalized_8m' | 'no_data'

export type DemandReferenceRow = {
  model: string
  productName: string
  kind: DemandReferenceKind
  startMonth: string
  endMonth: string
  sourceLabel: string
  excludeFromValidation?: boolean
  validationNote?: string
}

export const REORDER_DEMAND_REFERENCE: DemandReferenceRow[] = [
  { model: 'A40TK153J4L', productName: '남녀 꽈배기 목폴라 니트', kind: 'no_data', startMonth: '', endMonth: '', sourceLabel: '자료없음' },
  { model: 'A40TK307K4', productName: '여성 폴로 꽈배기 니트 가디건', kind: 'period', startMonth: '2024-09', endMonth: '2024-10', sourceLabel: '2024-09~2024-10' },
  { model: 'A40TK703J4', productName: '여성 꽈배기 케이블 가디건', kind: 'period', startMonth: '2024-08', endMonth: '2024-10', sourceLabel: '2024-08~2024-10' },
  { model: 'A40TK702J4', productName: '여성 꽈배기 케이블 니트', kind: 'period', startMonth: '2024-08', endMonth: '2024-10', sourceLabel: '2024-08~2024-10' },
  { model: 'D04TK001J4', productName: '여성 가오리 꽈배기 목폴라 니트', kind: 'period', startMonth: '2025-11', endMonth: '2026-02', sourceLabel: '2025-11~2026-02' },
  { model: 'A40TK307M1', productName: '여성 케이블 봄 가디건', kind: 'period', startMonth: '2026-04', endMonth: '2026-05', sourceLabel: '2026-04~2026-05', excludeFromValidation: true, validationNote: '기존 발주서 작성 이후 판매가 계속 발생해 현재 시즌이 연장된 특수 모델' },
  { model: 'A40TK225K1', productName: '여성 스프링 케이블 라운드 니트', kind: 'period', startMonth: '2024-08', endMonth: '2024-09', sourceLabel: '2024-08~2024-09' },
  { model: 'A40TS011I3', productName: '남성 간절기 케이블 니트', kind: 'period', startMonth: '2025-09', endMonth: '2026-02', sourceLabel: '2025-09~2026-02' },
  { model: 'P20TK389K4', productName: '남성 오버립 크루넥 케이블 니트', kind: 'period', startMonth: '2025-11', endMonth: '2026-03', sourceLabel: '2025-11~2026-03' },
  { model: 'A40TS014I3', productName: '여성 간절기 케이블 니트', kind: 'period', startMonth: '2025-11', endMonth: '2026-05', sourceLabel: '2025-11~2026-05' },
  { model: 'A40TK382K4', productName: '여성 V넥 케이블 나그랑 니트', kind: 'period', startMonth: '2025-10', endMonth: '2026-03', sourceLabel: '2025-10~2026-03' },
  { model: 'A40TS410K3', productName: '여성 케이블 라운드넥 니트', kind: 'period', startMonth: '2025-03', endMonth: '2025-05', sourceLabel: '2025-03~2025-05' },
  { model: 'A40TK378K3', productName: '여성 라운드넥 케이블 니트 가디건', kind: 'period', startMonth: '2025-12', endMonth: '2026-02', sourceLabel: '2025-12~2026-02' },
  { model: 'A40TK303K4', productName: '여성 카라 투버튼 케이블 니트', kind: 'period', startMonth: '2024-10', endMonth: '2024-11', sourceLabel: '2024-10~2024-11' },
  { model: 'A40TK290K4', productName: '여성 소프트터치 케이블 니트', kind: 'period', startMonth: '2024-10', endMonth: '2025-03', sourceLabel: '2024-10~2025-03' },
  { model: 'A40TK304K4', productName: '여성 펀칭 라운드넥 긴팔 니트', kind: 'period', startMonth: '2024-09', endMonth: '2024-11', sourceLabel: '2024-09~2024-11' },
  { model: 'A40TK300K4', productName: '여성 투웨이 집업 니트 가디건', kind: 'period', startMonth: '2024-09', endMonth: '2025-02', sourceLabel: '2024-09~2025-02' },
  { model: 'A40TK237K1', productName: '여성 케이블 반집업 니트', kind: 'period', startMonth: '2024-08', endMonth: '2024-09', sourceLabel: '2024-08~2024-09' },
  { model: 'A43TS901J1', productName: '남성 오가닉코튼 케이블 니트', kind: 'period', startMonth: '2024-09', endMonth: '2025-03', sourceLabel: '2024-09~2025-03' },
  { model: 'A40TK321K4', productName: '여성 케이블 반목 니트', kind: 'period', startMonth: '2025-08', endMonth: '2026-03', sourceLabel: '2025-08~2026-03' },
  { model: 'A40TK319K4', productName: '여성 케이블 라운드 니트', kind: 'period', startMonth: '2025-08', endMonth: '2026-03', sourceLabel: '2025-08~2026-03' },
  { model: 'A40TK320K4', productName: '여성 케이블 목폴라 니트', kind: 'period', startMonth: '2025-08', endMonth: '2026-03', sourceLabel: '2025-08~2026-03' },
  { model: 'A40TK301J4', productName: '남녀 베이직 반집업 니트', kind: 'period', startMonth: '2025-08', endMonth: '2026-03', sourceLabel: '2025-08~2026-03' },
  { model: 'A40TK152J4', productName: '남녀 꽈배기 반목 니트', kind: 'normalized_8m', startMonth: '', endMonth: '', sourceLabel: '18개월 순판매×8/18' },
  { model: 'A40TK153J4', productName: '남녀 꽈배기 목폴라 니트', kind: 'normalized_8m', startMonth: '', endMonth: '', sourceLabel: '18개월 순판매×8/18' },
  { model: 'A40TK151J4', productName: '남녀 꽈배기 라운드 니트', kind: 'normalized_8m', startMonth: '', endMonth: '', sourceLabel: '18개월 순판매×8/18' },
  { model: 'P10TS416K4', productName: '여성 울블랜디드 솔리드 니트', kind: 'period', startMonth: '2025-08', endMonth: '2026-03', sourceLabel: '2025-08~2026-03' },
  { model: 'P10TS415K4', productName: '남성 울블랜디드 솔리드 니트', kind: 'period', startMonth: '2025-08', endMonth: '2026-03', sourceLabel: '2025-08~2026-03' },
  { model: 'A40TS407K3', productName: '남성 V넥 니트', kind: 'period', startMonth: '2025-08', endMonth: '2026-03', sourceLabel: '2025-08~2026-03' },
  { model: 'A40TS408K3', productName: '여성 V넥 니트', kind: 'period', startMonth: '2025-08', endMonth: '2026-03', sourceLabel: '2025-08~2026-03' },
  { model: 'P20TK400K4', productName: '기획 공용 니트', kind: 'period', startMonth: '2025-08', endMonth: '2026-03', sourceLabel: '2025-08~2026-03' },
  { model: 'A40TS409K3', productName: '남성 U넥 니트', kind: 'period', startMonth: '2025-08', endMonth: '2026-03', sourceLabel: '2025-08~2026-03' },
]
