import Link from 'next/link'

export default function UtilityPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">유틸리티</h1>
            <p className="mt-1 text-sm text-gray-500">
              업무용 도구를 제공합니다.
            </p>
          </div>
        </section>
        <div className="grid gap-4 md:grid-cols-2">
            <Link
            href="/utility/bundle-builder"
            className="rounded-xl border p-6 hover:bg-muted"
            >
            <h2 className="font-semibold">
                번들 상품 생성
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
                입력된 모델명 기준 조합 상품 생성
            </p>
            </Link>
        </div>
        </div>
    </main>
  )
}