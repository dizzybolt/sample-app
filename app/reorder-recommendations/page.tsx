import { ReorderRecommendationsManager } from '@/components/reorder-recommendations-manager'
import { OpsDataFreshness } from '@/components/ops-data-freshness'

export default function ReorderRecommendationsPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">발주추천</h1>
          <p className="mt-2 text-sm text-gray-500">
            시즌 분석기간의 판매속도와 인접 입고·최신 현재고를 결합해
            SKU별 추천 발주수량을 계산합니다.
          </p>
        </div>

        <OpsDataFreshness sources={['inbound', 'sales', 'stock']} />
      </section>

      <ReorderRecommendationsManager />
    </div>
  )
}
