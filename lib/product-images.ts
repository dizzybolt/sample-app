export type ProductImageLookupRow = {
  model_name: string
  color_code: string | null
  image_key: string
  image_scope: 'MODEL' | 'COLOR'
  image_url: string
}

type ImageTarget = {
  modelName?: string | null
  colorCode?: string | null
  sku?: string | null
}

const IMAGE_SELECT =
  'model_name, color_code, image_key, image_scope, image_url'

export function normalizeModelName(value?: string | null) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

export function normalizeColorCode(value?: string | null) {
  const normalized = String(value || '').trim()
  return /^\d{1,2}$/.test(normalized)
    ? normalized.padStart(2, '0')
    : normalized
}

export function getImageTarget(target: ImageTarget) {
  const skuParts = String(target.sku || '').trim().toUpperCase().split('_')
  const modelName = normalizeModelName(target.modelName || skuParts[0])
  const colorCode = normalizeColorCode(target.colorCode || skuParts[1])

  return {
    modelName,
    colorCode,
    imageKey: modelName && colorCode ? `${modelName}_${colorCode}` : modelName,
  }
}

export async function fetchProductImageMap(
  supabase: any,
  targets: ImageTarget[],
  options: { modelOnly?: boolean } = {}
) {
  const normalizedTargets = targets
    .map(getImageTarget)
    .filter((target) => target.modelName)
  const modelNames = Array.from(
    new Set(normalizedTargets.map((target) => target.modelName))
  )
  const colorKeys = options.modelOnly
    ? []
    : Array.from(
        new Set(
          normalizedTargets
            .filter((target) => target.colorCode)
            .map((target) => target.imageKey)
        )
      )

  if (modelNames.length === 0) return new Map<string, string>()

  const modelQuery = supabase
    .from('product_images')
    .select(IMAGE_SELECT)
    .eq('image_scope', 'MODEL')
    .eq('is_active', true)
    .in('model_name', modelNames)

  const colorQuery =
    colorKeys.length > 0
      ? supabase
          .from('product_images')
          .select(IMAGE_SELECT)
          .eq('image_scope', 'COLOR')
          .eq('is_active', true)
          .in('image_key', colorKeys)
      : Promise.resolve({ data: [], error: null })

  const [modelResult, colorResult] = await Promise.all([
    modelQuery,
    colorQuery,
  ])

  if (modelResult.error) throw modelResult.error
  if (colorResult.error) throw colorResult.error

  const imageMap = new Map<string, string>()
  for (const row of (modelResult.data || []) as ProductImageLookupRow[]) {
    if (row.image_url && !imageMap.has(row.model_name)) {
      imageMap.set(row.model_name, row.image_url)
    }
  }
  for (const row of (colorResult.data || []) as ProductImageLookupRow[]) {
    if (row.image_url && !imageMap.has(row.image_key)) {
      imageMap.set(row.image_key, row.image_url)
    }
  }

  return imageMap
}

export function resolveProductImage(
  imageMap: Map<string, string>,
  target: ImageTarget
) {
  const { modelName, imageKey } = getImageTarget(target)
  return imageMap.get(imageKey) || imageMap.get(modelName) || null
}
