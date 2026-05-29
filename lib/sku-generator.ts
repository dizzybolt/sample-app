interface GenerateSkuParams {
  modelName: string
  colorCode: string
  colorName?: string
  sizes: string[]
}

export interface GeneratedSkuItem {
  sku: string
  colorCode: string
  colorName?: string
  sizeLabel: string
}

export function generateSkuList({
  modelName,
  colorCode,
  colorName,
  sizes,
}: GenerateSkuParams): GeneratedSkuItem[] {
  return sizes.map((size) => ({
    sku: `${modelName}_${colorCode}_${size}`,
    colorCode,
    colorName,
    sizeLabel: size,
  }))
}