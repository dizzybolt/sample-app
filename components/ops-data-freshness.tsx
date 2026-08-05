'use client'

import { useEffect, useState } from 'react'
import { Database, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SyncLog = {
  id: string
  sync_type: string
  source_file: string | null
  status: string
  success_count: number | null
  fail_count: number | null
  finished_at: string | null
}

export type OpsDataSource =
  | 'sales'
  | 'claim'
  | 'stock'
  | 'inbound'
  | 'images'

type OpsDataSourceConfig = {
  label: string
  syncTypes: string[]
}

const SOURCE_CONFIG: Record<OpsDataSource, OpsDataSourceConfig> = {
  sales: {
    label: '출고',
    // 평상시 갱신되는 RECENT 로그를 우선하고, 없을 때만 초기 ALL 로그를 사용한다.
    syncTypes: ['sales_daily', 'sales_daily_all'],
  },
  claim: {
    label: '클레임',
    syncTypes: ['claim_daily', 'claim_daily_all'],
  },
  stock: {
    label: '재고',
    syncTypes: ['stock_snapshot'],
  },
  inbound: {
    label: '입고',
    syncTypes: ['inbound_history'],
  },
  images: {
    label: '이미지',
    syncTypes: ['images'],
  },
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function getStatusText(log?: SyncLog | null) {
  if (!log) return '없음'

  if (log.status === 'success') return '정상'
  if (log.status === 'partial') return '일부 실패'

  return log.status || '확인필요'
}

function getStatusClass(log?: SyncLog | null) {
  if (!log) return 'text-gray-400'
  if (log.status === 'success') return 'text-green-600'
  if (log.status === 'partial') return 'text-amber-600'
  return 'text-red-600'
}

export function OpsDataFreshness({
  sources,
}: {
  sources: OpsDataSource[]
}) {
  const supabase = createClient()

  const [logsBySource, setLogsBySource] = useState<
    Partial<Record<OpsDataSource, SyncLog | null>>
  >({})
  const [loading, setLoading] = useState(false)

  async function fetchLogs() {
    setLoading(true)

    const syncTypes = Array.from(
      new Set(
        sources.flatMap((source) => SOURCE_CONFIG[source].syncTypes)
      )
    )

    const results = await Promise.all(
      syncTypes.map(async (syncType) => {
        const result = await supabase
          .from('ops_sync_logs')
          .select('*')
          .eq('sync_type', syncType)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        return { syncType, ...result }
      })
    )

    setLoading(false)

    const failedResult = results.find((result) => result.error)

    if (failedResult?.error) {
      console.error(failedResult.error)
      return
    }

    const logs = results
      .map((result) => result.data as SyncLog | null)
      .filter((log): log is SyncLog => Boolean(log))
    const nextLogs: Partial<Record<OpsDataSource, SyncLog | null>> = {}

    sources.forEach((source) => {
      const config = SOURCE_CONFIG[source]

      nextLogs[source] =
        config.syncTypes
          .map((syncType) =>
            logs.find((item) => item.sync_type === syncType)
          )
          .find(Boolean) || null
    })

    setLogsBySource(nextLogs)
  }

  useEffect(() => {
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="rounded-2xl border bg-white px-4 py-3 text-xs shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <Database className="h-4 w-4" />
          OPS 데이터
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-1 whitespace-nowrap">
        {sources.map((source) => {
          const log = logsBySource[source]

          return (
            <div
              key={source}
              className="flex items-center justify-between gap-4"
            >
              <span className="text-gray-500">
                {SOURCE_CONFIG[source].label}
              </span>
              <span className={getStatusClass(log)}>
                {formatDateTime(log?.finished_at)} · {getStatusText(log)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
