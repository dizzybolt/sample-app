import { ProductMaster } from '@/lib/types'

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
  const prefix =
    `${brandCode}${categoryCode}`

  const suffix =
    `${yearCode}${seasonCode}`

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
      prefix.length + 3
    )

    const seqNo = Number(seqText)

    if (!Number.isNaN(seqNo)) {
      maxSeq = Math.max(maxSeq, seqNo)
    }
  })

  const nextSeq = maxSeq + 1

  const seqText = String(nextSeq).padStart(3, '0')

  return {
    modelName:
      `${prefix}${seqText}${suffix}`,

    seqNo: nextSeq,
  }
}