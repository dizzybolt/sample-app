import type { ProductMaster } from '@/lib/types'

interface GenerateModelNameParams {
  brandCode: string
  categoryCode: string
  yearCode: string
  seasonCode: string
  existingProducts: ProductMaster[]
}

export function generateNextModelName({
  brandCode,
  categoryCode,
  yearCode,
  seasonCode,
  existingProducts,
}: GenerateModelNameParams) {
  const prefix = `${brandCode}${categoryCode}`
  const suffix = `${yearCode}${seasonCode}`

  const existingModelNames = new Set(
    existingProducts.map((product) => product.model_name)
  )

  const matched = existingProducts.filter(
    (product) =>
      product.brand_code === brandCode &&
      product.category_code === categoryCode &&
      product.year_code === yearCode &&
      product.season_code === seasonCode
  )

  let maxSeq = 0

  matched.forEach((product) => {
    const seqText = product.model_name.slice(
      prefix.length,
      product.model_name.length - suffix.length
    )

    const seqNo = Number(seqText)

    if (!Number.isNaN(seqNo)) {
      maxSeq = Math.max(maxSeq, seqNo)
    }
  })

  let nextSeq = maxSeq + 1
  let modelName = ''

  while (true) {
    const seqText = String(nextSeq).padStart(3, '0')
    modelName = `${prefix}${seqText}${suffix}`

    if (!existingModelNames.has(modelName)) {
      break
    }

    nextSeq += 1
  }

  return {
    modelName,
    seqNo: nextSeq,
  }
}