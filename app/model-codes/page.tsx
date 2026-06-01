import ModelCodeManager from '@/components/model-code-manager'

export default function ModelCodesPage() {
  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-gray-900">
          모델 코드 관리
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          브랜드 / 카테고리 / 시즌 / 연도 코드를 관리합니다.
        </p>
      </section>

      <ModelCodeManager />
    </main>
  )
}