'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImagePreviewDialog } from '@/components/image-preview-dialog'

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
  return (
    sample.checked_at?.slice(0, 10) ||
    sample.created_at?.slice(0, 10) ||
    '날짜없음'
  )
}

function getSampleStatus(sample: SampleEntry): SampleStatus {
  return (sample.sample_status || sample.status || '샘플입고') as SampleStatus
}

function getColorCount(items: SampleEntry[]) {
  return new Set(
    items.map((item) => `${item.color_code || ''}-${item.color_name || ''}`)
  ).size
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
  const [savingId, setSavingId] = useState<string | null>(null)

  const filteredSamples = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return samples.filter((sample) => {
      const sampleStatus = getSampleStatus(sample)

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
    const dateMap = new Map<string, Map<string, SampleEntry[]>>()

    filteredSamples.forEach((sample) => {
      const dateKey = getDateKey(sample)
      const chinaCode = sample.china_code || '품번없음'

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, new Map())
      }

      const chinaMap = dateMap.get(dateKey)!
      const current = chinaMap.get(chinaCode) || []
      current.push(sample)
      chinaMap.set(chinaCode, current)
    })

    return Array.from(dateMap.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredSamples])

  const handleStatusChange = async (
    sample: SampleEntry,
    nextStatus: SampleStatus
  ) => {
    setSavingId(sample.id)

    const supabase = createClient()

    const payload = {
      status: nextStatus,
      sample_status: nextStatus,
      order_status: nextStatus === '진행' ? sample.order_status || '발주대기' : null,
      item_card_status:
        nextStatus === '진행' ? sample.item_card_status || '촬영대기' : null,
    }

    const { error } = await supabase
      .from('sample_entries')
      .update(payload)
      .eq('id', sample.id)

    if (error) {
      setSavingId(null)
      alert('상태 변경에 실패했습니다.')
      return
    }

    setSamples((prev) =>
      prev.map((item) =>
        item.id === sample.id
          ? {
              ...item,
              ...payload,
            }
          : item
      )
    )

    setSavingId(null)
  }

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
              샘플 등록과 진행 여부를 날짜별로 관리합니다.
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

        {groupedByDate.length === 0 ? (
          <section className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-medium text-gray-900">샘플이 없습니다.</p>
            <p className="mt-1 text-sm text-gray-500">
              검색 조건을 변경하거나 새 샘플을 등록해 주세요.
            </p>
          </section>
        ) : (
          <section className="space-y-5">
            {groupedByDate.map(([date, chinaMap]) => (
              <div key={date} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">{date}</h2>
                  <Badge variant="secondary">{chinaMap.size}개 품번</Badge>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2">
                  {Array.from(chinaMap.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([chinaCode, items]) => {
                    const representative = items[0]
                    const status = getSampleStatus(representative)
                    const colorCount = getColorCount(items)
                    const isSaving = savingId === representative.id

                    return (
                      <div
                        key={`${date}-${chinaCode}`}
                        className="min-w-[210px] max-w-[210px] overflow-hidden rounded-2xl border bg-white"
                      >
                        <div className="block w-full text-left">
                            <div className="relative">
                              <ImagePreviewDialog
                                  src={representative.image_url}
                                  alt={`${chinaCode} ${representative.color_name || ''}`}
                                >
                                  <div className="relative aspect-[4/3] bg-gray-50">
                                    {representative.image_url ? (
                                      <Image
                                        src={representative.image_url}
                                        alt={chinaCode}
                                        fill
                                        className="object-contain p-2"
                                        sizes="220px"
                                        quality={55}
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="flex h-full items-center justify-center text-xs text-gray-400">
                                        이미지 없음
                                      </div>
                                    )}
                                  </div>
                                </ImagePreviewDialog>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSample(representative)
                                    setIsFormOpen(true)
                                  }}
                                  className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-gray-200 hover:bg-gray-50"
                                  aria-label="샘플 수정"
                                >
                                  <Pencil className="h-4 w-4 text-gray-700" />
                                </button>
                            </div>

                          <div className="space-y-2 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs text-gray-500">중국품번</p>
                                <p className="truncate font-bold text-gray-900">
                                  {chinaCode}
                                </p>
                              </div>
                              <Badge variant="outline">{status}</Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-xs text-gray-500">한국품번</p>
                                <p className="truncate font-medium">
                                  {representative.korea_code || '-'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-500">컬러수</p>
                                <p className="font-medium">{colorCount}개</p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-500">
                                  샘플입고일
                                </p>
                                <p className="font-medium">
                                  {representative.checked_at?.slice(0, 10) || '-'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-500">수량</p>
                                <p className="font-medium">
                                  {items.reduce(
                                    (sum, item) =>
                                      sum +
                                      Number(item.quantity || item.qty || 0),
                                    0
                                  )}
                                  개
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 pt-2">
                          <div className="px-3 pt-1">
                            <p className="mb-2 text-xs font-medium text-gray-600">
                              이미지 모아보기
                            </p>

                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {items.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setEditingSample(item)
                                    setIsFormOpen(true)
                                  }}
                                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border bg-gray-50"
                                >
                                  {item.image_url ? (
                                    <Image
                                      src={item.image_url}
                                      alt={item.china_code || ''}
                                      fill
                                      className="object-contain p-1"
                                      sizes="44px"
                                      quality={45}
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-[10px] text-gray-400">
                                      없음
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-center p-3 pt-2">
                          <Select
                            value={status}
                            disabled={isSaving}
                            onValueChange={(value) =>
                              handleStatusChange(
                                representative,
                                value as SampleStatus
                              )
                            }
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue placeholder="상태 변경" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
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