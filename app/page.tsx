import Link from 'next/link'
import {
  BarChart3,
  ClipboardList,
  FileText,
  IdCard,
  PackageCheck,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const menuItems = [
  {
    title: '대시보드',
    desc: '전체 업무 현황과 장기 대기 항목 확인',
    href: '/dashboard',
    icon: BarChart3,
  },
  {
    title: '샘플관리',
    desc: '신규 샘플 등록 및 상품화 상태 관리',
    href: '/samples',
    icon: ClipboardList,
  },
  {
    title: '아이템카드',
    desc: '촬영, 작업 상태와 상품정보 관리',
    href: '/item-cards',
    icon: IdCard,
  },
  {
    title: '발주관리',
    desc: '발주서 작성 및 발주수량 관리',
    href: '/orders',
    icon: FileText,
  },
  {
    title: '입고관리',
    desc: '입고 회차별 수량과 누적 입고 관리',
    href: '/inbound',
    icon: PackageCheck,
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">
            샘플 입고 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            필요한 업무 메뉴를 선택하세요.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item) => {
            const Icon = item.icon

            return (
              <Link key={item.href} href={item.href}>
                <Card className="h-full transition hover:-translate-y-1 hover:shadow-md">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100">
                      <Icon className="h-5 w-5 text-gray-700" />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-900">
                        {item.title}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {item.desc}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </section>
      </div>
    </main>
  )
}