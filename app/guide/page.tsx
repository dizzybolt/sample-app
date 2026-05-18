import {
  BarChart3,
  Camera,
  ClipboardList,
  FileCog,
  FileText,
  Home,
  IdCard,
  PackageCheck,
  Ruler,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const guideSections = [
  {
    title: '홈',
    icon: Home,
    role: '앱의 메인 진입 페이지입니다.',
    usage: [
      '전체 메뉴로 이동하는 시작점입니다.',
      '업무 흐름을 확인하고 필요한 페이지로 이동합니다.',
    ],
    note: '향후 최근 작업 현황이나 오늘 처리할 업무를 표시할 수 있습니다.',
  },
  {
    title: '대시보드',
    icon: BarChart3,
    role: '전체 샘플, 발주, 입고, 작업 상태를 한눈에 확인하는 페이지입니다.',
    usage: [
      '상태별 수량을 확인합니다.',
      '장기 대기 항목을 확인합니다.',
      '각 카드 클릭 시 관련 페이지로 이동합니다.',
    ],
    note: '병목 구간과 장기 대기 항목을 우선 확인하는 용도로 사용합니다.',
  },
  {
    title: '샘플관리',
    icon: ClipboardList,
    role: '샘플 등록과 기본 상태 관리를 하는 시작 페이지입니다.',
    usage: [
      '새 샘플을 등록합니다.',
      '등록된 샘플의 이미지를 수정합니다.',
      '상태를 진행으로 변경하면 아이템카드와 발주관리로 연결됩니다.',
      '이미지 모아보기에서 각 색상별 샘플을 확인하고 수정할 수 있습니다.',
    ],
    note: '샘플 흐름의 시작점이므로 중국품번, 색상, 이미지, 비고를 정확히 입력하는 것이 중요합니다.',
  },
  {
    title: '아이템카드',
    icon: IdCard,
    role: '촬영/작업 상태와 상품정보를 관리하는 페이지입니다.',
    usage: [
      '스튜디오를 선택합니다.',
      '촬영중, 촬영완료, 작업중, 작업완료 상태를 변경합니다.',
      '한국품번, 상품명, 판매가, TAG가, 원가를 입력합니다.',
      '촬영이미지 링크를 입력하고 복사할 수 있습니다.',
      '이미지 모아보기에서 썸네일을 클릭하면 화면상 대표 이미지가 변경됩니다.',
    ],
    note: '작업완료 처리 시 샘플 상태가 등록대기로 연결됩니다.',
  },
  {
    title: '발주관리',
    icon: FileText,
    role: '진행 상태의 샘플을 기준으로 발주서를 작성하는 페이지입니다.',
    usage: [
      '발주 상태별로 필터링합니다.',
      '중국품번별 발주서를 엽니다.',
      '사이즈 구분을 선택하고 사이즈별 수량을 입력합니다.',
      '필요 시 추가 행을 등록해 추가 컬러나 변경 요청을 작성합니다.',
      '수량 저장 후 발주완료 처리합니다.',
      '발주서는 프린트할 수 있습니다.',
    ],
    note: '발주완료 처리 후 입고관리로 연결됩니다.',
  },
  {
    title: '입고관리',
    icon: PackageCheck,
    role: '발주완료된 상품의 실제 입고수량을 관리하는 페이지입니다.',
    usage: [
      '입고 상태별로 필터링합니다.',
      '발주서의 사이즈별 수량을 기준으로 실제 입고수량을 입력합니다.',
      '입고기준일을 선택합니다.',
      '입고완료 처리 시 부분입고, 추가입고, 입고누락, 입고완료 상태가 자동 계산됩니다.',
      '입고확인서를 프린트할 수 있습니다.',
    ],
    note: '실제 입고수량은 향후 재고관리와 연결될 핵심 데이터입니다.',
  },
  {
    title: '사이즈표',
    icon: Ruler,
    role: '발주서와 입고확인서에서 사용할 사이즈 구분을 관리합니다.',
    usage: [
      'FREE, 여성상의, 남성상의 등 사이즈 그룹을 등록합니다.',
      '각 그룹별 사이즈 값을 쉼표로 입력합니다.',
      '기존 사이즈 그룹을 수정하거나 삭제할 수 있습니다.',
    ],
    note: '사이즈표는 발주서와 입고관리 상세에서 공통으로 사용됩니다.',
  },
  {
    title: '스튜디오',
    icon: Camera,
    role: '아이템카드에서 선택할 촬영 스튜디오 목록을 관리합니다.',
    usage: [
      '스튜디오명을 등록합니다.',
      '담당자, 연락처, 메모를 관리합니다.',
      '아이템카드에서 스튜디오 필터와 선택값으로 사용됩니다.',
    ],
    note: '촬영 업무를 담당 스튜디오별로 구분할 때 사용합니다.',
  },
  {
    title: '출력 헤더 관리',
    icon: FileCog,
    role: '발주서와 입고확인서의 출력 문구와 표 컬럼명을 관리합니다.',
    usage: [
      '발주서 제목과 부제목을 수정합니다.',
      '입고확인서 제목과 부제목을 수정합니다.',
      '회사명, 회사정보, 하단 메모를 입력합니다.',
      '표의 컬럼명을 한국어/영어/중국어 등 원하는 문구로 수정합니다.',
    ],
    note: '프린트 문서에 표시되는 문구를 관리하는 관리자용 페이지입니다.',
  },
]

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section>
          <Badge variant="outline">Guide</Badge>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            사용 가이드
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            샘플 입고 관리 앱의 페이지별 역할과 사용 방법을 정리한 가이드입니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            전체 업무 흐름
          </h2>

          <div className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-5">
            <div className="rounded-xl bg-gray-50 p-3 text-center font-medium">
              샘플관리
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center font-medium">
              아이템카드
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center font-medium">
              발주관리
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center font-medium">
              입고관리
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center font-medium">
              등록대기
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {guideSections.map((section) => {
            const Icon = section.icon

            return (
              <Card key={section.title}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-gray-100 p-2">
                      <Icon className="h-5 w-5 text-gray-700" />
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {section.title}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {section.role}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      사용 방법
                    </p>

                    <ul className="mt-2 space-y-1 text-sm text-gray-600">
                      {section.usage.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
                    {section.note}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>
      </div>
    </main>
  )
}