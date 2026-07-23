import { ReorderRecommendationsManager } from '@/components/reorder-recommendations-manager'

export default function ReorderRecommendationsPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-gray-900">발주추천</h1>
        <p className="mt-2 text-sm text-gray-500">
          시즌 분석기간의 순판매(판매-CLAIM) 속도와 인접 입고·최신
          현재고를 결합해 SKU별 추천 발주수량을 계산합니다.
        </p>
      </section>

      <ReorderRecommendationsManager />
    </div>
  )
}
