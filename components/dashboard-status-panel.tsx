'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/format'

type DashboardSample = {
  id: string
  china_code?: string | null
  korea_code?: string | null
  color_code?: string | null
  color_name?: string | null
  image_url?: string | null
  qty?: number | null
  quantity?: number | null
  item_card_status?: string | null
  inbound_status?: string | null
  inbound_at?: string | null
  inbound_received_qty?: number | null
  studio_name?: string | null
  checked_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

interface DashboardStatusPanelProps {
  samples: DashboardSample[]
}

const tabs = [
  { key: 'inbound', label: '입고 현황' },
  { key: 'sample', label: '샘플등록 현황' },
  { key: 'studio', label: '스튜디오 현황' },
] as const

type TabKey = (typeof tabs)[number]['key']

function formatDate(value?: string | null) {
  if (!value) return '-'
  return value.slice(0, 10)
}

function getLatestDateItems(
  samples: DashboardSample[],
  dateGetter: (sample: DashboardSample) => string | null | undefined,
  filterFn: (sample: DashboardSample) => boolean
) {
  const filtered = samples.filter(filterFn)

  if (filtered.length === 0) {
    return {
      latestDate: '-',
      items: [],
    }
  }

  const latestDate = filtered
    .map((sample) => formatDate(dateGetter(sample)))
    .filter((date) => date !== '-')
    .sort()
    .at(-1)

  if (!latestDate) {
    return {
      latestDate: '-',
      items: [],
    }
  }

  return {
    latestDate,
    items: filtered.filter(
      (sample) => formatDate(dateGetter(sample)) === latestDate
    ),
  }
}

export function DashboardStatusPanel({ samples }: DashboardStatusPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('inbound')

  const currentData = useMemo(() => {
    if (activeTab === 'studio') {
      return getLatestDateItems(
        samples,
        (sample) =>
          sample.updated_at ||
          sample.checked_at ||
          sample.created_at,
        (sample) =>
          ['촬영대기', '촬영중', '작업대기', '작업중', '작업완료'].includes(
            sample.item_card_status || ''
          )
      )
    }

    if (activeTab === 'inbound') {
      return getLatestDateItems(
        samples,
        (sample) => sample.inbound_at || sample.updated_at,
        (sample) =>
          ['입고대기', '부분입고', '입고완료'].includes(
            sample.inbound_status || ''
          )
      )
    }

    return getLatestDateItems(
      samples,
      (sample) => sample.checked_at || sample.created_at,
      () => true
    )
  }, [activeTab, samples])

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">최근 현황</h2>
          <p className="mt-1 text-sm text-gray-500">
            선택한 구분의 최근 일자 기준 샘플을 확인합니다.
          </p>
        </div>

        <Badge variant="outline">{currentData.latestDate}</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              activeTab === tab.key
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-1">
        {currentData.items.length === 0 ? (
          <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">
            표시할 항목이 없습니다.
          </div>
        ) : (
          currentData.items.map((sample) => (
            <div
              key={sample.id}
              className="flex gap-3 rounded-xl border bg-white p-3"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {sample.image_url ? (
                  <Image
                    src={sample.image_url}
                    alt={sample.china_code || ''}
                    fill
                    className="object-contain p-1"
                    sizes="80px"
                    quality={45}
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">
                    없음
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-gray-900">
                  {sample.china_code || '-'}
                </p>
                <p className="truncate text-sm text-gray-500">
                  {sample.korea_code || '-'}
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <p>
                    색상: {sample.color_code || '-'} /{' '}
                    {sample.color_name || '-'}
                  </p>

                  {activeTab === 'studio' && (
                    <p>상태: {sample.item_card_status || '-'}</p>
                  )}

                  {activeTab === 'inbound' && (
                    <>
                      <p>상태: {sample.inbound_status || '-'}</p>
                      <p>
                        입고: {formatNumber(sample.inbound_received_qty || 0)}개
                      </p>
                    </>
                  )}

                  {activeTab === 'sample' && (
                    <p>
                      수량:{' '}
                      {formatNumber(sample.qty || sample.quantity || 0)}개
                    </p>
                  )}

                  {sample.studio_name && <p>스튜디오: {sample.studio_name}</p>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}