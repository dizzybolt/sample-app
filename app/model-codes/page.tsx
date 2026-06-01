import { createClient } from '@/lib/supabase/server'
import type { ModelCode } from '@/lib/types'
import { ModelCodeManager } from '@/components/model-code-manager'

export const dynamic = 'force-dynamic'

async function getModelCodes(): Promise<ModelCode[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('model_codes')
    .select('*')
    .order('code_type', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true })

  if (error) {
    console.error('Error fetching model codes:', error)
    return []
  }

  return data || []
}

export default async function ModelCodesPage() {
  const modelCodes = await getModelCodes()

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-gray-900">
          모델 코드 관리
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          브랜드 / 카테고리 / 시즌 / 연도 코드를 관리합니다.
        </p>
      </section>

      <ModelCodeManager initialModelCodes={modelCodes} />
    </main>
  )
}