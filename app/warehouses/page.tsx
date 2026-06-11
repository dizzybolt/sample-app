import { WarehouseManager } from '@/components/warehouse-manager'

export default function WarehousesPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">창고 관리</h1>
            <p className="mt-1 text-sm text-gray-500">
              재고 운영용 창고를 관리합니다.
            </p>
          </div>
        </section>
        <section>
          <WarehouseManager />
        </section>
      </div>      
    </main>
  )
}