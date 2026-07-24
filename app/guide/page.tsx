import {
  BarChart3,
  Barcode,
  Boxes,
  Camera,
  ClipboardList,
  Combine,
  FileCog,
  FileSpreadsheet,
  FileText,
  Gift,
  Home,
  IdCard,
  Images,
  LayoutList,
  Package,
  PackageCheck,
  Palette,
  RotateCcw,
  Ruler,
  Settings,
  TrendingUp,
  Truck,
  Warehouse,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const guideSections = [
  {
    category: '운영관리',
    title: '전체 메뉴',
    icon: Home,
    role: '업무 영역별 전체 페이지를 한 화면에서 확인하고 이동하는 앱 시작 화면입니다.',
    usage: [
      '운영관리, 상품관리, 재고관리, 판매관리, 도구, 설정 영역을 구분해 확인합니다.',
      '각 카드의 설명을 확인하고 필요한 페이지로 이동합니다.',
      '발주추천은 재고관리 영역에서 열 수 있습니다.',
    ],
    note: '사이드바가 접혀 있거나 모바일 화면인 경우 전체 메뉴를 앱 런처로 활용할 수 있습니다.',
  },
  {
    category: '운영관리',
    title: '대시보드',
    icon: BarChart3,
    role: '전체 샘플과 상품화 진행, 발주, 입고 상태를 한눈에 확인하는 현황 화면입니다.',
    usage: [
      '샘플입고, 진행, 등록대기, 발주대기, 입고대기, 입고지연 KPI를 확인합니다.',
      '장기 대기 항목과 스튜디오별 촬영·작업 현황을 확인합니다.',
      '업무 흐름 보드와 최근 등록 상품을 확인합니다.',
      '빠른 이동 버튼으로 주요 운영 페이지를 엽니다.',
    ],
    note: '대시보드 수치는 각 운영 페이지의 저장 상태를 기준으로 집계됩니다.',
  },
  {
    category: '운영관리',
    title: '샘플관리',
    icon: ClipboardList,
    role: '신규 샘플을 등록하고 상품화 진행 여부와 발주요청 상태를 관리하는 시작 페이지입니다.',
    usage: [
      '샘플 기본정보, 색상, 이미지와 비고를 등록합니다.',
      '샘플입고, 진행, 보류, 미진행, 등록대기 상태로 관리합니다.',
      '대표 이미지와 색상별 이미지를 확인하고 수정합니다.',
      '날짜별 샘플 리스트를 엑셀로 다운로드합니다.',
      '이미지 포함 XLSM은 파일을 연 뒤 콘텐츠 사용을 눌러 이미지를 표시합니다.',
    ],
    note: '진행 샘플은 아이템카드와 발주관리로 연결되고, 미진행 샘플은 상품화 대상에서 제외됩니다.',
  },
  {
    category: '운영관리',
    title: '발주관리',
    icon: FileText,
    role: '상품화 진행 샘플을 중국품번 기준으로 묶어 발주서를 작성하고 발주완료 처리합니다.',
    usage: [
      '전체, 발주대기, 발주완료, 발주보류 상태를 필터링합니다.',
      '중국품번별 발주서를 열고 사이즈별 발주수량을 입력합니다.',
      '추가 컬러나 별도 요청은 추가 행과 비고로 작성합니다.',
      '발주서 이미지를 확대하고 A4 형식으로 인쇄합니다.',
      '이미지 포함 발주서 XLSM을 다운로드합니다.',
      '발주완료 처리해 입고관리 항목을 생성합니다.',
    ],
    note: '발주완료 처리 전 수량과 비고를 확인하세요. 완료된 발주는 입고관리의 기준 데이터가 됩니다.',
  },
  {
    category: '운영관리',
    title: '입고관리',
    icon: PackageCheck,
    role: '발주완료 상품의 회차별 실제 입고수량과 입고 상태를 관리합니다.',
    usage: [
      '전체, 입고대기, 입고완료, 입고지연 상태를 필터링합니다.',
      '입고확인서에서 입고기준일과 실제 입고수량을 입력합니다.',
      '발주서의 기본 행과 추가 행을 함께 확인합니다.',
      '입고완료, 부분입고, 추가입고, 입고누락 결과를 확인합니다.',
      '이미지 포함 입고확인서 XLSM을 다운로드하거나 인쇄합니다.',
    ],
    note: '이 화면은 발주 프로세스의 입고확인용이며, OPS_CORE에서 동기화되는 입고이력 페이지와 역할이 다릅니다.',
  },
  {
    category: '운영관리',
    title: '상품 마스터',
    icon: LayoutList,
    role: '모델명별 판매가, TAG가, 원가, 상태와 상품 기준정보를 관리합니다.',
    usage: [
      '모델코드 기준을 조합해 모델명을 생성하거나 직접 입력합니다.',
      '판매가, TAG가, 원가, 상품상태, 성별, 사이즈그룹과 비고를 저장합니다.',
      '모델별 SKU 등록 수와 상품 이미지를 함께 확인합니다.',
      '상태와 검색어로 상품을 조회합니다.',
      '정해진 헤더로 엑셀을 일괄 업로드하거나 목록을 다운로드합니다.',
    ],
    note: '모델코드, SKU 매핑, 이미지, 사이즈그룹이 준비되어 있으면 상품 기준정보를 더 일관되게 관리할 수 있습니다.',
  },
  {
    category: '상품관리',
    title: '아이템카드',
    icon: IdCard,
    role: '진행 샘플의 촬영·작업 상태와 실제 판매용 상품정보를 관리합니다.',
    usage: [
      '중국품번, 한국품번, 상품명과 상태·스튜디오 조건으로 검색합니다.',
      '촬영중, 촬영완료, 작업중, 작업완료 상태를 관리합니다.',
      '작업완료 시 샘플 상태가 등록대기로 연결되는지 확인합니다.',
      '한국품번, 상품명, 판매가, TAG가, 원가와 촬영이미지 링크를 관리합니다.',
      '대표 이미지와 색상별 이미지를 확대해 확인합니다.',
    ],
    note: '촬영완료는 작업대기로, 작업완료는 등록대기로 이어지는 운영 흐름을 확인하세요.',
  },
  {
    category: '상품관리',
    title: 'SKU 매핑관리',
    icon: Barcode,
    role: '품번번호·단품번호와 모델·색상·사이즈를 SKU에 연결하는 기준정보 페이지입니다.',
    usage: [
      '품번번호, 단품번호, 모델명, 색상코드, 색상명, 사이즈를 입력합니다.',
      '입력값을 기준으로 생성된 SKU를 확인하고 저장합니다.',
      'SKU, 모델명, 품번번호로 검색합니다.',
      '엑셀로 매핑을 일괄 등록하거나 현재 목록을 다운로드합니다.',
      '전체 엑셀 버튼으로 1,000건을 초과하는 전체 데이터도 내려받습니다.',
    ],
    note: 'SKU는 재고, 입고, 판매 분석을 연결하는 핵심 키이므로 중복이나 표기 차이를 확인한 뒤 저장하세요.',
  },
  {
    category: '상품관리',
    title: '이미지관리',
    icon: Images,
    role: '모델명별 대표 이미지 URL과 원본 파일 정보를 관리합니다.',
    usage: [
      '모델명과 이미지 URL을 필수로 입력합니다.',
      '파일명, FTP 경로와 비고를 함께 관리할 수 있습니다.',
      '모델명이나 이미지 URL로 검색합니다.',
      '엑셀 일괄 업로드와 이미지 목록 다운로드를 사용합니다.',
      '목록에서 썸네일과 실제 URL을 확인합니다.',
    ],
    note: '발주추천 이미지 포함 엑셀은 모델명으로 이 페이지의 이미지 URL을 찾아 사용합니다.',
  },
  {
    category: '재고관리',
    title: '재고관리',
    icon: Boxes,
    role: '창고별 SKU 재고와 수량 변경 이력을 관리하고 OPS_CORE 최신 재고를 함께 확인합니다.',
    usage: [
      '창고와 SKU를 기준으로 재고를 검색합니다.',
      '쉼표로 여러 SKU를 한 번에 검색할 수 있습니다.',
      '수량 수정 시 변경 사유를 입력하고 변경 로그를 확인합니다.',
      '창고명 또는 창고코드, SKU, 수량, 비고 형식으로 엑셀을 일괄 등록·수정합니다.',
      '현재 페이지 또는 전체 재고를 엑셀로 다운로드합니다.',
      '상단 데이터 갱신일로 OPS_CORE 동기화 시점을 확인합니다.',
    ],
    note: '수량 수정과 삭제는 변경 로그에 기록됩니다. 운영 재고를 변경하기 전에 창고와 SKU를 다시 확인하세요.',
  },
  {
    category: '재고관리',
    title: '입고이력',
    icon: Package,
    role: 'OPS_CORE에서 동기화한 SKU별 실제 입고일자와 입고수량을 조회합니다.',
    usage: [
      '시작일과 종료일을 직접 입력하거나 최근 30일·이번달 버튼을 사용합니다.',
      'SKU, 한국품번, 중국품번으로 검색합니다.',
      '색상코드, 사이즈, 입고위치 조건을 적용합니다.',
      '조회 건수와 총 입고수량을 확인합니다.',
      '최근 입고 동기화 시간과 성공 건수를 확인합니다.',
    ],
    note: '원본 CSV 갱신과 OPS_CORE 동기화가 완료된 이후에 최신 입고가 표시됩니다.',
  },
  {
    category: '재고관리',
    title: '발주추천',
    icon: FileSpreadsheet,
    role: '시즌 판매기간의 판매속도, 인접 입고와 최신 현재고로 SKU별 추천 발주수량을 계산합니다.',
    usage: [
      'SS, FW 등 분석할 시즌의 시작일과 종료일을 선택합니다.',
      '판매일수 계산 기본값은 전체 기간일이며, 필요하면 출고 발생일로 변경합니다.',
      '향후 예상 판매일수, 발주 적용률과 소진율 기준을 설정합니다.',
      '행사·특판처럼 판매량을 제외할 날짜를 입력합니다.',
      '기간 내 입고 또는 기간 경계에서 가장 가까운 직전·직후 입고를 기준으로 분석합니다.',
      '모델을 선택해 색상·사이즈별 SKU 계산을 확인합니다.',
      '전체 모델 목록과 선택 모델 SKU 상세목록을 이미지 포함 XLSM으로 다운로드합니다.',
    ],
    note: 'SKU 추천수량은 예상 판매량에서 최신 SKU 현재고를 차감한 값입니다. 최종 발주 전 리드타임과 시즌 운영계획을 함께 검토하세요.',
  },
  {
    category: '재고관리',
    title: '창고관리',
    icon: Warehouse,
    role: '재고 등록과 변경에 사용할 운영 창고를 관리합니다.',
    usage: [
      '창고명, 창고코드와 비고를 입력해 창고를 등록합니다.',
      '등록된 창고 목록을 확인합니다.',
      '더 이상 사용하지 않는 창고를 삭제합니다.',
    ],
    note: '재고가 연결된 창고는 삭제 전에 사용 여부와 관련 데이터를 확인하는 것이 안전합니다.',
  },
  {
    category: '판매관리',
    title: '주문통계',
    icon: TrendingUp,
    role: 'OPS_CORE 주문과 클레임 데이터를 결합해 순출고수량과 순매출 흐름을 분석합니다.',
    usage: [
      '이번주, 이번달, 이번분기, 올해 또는 직접 지정한 기간으로 조회합니다.',
      '쇼핑몰과 SKU·모델명 조건을 적용합니다.',
      '주문, 반품, 취소와 순출고수량·순매출금액을 비교합니다.',
      '이전 동일 기간 대비 증감률을 확인합니다.',
      '일자별·쇼핑몰별 순매출과 모델·SKU TOP 20을 확인합니다.',
      '쿠팡로켓 적용 매입가와 수량을 확인합니다.',
    ],
    note: '사은품 모델은 사은품 출고내역에서 별도 관리되며 주문통계 집계에서 제외됩니다.',
  },
  {
    category: '판매관리',
    title: '로켓SKU관리',
    icon: Truck,
    role: '쿠팡로켓 전용 SKU ID와 매입가, 판매가, 수수료율을 관리합니다.',
    usage: [
      'Rocket SKU ID, SKU, 모델명과 가격·수수료 정보를 등록합니다.',
      '모델 이미지를 함께 확인합니다.',
      'Rocket SKU ID, SKU 또는 모델명으로 검색합니다.',
      '엑셀로 일괄 업로드하거나 목록을 다운로드합니다.',
      '기존 항목을 수정하거나 삭제합니다.',
    ],
    note: '등록된 매입가와 수수료 정보는 주문통계의 쿠팡로켓 분석에 사용됩니다.',
  },
  {
    category: '판매관리',
    title: '클레임 통계',
    icon: RotateCcw,
    role: '취소·반품 클레임을 기간, 쇼핑몰, 유형, 상태와 사유별로 분석합니다.',
    usage: [
      '기간, 쇼핑몰, 클레임 구분, 처리상태와 사유를 선택합니다.',
      'SKU, 모델명 또는 물류메시지로 검색합니다.',
      '전체 클레임, 취소완료, 반품완료와 처리 중 수량을 확인합니다.',
      '일자·쇼핑몰·모델·SKU·사유별 통계를 확인합니다.',
      '원본 클레임 상세목록을 확인하고 엑셀로 다운로드합니다.',
    ],
    note: '처리 중 건은 최종 완료 통계와 다를 수 있으므로 처리상태 조건을 함께 확인하세요.',
  },
  {
    category: '판매관리',
    title: '사은품 출고내역',
    icon: Gift,
    role: '사은품 모델을 정의하고 일자·쇼핑몰·출고지별 사은품 출고수량을 조회합니다.',
    usage: [
      '주문통계에서 제외할 사은품 모델과 사은품명을 등록합니다.',
      '사은품 모델의 사용 여부와 비고를 관리합니다.',
      '기간, 사은품 모델, 쇼핑몰과 출고지로 출고내역을 조회합니다.',
      '총 출고수량과 모델·쇼핑몰·출고지 수를 확인합니다.',
      '조회된 출고목록을 엑셀로 다운로드합니다.',
    ],
    note: '사은품 모델 등록·삭제 결과는 주문통계의 제외 대상에 즉시 영향을 줍니다.',
  },
  {
    category: '도구',
    title: '구성상품 생성기',
    icon: Combine,
    role: 'SKU 매핑과 재고를 이용해 1+1 또는 다중 옵션 세트 구성상품 목록을 생성합니다.',
    usage: [
      '구성할 옵션 그룹을 추가합니다.',
      '모델명을 입력해 SKU 매핑과 재고를 불러오거나 엑셀을 업로드합니다.',
      '필요한 행을 직접 추가·수정·삭제합니다.',
      '옵션 1개는 1+1 규칙, 옵션 2개 이상은 세트 규칙으로 결과를 생성합니다.',
      '출력비율을 적용하고 생성 결과를 엑셀로 다운로드합니다.',
    ],
    note: '구성 결과는 SKU 매핑과 현재 재고 기준에 영향을 받으므로 원본 기준정보를 먼저 확인하세요.',
  },
  {
    category: '설정',
    title: '모델명 생성 기준 설정',
    icon: Settings,
    role: '상품 마스터에서 모델명을 생성할 때 사용하는 브랜드·카테고리·연도·시즌 코드를 관리합니다.',
    usage: [
      '브랜드, 카테고리, 연도, 시즌 탭을 선택합니다.',
      'NO, 코드, 명칭과 설명을 등록합니다.',
      '기존 코드를 수정하거나 삭제합니다.',
      '상품 마스터에서 조합된 모델명을 확인합니다.',
    ],
    note: '이미 모델명 생성에 사용한 코드는 변경·삭제 시 기존 데이터와 불일치할 수 있습니다.',
  },
  {
    category: '설정',
    title: '컬러 기준 설정',
    icon: Palette,
    role: '샘플과 SKU에서 사용할 컬러코드와 컬러명을 관리합니다.',
    usage: [
      '새 컬러코드와 컬러명을 추가합니다.',
      '컬러명, 정렬순서와 사용 여부를 수정합니다.',
      '불필요한 컬러를 삭제합니다.',
    ],
    note: '컬러코드 변경은 샘플과 SKU 표기에 영향을 줄 수 있으므로 기존 사용 여부를 확인하세요.',
  },
  {
    category: '설정',
    title: '사이즈 기준 설정',
    icon: Ruler,
    role: '발주서와 입고확인서에서 사용할 사이즈 그룹과 표시 순서를 관리합니다.',
    usage: [
      'FREE, 여성상의, 남성상의 등 사이즈 구분명을 등록합니다.',
      '그룹별 사이즈를 쉼표로 구분해 입력합니다.',
      '사이즈 목록과 정렬순서를 수정합니다.',
      '사용하지 않는 그룹을 삭제합니다.',
    ],
    note: '사이즈 그룹은 발주서, 입고확인서와 상품 마스터에서 공통으로 사용됩니다.',
  },
  {
    category: '설정',
    title: '스튜디오 관리',
    icon: Camera,
    role: '아이템카드에서 사용할 촬영 스튜디오와 담당자 정보를 관리합니다.',
    usage: [
      '스튜디오명, 담당자, 연락처와 메모를 등록합니다.',
      '표시 순서를 수정합니다.',
      '사용하지 않는 스튜디오를 삭제합니다.',
    ],
    note: '등록된 스튜디오는 아이템카드 선택 항목과 대시보드 현황에 사용됩니다.',
  },
  {
    category: '설정',
    title: '발주/입고 출력 헤더 설정',
    icon: FileCog,
    role: '발주서와 입고확인서의 출력 제목, 회사정보, 안내문과 표 컬럼명을 관리합니다.',
    usage: [
      '발주서·입고확인서 유형을 선택합니다.',
      '제목, 부제목, 회사명, 회사정보와 하단 메모를 저장합니다.',
      '각 문서의 표 컬럼 표시명을 변경합니다.',
      '한국어, 영어, 중국어 등 필요한 문구로 설정합니다.',
    ],
    note: '변경한 문구는 문서 출력 화면에 반영되므로 저장 후 실제 발주서와 입고확인서를 확인하세요.',
  },
]

const categories = Array.from(
  new Set(guideSections.map((section) => section.category))
)

const statusCards = [
  {
    title: '샘플입고',
    description: '샘플이 입고됐지만 상품화 여부를 판단하기 전 상태입니다.',
  },
  {
    title: '진행',
    description: '상품화를 진행하며 아이템카드와 발주관리로 연결됩니다.',
  },
  {
    title: '보류',
    description: '진행 여부를 추가 검토하기 위해 잠시 보류한 상태입니다.',
  },
  {
    title: '미진행',
    description: '상품화하지 않기로 결정한 샘플입니다.',
  },
  {
    title: '등록대기',
    description: '아이템카드 작업이 완료되어 쇼핑몰 등록을 기다리는 상태입니다.',
  },
  {
    title: '입고완료',
    description: '발주수량과 실제 입고수량을 기준으로 입고 처리가 완료된 상태입니다.',
  },
]

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section>
          <Badge variant="outline">Guide</Badge>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">
            전체 사용 가이드
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            현재 전체 메뉴에 구성된 페이지의 역할과 주요 사용법을 업무
            영역별로 정리했습니다.
          </p>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            기본 업무·데이터 흐름
          </h2>

          <div className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-3 lg:grid-cols-6">
            {[
              '샘플 등록',
              '상품화 판단',
              '아이템카드',
              '발주·입고',
              '재고·판매 동기화',
              '발주추천 분석',
            ].map((item, index) => (
              <div
                key={item}
                className="rounded-xl bg-gray-50 p-3 text-center font-medium"
              >
                <span className="mr-1 text-gray-400">{index + 1}.</span>
                {item}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-800">
            샘플·발주·입고 화면은 상품화 운영 과정을 관리합니다. 재고,
            입고이력, 주문통계와 클레임은 OPS_CORE 동기화 데이터를
            활용하며, 누적 데이터는 시즌별 발주추천 분석으로 연결됩니다.
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            주요 상태값 기준
          </h2>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {statusCards.map((status) => (
              <div key={status.title} className="rounded-xl border p-3">
                <p className="font-semibold text-gray-900">{status.title}</p>
                <p className="mt-1 text-gray-500">{status.description}</p>
              </div>
            ))}
          </div>
        </section>

        {categories.map((category) => (
          <section key={category} className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{category}</h2>
              <Badge variant="secondary">
                {
                  guideSections.filter(
                    (section) => section.category === category
                  ).length
                }
                개 페이지
              </Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {guideSections
                .filter((section) => section.category === category)
                .map((section) => {
                  const Icon = section.icon

                  return (
                    <Card key={section.title}>
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-gray-100 p-2">
                            <Icon className="h-5 w-5 text-gray-700" />
                          </div>

                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {section.title}
                            </h3>
                            <p className="mt-1 text-sm leading-5 text-gray-500">
                              {section.role}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            주요 사용법
                          </p>

                          <ul className="mt-2 space-y-1.5 text-sm leading-5 text-gray-600">
                            {section.usage.map((item) => (
                              <li key={item} className="flex gap-2">
                                <span className="text-gray-400">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-800">
                          {section.note}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 text-sm leading-6 text-gray-600 shadow-sm">
          <p className="font-semibold text-gray-900">
            이미지 포함 엑셀 공통 안내
          </p>
          <p className="mt-1">
            이미지 포함 파일은 매크로 사용 통합 문서(.xlsm) 형식입니다.
            Windows Excel에서 파일을 열고 상단 보안 경고의 콘텐츠 사용을
            누르면 이미지 URL을 기준으로 썸네일이 생성됩니다.
          </p>
        </section>
      </div>
    </main>
  )
}
