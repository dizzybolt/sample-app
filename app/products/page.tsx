import { ProductMasterManager } from '@/components/product-master-manager'
import { OpsDataFreshness } from '@/components/ops-data-freshness'

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">상품 마스터</h1>
            <p className="mt-1 text-sm text-gray-500">
              OPS 재고의 모델·컬러·사이즈를 자동 반영하고 상품 정보를 보완합니다.
            </p>
          </div>
          <OpsDataFreshness sources={['stock']} />
        </section>
        <section>
          <ProductMasterManager />
        </section>
      </div>
    </main>
  )
}
