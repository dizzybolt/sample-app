import { ModelCodeManager } from '@/components/model-code-manager'

export default function ModelCodesPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">모델 코드 관리</h1>
            <p className="mt-1 text-sm text-gray-500">
              브랜드 / 카테고리 / 연도 / 시즌 코드를 관리합니다.
            </p>
          </div>
        </section>
        <section>
          <ModelCodeManager />
        </section>
      </div>
    </main>
  )
}