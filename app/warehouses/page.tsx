import { WarehouseManager } from '@/components/warehouse-manager'

export default function WarehousesPage() {
  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-gray-900">
          창고 관리
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          재고 운영용 창고를 관리합니다.
        </p>
      </section>

      <WarehouseManager />
    </main>
  )
}