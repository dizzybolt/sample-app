import { OpsDataFreshness } from '@/components/ops-data-freshness'
import { RocketReorderManager } from '@/components/rocket-reorder-manager'

export default function RocketReorderPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">쿠팡로켓 발주추천</h1>
          <p className="mt-2 text-sm text-gray-500">
            쿠팡로켓 출고수량과 최신 OPS 현재고를 결합해 모델·SKU별 발주 필요수량을 계산합니다.
          </p>
        </div>

        <OpsDataFreshness sources={['sales', 'stock']} />
      </section>

      <RocketReorderManager />
    </div>
  )
}
