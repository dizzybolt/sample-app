import { OpsDataFreshness } from '@/components/ops-data-freshness'
import { ReorderDemandManager } from '@/components/reorder-demand-manager'

export default function ReorderDemandPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">시즌수요 발주추천</h1>
          <p className="mt-2 text-sm text-gray-500">
            모델별 월 판매 흐름에서 대표 시즌구간을 자동 탐색하고 순판매량과 최신
            현재고를 결합해 발주 필요수량을 계산합니다.
          </p>
        </div>

        <OpsDataFreshness sources={['sales', 'claim', 'stock']} />
      </section>

      <ReorderDemandManager />
    </div>
  )
}
