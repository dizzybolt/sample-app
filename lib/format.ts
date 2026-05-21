export function formatNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const numberValue =
    typeof value === 'string'
      ? Number(value.replace(/,/g, ''))
      : value

  if (Number.isNaN(numberValue)) {
    return '-'
  }

  return numberValue.toLocaleString('ko-KR')
}