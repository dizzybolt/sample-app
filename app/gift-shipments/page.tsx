import { GiftShipmentManager } from '@/components/gift-shipment-manager'
import { OpsDataFreshness } from '@/components/ops-data-freshness'

export default function GiftShipmentsPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            사은품 출고내역
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            사은품 모델을 관리하고 일자·쇼핑몰·출고지별 출고수량을 조회합니다.
          </p>
        </div>

        <OpsDataFreshness />
      </section>

      <GiftShipmentManager />
    </div>
  )
}