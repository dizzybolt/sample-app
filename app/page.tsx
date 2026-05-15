import Link from 'next/link'
import {
  BarChart3,
  ClipboardList,
  FileText,
  IdCard,
  PackageCheck,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const quickMenus = [
  {
    title: '대시보드',
    description: '샘플 상태별 통계와 병목 구간을 확인합니다.',
    href: '/dashboard',
    icon: BarChart3,
  },
  {
    title: '샘플관리',
    description: '샘플 등록, 수정, 진행 여부를 관리합니다.',
    href: '/samples',
    icon: ClipboardList,
  },
  {
    title: '아이템카드',
    description: '품번별 이미지와 촬영/작업 상태를 관리합니다.',
    href: '/item-cards',
    icon: IdCard,
  },
  {
    title: '발주관리',
    description: '진행 샘플의 발주 요청과 발주 완료를 관리합니다.',
    href: '/orders',
    icon: FileText,
  },
  {
    title: '입고관리',
    description: '발주 완료 샘플의 입고 예정과 입고 완료를 관리합니다.',
    href: '/inbound',
    icon: PackageCheck,
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            샘플 입고 관리 시스템
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            샘플 등록부터 아이템카드 작업, 발주, 입고까지 한 흐름으로 관리합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            빠른 이동
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {quickMenus.map((menu) => {
              const Icon = menu.icon

              return (
                <Link key={menu.href} href={menu.href}>
                  <Card className="h-full transition hover:-translate-y-1 hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                        <Icon className="h-6 w-6 text-gray-700" />
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {menu.title}
                        </h3>
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
        </section>
      </div>
    </main>
  )
}