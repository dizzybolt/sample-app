import Link from 'next/link'
import { ClipboardList, FileText, PackageCheck, IdCard } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const menus = [
  {
    title: '샘플리스트',
    description: '샘플 등록, 수정, 검색, 상태 관리를 합니다.',
    href: '/samples',
    icon: ClipboardList,
  },
  {
    title: '발주현황',
    description: '발주 상태의 샘플을 날짜별로 확인합니다.',
    href: '/orders',
    icon: FileText,
  },
  {
    title: '입고현황(제작중)',
    description: '입고 완료 샘플을 확인합니다.',
    href: '/inbound',
    icon: PackageCheck,
  },
  {
    title: '아이템카드(제작중)',
    description: '품번별 대표 이미지와 색상 정보를 카드 형태로 확인합니다.',
    href: '/item-cards',
    icon: IdCard,
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            샘플 입고 관리
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            원하는 메뉴를 선택해 주세요.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menus.map((menu) => {
            const Icon = menu.icon

            return (
              <Link key={menu.href} href={menu.href}>
                <Card className="h-full transition hover:-translate-y-1 hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                      <Icon className="h-6 w-6 text-gray-700" />
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {menu.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        {menu.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}