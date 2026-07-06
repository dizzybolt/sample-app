import { SalesStatsManager } from '@/components/sales-stats-manager'
import { OpsDataFreshness } from '@/components/ops-data-freshness'

export default function SalesStatsPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">출고통계</h1>
          <p className="mt-2 text-sm text-gray-500">
            OPS_CORE 출고 데이터를 기준으로 최근 출고수량과 판매 흐름을 확인합니다.
          </p>
        </div>

        <OpsDataFreshness />
      </section>

      <SalesStatsManager />
    </div>
  )
}