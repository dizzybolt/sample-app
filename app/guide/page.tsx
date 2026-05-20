import {
  BarChart3,
  Camera,
  ClipboardList,
  FileCog,
  FileText,
  Home,
  IdCard,
  ImageIcon,
  PackageCheck,
  Palette,
  Ruler,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const guideSections = [
  {
    title: '대시보드',
    icon: BarChart3,
    role: '앱 접속 시 처음 표시되는 메인 화면입니다. 전체 샘플, 아이템카드, 발주, 입고 상태를 한눈에 확인합니다.',
    usage: [
      '앱 접속 시 자동으로 대시보드로 이동합니다.',
      '샘플입고, 진행, 등록대기, 발주대기, 입고대기, 입고지연 KPI를 확인합니다.',
      '장기 대기 항목을 확인합니다.',
      '스튜디오별 촬영/작업 현황을 확인합니다.',
      '업무 흐름 보드로 전체 진행 상태를 확인합니다.',
      '최근 등록 상품을 확인합니다.',
      '빠른 이동 버튼으로 주요 페이지에 접근합니다.',
    ],
    note: '현재 앱의 실질적인 홈 화면입니다. 향후 홈 화면은 재고관리, 쇼핑몰 상품관리 등 추가 앱을 묶는 통합 앱 런처로 사용할 수 있습니다.',
  },
  {
    title: '샘플관리',
    icon: ClipboardList,
    role: '샘플을 신규 등록하고 상품화 진행 여부를 판단하는 시작 페이지입니다.',
    usage: [
      '새 샘플을 등록합니다.',
      '기본 상태는 샘플입고입니다.',
      '진행, 보류, 미진행, 등록대기 상태로 관리합니다.',
      '샘플 이미지를 수정할 수 있습니다.',
      '대표 이미지를 클릭하면 원본 확대 팝업이 열립니다.',
      '이미지 우측 하단 수정 버튼을 누르면 샘플 수정창이 열립니다.',
      '이미지 모아보기에서 색상별 이미지를 확인합니다.',
    ],
    note: '미진행은 상품화하지 않을 샘플, 진행은 상품화할 샘플로 구분합니다.',
  },
  {
    title: '아이템카드',
    icon: IdCard,
    role: '진행 샘플의 촬영, 작업 상태와 상품정보를 관리하는 페이지입니다.',
    usage: [
      '중국품번, 한국품번, 상품명 기준으로 검색할 수 있습니다.',
      '검색 구분을 선택하고 검색어가 비어 있으면 해당 값이 없는 항목만 표시됩니다.',
      '상태별 필터와 스튜디오 필터를 사용할 수 있습니다.',
      '스튜디오를 선택합니다.',
      '촬영중, 촬영완료, 작업중, 작업완료 상태를 변경합니다.',
      '촬영완료 선택 시 작업대기로 자동 전환됩니다.',
      '작업완료 선택 시 샘플 상태가 등록대기로 연결됩니다.',
      '한국품번, 상품명, 판매가, TAG가, 원가를 입력합니다.',
      '촬영이미지 링크를 입력하고 복사할 수 있습니다.',
      '대표 이미지를 클릭하면 원본 확대 팝업이 열립니다.',
      '이미지 모아보기 썸네일을 클릭하면 화면상 대표 이미지가 변경됩니다.',
    ],
    note: '썸네일 클릭은 저장 없이 화면상 대표 이미지만 변경합니다.',
  },
  {
    title: '발주관리',
    icon: FileText,
    role: '상품화 진행 샘플을 기준으로 발주서를 작성하고 발주완료 처리하는 페이지입니다.',
    usage: [
      '전체, 발주대기, 발주완료, 발주보류 필터를 사용할 수 있습니다.',
      '중국품번별 발주서를 엽니다.',
      '사이즈 구분을 선택하고 사이즈별 발주수량을 입력합니다.',
      '추가 행을 등록해 추가 컬러, 컬러 변경, 별도 요청 내용을 작성할 수 있습니다.',
      '이미지 별첨 아래에서 샘플 비고와 추가 행 비고를 확인할 수 있습니다.',
      '이미지 별첨 이미지를 클릭하면 원본 확대 팝업이 열립니다.',
      '발주서 표 컬럼명은 출력 헤더 관리에서 수정할 수 있습니다.',
      '발주서는 A4 기준으로 프린트할 수 있습니다.',
    ],
    note: '발주완료 처리 후 입고관리로 연결됩니다.',
  },
  {
    title: '입고관리',
    icon: PackageCheck,
    role: '발주완료된 상품의 실제 입고수량을 관리하는 페이지입니다.',
    usage: [
      '전체, 입고대기, 입고완료, 입고지연 필터를 사용할 수 있습니다.',
      '일자별 그룹은 발주요청일 기준으로 표시됩니다.',
      '발주요청일은 샘플관리의 발주요청일을 우선 사용하고, 없으면 발주완료일을 사용합니다.',
      '입고확인서에서 입고기준일을 날짜 선택으로 지정할 수 있습니다.',
      '발주서의 사이즈별 수량을 기준으로 실제 입고수량을 입력합니다.',
      '발주서의 추가 행도 입고확인서에 함께 표시됩니다.',
      '추가 행의 실제 입고수량도 입력하고 저장할 수 있습니다.',
      '입고완료 처리 시 입고완료, 부분입고, 추가입고, 입고누락 상태가 자동 계산됩니다.',
      '이미지 별첨 이미지를 클릭하면 원본 확대 팝업이 열립니다.',
      '입고확인서 표 컬럼명은 출력 헤더 관리에서 수정할 수 있습니다.',
    ],
    note: '입고수량은 향후 재고관리와 연결될 핵심 데이터입니다.',
  },
  {
    title: '이미지 확대',
    icon: ImageIcon,
    role: '이미지를 크게 확인하기 위한 공통 기능입니다.',
    usage: [
      '샘플관리 대표 이미지 클릭 시 확대 팝업이 열립니다.',
      '아이템카드 대표 이미지 클릭 시 확대 팝업이 열립니다.',
      '발주서 이미지 별첨 클릭 시 확대 팝업이 열립니다.',
      '입고확인서 이미지 별첨 클릭 시 확대 팝업이 열립니다.',
      '마우스 휠로 확대/축소할 수 있습니다.',
      '확대 상태에서 드래그해 이미지를 이동할 수 있습니다.',
      '100% 버튼으로 확대 상태를 초기화할 수 있습니다.',
    ],
    note: '팝업 확대 이미지는 원본 URL을 직접 표시합니다.',
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
    title: '컬러표',
    icon: Palette,
    role: '샘플 등록에서 사용할 컬러코드와 컬러명을 관리합니다.',
    usage: [
      '컬러코드를 추가합니다.',
      '컬러명을 수정합니다.',
      '정렬순서를 수정합니다.',
      '사용 여부를 관리합니다.',
      '삭제가 필요한 컬러를 제거할 수 있습니다.',
    ],
    note: '컬러표 수정 내용은 샘플 등록의 색상 선택 목록에 반영됩니다.',
  },
  {
    title: '스튜디오',
    icon: Camera,
    role: '아이템카드에서 선택할 촬영 스튜디오 목록을 관리합니다.',
    usage: [
      '스튜디오명을 등록합니다.',
      '담당자, 연락처, 메모를 관리합니다.',
      '아이템카드에서 스튜디오 선택과 필터로 사용됩니다.',
    ],
    note: '촬영 업무를 스튜디오별로 구분할 때 사용합니다.',
  },
  {
    title: '출력 헤더 관리',
    icon: FileCog,
    role: '발주서와 입고확인서의 출력 문구와 표 컬럼명을 관리합니다.',
    usage: [
      '발주서 제목과 부제목을 수정합니다.',
      '입고확인서 제목과 부제목을 수정합니다.',
      '회사명, 회사정보, 하단 메모를 입력합니다.',
      '발주서 표 컬럼명을 수정합니다.',
      '입고확인서 표 컬럼명을 수정합니다.',
      '한국어, 영어, 중국어 등 원하는 문구로 컬럼명을 변경할 수 있습니다.',
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
              샘플입고
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center font-medium">
              상품화 판단
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
          </div>

          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
            <p>
              기본 흐름은 샘플 등록 후 진행 여부를 판단하고, 진행 상품은 아이템카드와
              발주관리로 연결되며, 발주완료 후 입고관리에서 실제 입고수량을
              확정하는 구조입니다.
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            주요 상태값 기준
          </h2>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border p-3">
              <p className="font-semibold text-gray-900">샘플입고</p>
              <p className="mt-1 text-gray-500">
                샘플이 입고되었지만 아직 상품화 여부를 판단하기 전 상태입니다.
              </p>
            </div>

            <div className="rounded-xl border p-3">
              <p className="font-semibold text-gray-900">진행</p>
              <p className="mt-1 text-gray-500">
                상품화를 진행할 샘플입니다. 아이템카드와 발주관리로 연결됩니다.
              </p>
            </div>

            <div className="rounded-xl border p-3">
              <p className="font-semibold text-gray-900">미진행</p>
              <p className="mt-1 text-gray-500">
                입고되었지만 상품화하지 않을 샘플입니다.
              </p>
            </div>

            <div className="rounded-xl border p-3">
              <p className="font-semibold text-gray-900">보류</p>
              <p className="mt-1 text-gray-500">
                당장 진행하지 않고 검토를 보류한 샘플입니다.
              </p>
            </div>

            <div className="rounded-xl border p-3">
              <p className="font-semibold text-gray-900">등록대기</p>
              <p className="mt-1 text-gray-500">
                아이템카드 작업이 완료되어 쇼핑몰 등록을 기다리는 상태입니다.
              </p>
            </div>

            <div className="rounded-xl border p-3">
              <p className="font-semibold text-gray-900">입고완료</p>
              <p className="mt-1 text-gray-500">
                발주수량과 실제 입고수량을 기준으로 입고 처리가 완료된 상태입니다.
              </p>
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