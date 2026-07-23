import { InboundHistoryManager } from '@/components/inbound-history-manager'

export default function InboundHistoryPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-gray-900">입고이력</h1>
        <p className="mt-2 text-sm text-gray-500">
          OPS_CORE에서 동기화한 SKU별 입고일자와 입고수량을 조회합니다.
        </p>
      </section>

      <InboundHistoryManager />
    </div>
  )
}
