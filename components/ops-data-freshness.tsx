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

function formatDateTime(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'UTC',
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

export function OpsDataFreshness() {
  const supabase = createClient()

  const [salesLog, setSalesLog] = useState<SyncLog | null>(null)
  const [stockLog, setStockLog] = useState<SyncLog | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchLogs() {
    setLoading(true)

    const { data, error } = await supabase
      .from('ops_sync_logs')
      .select('*')
      .in('sync_type', ['sales_daily_all', 'stock_snapshot'])
      .order('finished_at', { ascending: false })
      .limit(20)

    setLoading(false)

    if (error) {
      console.error(error)
      return
    }

    const logs = (data || []) as SyncLog[]

    setSalesLog(logs.find((item) => item.sync_type === 'sales_daily_all') || null)
    setStockLog(logs.find((item) => item.sync_type === 'stock_snapshot') || null)
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
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">출고</span>
          <span className={getStatusClass(salesLog)}>
            {formatDateTime(salesLog?.finished_at)} · {getStatusText(salesLog)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">재고</span>
          <span className={getStatusClass(stockLog)}>
            {formatDateTime(stockLog?.finished_at)} · {getStatusText(stockLog)}
          </span>
        </div>
      </div>
    </div>
  )
}