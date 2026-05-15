'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search } from 'lucide-react'
import type { ColorCode, ItemCardStatus, SampleEntry } from '@/lib/types'
import { groupSamplesByChinaCode } from '@/lib/order-utils'
import { SampleCard } from '@/components/sample-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ItemCardListProps {
  initialSamples: SampleEntry[]
  colorCodes: ColorCode[]
}

const ITEM_CARD_STATUS_OPTIONS: ItemCardStatus[] = [
  '촬영대기',
  '촬영중',
  '작업중',
  '작업완료',
]

export function ItemCardList({ initialSamples }: ItemCardListProps) {
  const [samples, setSamples] = useState(initialSamples)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredSamples = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return samples.filter((sample) => {
      const itemStatus = sample.item_card_status

      const matchesSearch =
        !keyword ||
        sample.china_code?.toLowerCase().includes(keyword) ||
        sample.korea_code?.toLowerCase().includes(keyword) ||
        sample.color_name?.toLowerCase().includes(keyword) ||
        sample.color_code?.toLowerCase().includes(keyword)

      const matchesStatus =
        statusFilter === 'all' || itemStatus === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [samples, searchTerm, statusFilter])

  const groupedSamples = useMemo(() => {
    return groupSamplesByChinaCode(filteredSamples)
  }, [filteredSamples])

  const handleEdit = (sample: SampleEntry) => {
    alert(`아이템카드 상태 수정 기능은 다음 단계에서 연결합니다.\n${sample.china_code}`)
  }

  const handleDelete = async (id: string) => {
    const ok = window.confirm('이 항목을 삭제하시겠습니까?')
    if (!ok) return

    const supabase = createClient()
    const { error } = await supabase.from('sample_entries').delete().eq('id', id)

    if (!error) {
      setSamples((prev) => prev.filter((sample) => sample.id !== id))
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">아이템카드</h1>
          <p className="mt-1 text-sm text-gray-500">
            진행 상태 샘플의 촬영/작업 상태를 중국품번 기준 카드로 확인합니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="중국품번, 한국품번, 색상 검색"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                전체
              </Button>

              {ITEM_CARD_STATUS_OPTIONS.map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {groupedSamples.length === 0 ? (
          <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-medium text-gray-900">아이템카드가 없습니다.</p>
            <p className="mt-1 text-sm text-gray-500">
              샘플관리에서 상태를 진행으로 변경하면 아이템카드에 표시됩니다.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groupedSamples.map((group) => (
              <SampleCard
                key={group.china_code}
                group={group}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  )
}