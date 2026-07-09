import Link from 'next/link'
import {
  BarChart3,
  Barcode,
  BookOpen,
  Camera,
  ChevronDown,
  ClipboardList,
  FileCog,
  FileText,
  Home,
  IdCard,
  ImageIcon,
  Layers3,
  Menu,
  Package,
  PackageCheck,
  Palette,
  Ruler,
  Settings,
  Shirt,
  Truck,
  Warehouse,
  Wrench,
  X,
  Combine,
  Boxes,
  Grid2x2Plus,
  Images,
  LayoutList,
  TrendingUp,
} from 'lucide-react'

const sections = [
  {
    title: '운영관리',
    items: [
      { title: '대시보드', href: '/dashboard', icon: BarChart3, desc: '전체 업무 현황 확인' },
      { title: '샘플관리', href: '/samples', icon: ClipboardList, desc: '신규 샘플 등록 및 상태 관리' },
      { title: '발주관리', href: '/orders', icon: FileText, desc: '발주서 작성 및 발주수량 관리' },
      { title: '입고관리', href: '/inbound', icon: PackageCheck, desc: '입고 회차별 수량 관리' },
      { title: '상품 마스터', href: '/products', icon: LayoutList, desc: '상품 기준 등록 및 관리' },
    ],
  },
  {
    title: '상품관리',
    items: [
      { title: '아이템카드', href: '/item-cards', icon: IdCard, desc: '촬영/작업 상태와 상품정보 관리' },
      { title: 'SKU 매핑관리', href: '/sku-mappings', icon: Barcode, desc: '품번번호/단품번호와 SKU 매핑' },
      { title: '이미지관리', href: '/product-images', icon: Images, desc: '모델명 기준 이미지 URL 관리' },
    ],
  },
  {
    title: '재고관리',
    items: [
      { title: '재고관리', href: '/inventory', icon: Boxes, desc: '창고별 SKU 재고 관리' },
      //{ title: '재고 등록/수정', href: '/inventory-adjustments', icon: PackageCheck, desc: '재고 등록/수정' },
      { title: '창고관리', href: '/warehouses', icon: Warehouse, desc: '재고 반영 창고 관리' },
    ],
  },
  {
    title: '판매관리',
    items: [
      { title: '주문통계', href: '/sales-stats', icon: TrendingUp, desc: '주문 통계 조회' },
      { title: '로켓SKU관리', href: '/rocket-skus', icon: Truck, desc: '로켓 SKU 관리' },
    ],
  },
  {
    title: '도구',
    items: [
      { title: '구성상품 생성기', href: '/utility/bundle-builder', icon: Combine, desc: '1+1 및 세트 구성 리스트 생성' },
    ],
  },
  {
    title: '설정',
    items: [
      { title: '모델명 생성 기준 설정', href: '/model-codes', icon: Settings, desc: '브랜드/카테고리/연도/시즌 코드 관리' },
      { title: '컬러 기준 설정', href: '/color-codes', icon: Palette, desc: '색상 코드 관리' },
      { title: '사이즈 기준 설정', href: '/size-groups', icon: Ruler, desc: '사이즈 그룹 관리' },
      { title: '스튜디오 관리', href: '/studios', icon: Camera, desc: '촬영 스튜디오 관리' },
      { title: '발주/입고 출력 헤더 설정', href: '/print-headers', icon: Grid2x2Plus, desc: '발주서/입고서 헤더 관리' },
    ],
  },
  {
    title: '가이드',
    items: [{ title: '가이드', href: '/guide', icon: BookOpen, desc: '사용 가이드' }],
  },
]

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-gray-900">BHPC OMA</h1>
        <p className="mt-2 text-sm text-gray-500">
          샘플, 발주, 입고, 상품, 재고, 업무 도구를 한 곳에서 관리합니다.
        </p>
      </section>

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {section.items.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-4 font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}