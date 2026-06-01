import { InventoryManager } from '@/components/inventory-manager'

export default function InventoryPage() {
  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-gray-900">재고관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          창고별 SKU 재고를 등록하고 수량 변경 이력을 관리합니다.
        </p>
      </section>

      <InventoryManager />
    </main>
  )
}