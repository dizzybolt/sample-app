import { createClient } from '@/lib/supabase/server'
import { SampleDateList } from '@/components/sample-date-list'
import type { SampleEntry, ColorCode } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface SamplesPageProps {
  searchParams: Promise<{
    year?: string
    month?: string
  }>
}

function getKoreaNowParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)

  return { year, month }
}

function getMonthUtcRange(year: number, month: number) {
  // DB의 checked_at / created_at은 timestamptz이므로
  // 한국시간 월 시작 00:00을 UTC로 변환해 조회한다.
  const start = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0))
  const end = new Date(Date.UTC(year, month, 1, -9, 0, 0))

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

async function getSamples(
  year: number,
  month: number
): Promise<SampleEntry[]> {
  const supabase = await createClient()
  const { startIso, endIso } = getMonthUtcRange(year, month)

  const { data, error } = await supabase
    .from('sample_entries')
    .select('*')
    .or(
      [
        `and(checked_at.gte.${startIso},checked_at.lt.${endIso})`,
        `and(checked_at.is.null,created_at.gte.${startIso},created_at.lt.${endIso})`,
      ].join(',')
    )
    .order('checked_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching samples:', error)
    return []
  }

  return data || []
}

async function getAvailableYears(currentYear: number): Promise<number[]> {
  const supabase = await createClient()

  const [checkedResult, createdResult] = await Promise.all([
    supabase
      .from('sample_entries')
      .select('checked_at')
      .not('checked_at', 'is', null)
      .order('checked_at', { ascending: true })
      .limit(1),
    supabase
      .from('sample_entries')
      .select('created_at')
      .not('created_at', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1),
  ])

  if (checkedResult.error) {
    console.error('Error fetching earliest checked_at:', checkedResult.error)
  }

  if (createdResult.error) {
    console.error('Error fetching earliest created_at:', createdResult.error)
  }

  const candidates = [
    checkedResult.data?.[0]?.checked_at,
    createdResult.data?.[0]?.created_at,
  ].filter(Boolean) as string[]

  let earliestYear = currentYear

  for (const value of candidates) {
    const yearText = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
    }).format(new Date(value))

    const year = Number(yearText)
    if (Number.isFinite(year)) {
      earliestYear = Math.min(earliestYear, year)
    }
  }

  return Array.from(
    { length: currentYear - earliestYear + 1 },
    (_, index) => currentYear - index
  )
}

async function getColorCodes(): Promise<ColorCode[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('color_codes')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching color codes:', error)
    return []
  }

  return data || []
}

export default async function SamplesPage({
  searchParams,
}: SamplesPageProps) {
  const params = await searchParams
  const now = getKoreaNowParts()

  const requestedYear = Number(params.year)
  const requestedMonth = Number(params.month)

  const selectedYear =
    Number.isInteger(requestedYear) && requestedYear >= 2000
      ? requestedYear
      : now.year

  const selectedMonth =
    Number.isInteger(requestedMonth) &&
    requestedMonth >= 1 &&
    requestedMonth <= 12
      ? requestedMonth
      : now.month

  const [samples, colorCodes, availableYears] = await Promise.all([
    getSamples(selectedYear, selectedMonth),
    getColorCodes(),
    getAvailableYears(now.year),
  ])

  const years = Array.from(
    new Set([selectedYear, now.year, ...availableYears])
  ).sort((a, b) => b - a)

  return (
    <SampleDateList
      key={`${selectedYear}-${selectedMonth}`}
      initialSamples={samples}
      colorCodes={colorCodes}
      selectedYear={selectedYear}
      selectedMonth={selectedMonth}
      availableYears={years}
    />
  )
}
