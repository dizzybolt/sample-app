import { ClaimsManager } from '@/components/claims-manager'
import { OpsDataFreshness } from '@/components/ops-data-freshness'

export default function ClaimsPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">클레임 통계</h1>

          <p className="mt-2 text-sm text-gray-500">
            취소·반품 클레임을 일자, 쇼핑몰, 모델, SKU, 사유별로 조회합니다.
          </p>
        </div>

        <OpsDataFreshness sources={['claim']} />
      </section>

      <ClaimsManager />
    </div>
  )
}
