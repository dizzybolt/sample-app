import { ProductMasterManager } from '@/components/product-master-manager'

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">상품 마스터</h1>
            <p className="mt-1 text-sm text-gray-500">
              브랜드/카테고리/연도/시즌 코드를 조합해 모델명을 생성하고 상품 마스터를 등록합니다.
            </p>
          </div>
        </section>
        <section>
          <ProductMasterManager />
        </section>
      </div>
    </main>
  )
}