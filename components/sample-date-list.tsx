'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Plus, Search } from 'lucide-react'
import type { ColorCode, SampleEntry, SampleStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SampleForm } from '@/components/sample-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SampleDateListProps {
  initialSamples: SampleEntry[]
  colorCodes: ColorCode[]
}

const STATUS_OPTIONS: SampleStatus[] = [
  '샘플입고',
  '미진행',
  '진행',
  '보류',
  '등록대기',
]

function getDateKey(sample: SampleEntry) {
  return sample.checked_at?.slice(0, 10) || sample.created_at?.slice(0, 10) || '날짜없음'
}

export function SampleDateList({
  initialSamples,
  colorCodes,
}: SampleDateListProps) {
  const [samples, setSamples] = useState(initialSamples)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSample, setEditingSample] = useState<SampleEntry | null>(null)

  const filteredSamples = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return samples.filter((sample) => {
      const sampleStatus = sample.sample_status || sample.status
      const matchesSearch =
        !keyword ||
        sample.china_code?.toLowerCase().includes(keyword) ||
        sample.korea_code?.toLowerCase().includes(keyword) ||
        sample.color_name?.toLowerCase().includes(keyword) ||
        sample.color_code?.toLowerCase().includes(keyword)

      const matchesStatus =
        statusFilter === 'all' || sampleStatus === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [samples, searchTerm, statusFilter])

  const groupedByDate = useMemo(() => {
    const map = new Map<string, SampleEntry[]>()

    filteredSamples.forEach((sample) => {
      const key = getDateKey(sample)
      const current = map.get(key) || []
      current.push(sample)
      map.set(key, current)
    })

    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredSamples])

  const handleFormSuccess = async () => {
    window.location.reload()
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">샘플관리</h1>
            <p className="mt-1 text-sm text-gray-500">
              샘플을 날짜별 썸네일 리스트로 확인하고 진행 상태를 관리합니다.
            </p>
          </div>

          <Button
            onClick={() => {
              setEditingSample(null)
              setIsFormOpen(true)
            }}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            샘플 등록
          </Button>
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

              {STATUS_OPTIONS.map((status) => (
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

        <section className="space-y-5">
          {groupedByDate.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <p className="font-medium text-gray-900">샘플이 없습니다.</p>
              <p className="mt-1 text-sm text-gray-500">
                검색 조건을 변경하거나 새 샘플을 등록해 주세요.
              </p>
            </div>
          ) : (
            groupedByDate.map(([date, items]) => (
              <div key={date} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">{date}</h2>
                  <Badge variant="secondary">{items.length}개</Badge>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2">
                  {items.map((sample) => {
                    const status = sample.sample_status || sample.status || '샘플입고'

                    return (
                      <button
                        key={sample.id}
                        onClick={() => {
                          setEditingSample(sample)
                          setIsFormOpen(true)
                        }}
                        className="min-w-[150px] max-w-[150px] rounded-2xl border bg-white p-2 text-left transition hover:shadow-md"
                      >
                        <div className="relative h-32 w-full overflow-hidden rounded-xl bg-gray-100">
                          {sample.image_url ? (
                            <Image
                              src={sample.image_url}
                              alt={sample.china_code}
                              fill
                              className="object-cover"
                              sizes="150px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-gray-400">
                              이미지 없음
                            </div>
                          )}
                        </div>

                        <div className="mt-2 space-y-1">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {sample.china_code}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {sample.color_name || '-'} {sample.color_code ? `(${sample.color_code})` : ''}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {status}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {sample.quantity || sample.qty || 0}개
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open)
          if (!open) setEditingSample(null)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSample ? '샘플 수정' : '새 샘플 등록'}
            </DialogTitle>
          </DialogHeader>

          <SampleForm
            sample={editingSample}
            colorCodes={colorCodes}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setIsFormOpen(false)
              setEditingSample(null)
            }}
          />
        </DialogContent>
      </Dialog>
    </main>
  )
}