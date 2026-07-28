import { InventoryManager } from '@/components/inventory-manager'
import { OpsDataFreshness } from '@/components/ops-data-freshness'

export default function InventoryPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">재고관리</h1>
            <p className="mt-1 text-sm text-gray-500">
            창고별 SKU 재고를 등록하고 수량 변경 이력을 관리합니다.
            </p>
          </div>
          <OpsDataFreshness sources={['stock']} />
        </section>
        <section>
          <InventoryManager />
        </section>
      </div>
    </main>
  )
}
