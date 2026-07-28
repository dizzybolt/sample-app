import { RocketSkuManager } from '@/components/rocket-sku-manager'
import { OpsDataFreshness } from '@/components/ops-data-freshness'

export default function RocketSkusPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">로켓SKU관리</h1>
          <p className="mt-2 text-sm text-gray-500">
            쿠팡로켓 SKU별 매입가, 판매가, 수수료율을 관리합니다.
          </p>
        </div>

        <OpsDataFreshness sources={['images']} />
      </section>

      <RocketSkuManager />
    </div>
  )
}
