export const KOREA_TIME_ZONE = 'Asia/Seoul'

export function toKoreaDate(value?: string | Date | null) {
  if (!value) return ''

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KOREA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) return ''

  return `${year}-${month}-${day}`
}

export function getKoreaToday(now = new Date()) {
  return toKoreaDate(now)
}

export function formatKoreaDate(
  value?: string | Date | null,
  separator = '.'
) {
  const date = toKoreaDate(value)

  if (!date) return ''

  return date.replaceAll('-', separator)
}

export function diffKoreaCalendarDays(
  value?: string | Date | null,
  now = new Date()
) {
  const baseDate = toKoreaDate(value)
  const today = toKoreaDate(now)

  if (!baseDate || !today) return null

  const [baseYear, baseMonth, baseDay] = baseDate.split('-').map(Number)
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number)

  const baseUtc = Date.UTC(baseYear, baseMonth - 1, baseDay)
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay)

  return Math.floor((todayUtc - baseUtc) / (1000 * 60 * 60 * 24))
}
