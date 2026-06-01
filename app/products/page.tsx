import { ProductMasterManager } from '@/components/product-master-manager'

export default function ProductsPage() {
  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-gray-900">
          상품 마스터
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          브랜드/카테고리/연도/시즌 코드를 조합해 모델명을 생성하고 상품 마스터를 등록합니다.
        </p>
      </section>

      <ProductMasterManager />
    </main>
  )
}