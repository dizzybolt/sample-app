'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { Search, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ColorCode, ItemCardStatus, SampleEntry } from '@/lib/types'
import { groupSamplesByChinaCode } from '@/lib/order-utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ItemCardListProps {
  initialSamples: SampleEntry[]
  colorCodes: ColorCode[]
}

type UserActionStatus = '촬영중' | '촬영완료' | '작업중' | '작업완료'

const FILTER_STATUS_OPTIONS: Array<ItemCardStatus | '촬영완료'> = [
  '촬영대기',
  '촬영중',
  '촬영완료',
  '작업대기',
  '작업중',
  '작업완료',
]

const ACTION_STATUS_OPTIONS: UserActionStatus[] = [
  '촬영중',
  '촬영완료',
  '작업중',
  '작업완료',
]

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return value.slice(0, 10)
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function displayPrice(value?: number | null) {
  if (value === null || value === undefined) return '-'
  return `${Number(value).toLocaleString()}원`
}

function getGroupStatus(items: SampleEntry[]) {
  const statuses = items
    .map((item) => item.item_card_status)
    .filter(Boolean) as ItemCardStatus[]

  if (statuses.length === 0) return '촬영대기'
  if (statuses.every((status) => status === statuses[0])) return statuses[0]

  return '혼합'
}

function getRepresentativeColor(sample: SampleEntry) {
  if (sample.color_name && sample.color_code) {
    return `${sample.color_name} (${sample.color_code})`
  }

  return sample.color_name || sample.color_code || '-'
}

export function ItemCardList({ initialSamples }: ItemCardListProps) {
  const [samples, setSamples] = useState(initialSamples)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [savingChinaCode, setSavingChinaCode] = useState<string | null>(null)

  const filteredSamples = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return samples.filter((sample) => {
      const itemStatus = sample.item_card_status || '촬영대기'

      const matchesSearch =
        !keyword ||
        sample.china_code?.toLowerCase().includes(keyword) ||
        sample.korea_code?.toLowerCase().includes(keyword) ||
        sample.product_name?.toLowerCase().includes(keyword) ||
        sample.color_name?.toLowerCase().includes(keyword) ||
        sample.color_code?.toLowerCase().includes(keyword)

      const matchesStatus =
        statusFilter === 'all' ||
        itemStatus === statusFilter ||
        (statusFilter === '촬영완료' && itemStatus === '작업대기')

      return matchesSearch && matchesStatus
    })
  }, [samples, searchTerm, statusFilter])

  const groupedSamples = useMemo(() => {
    return groupSamplesByChinaCode(filteredSamples)
  }, [filteredSamples])

  const handleChangeStatus = async (
    chinaCode: string,
    ids: string[],
    actionStatus: UserActionStatus
  ) => {
    setSavingChinaCode(chinaCode)

    const supabase = createClient()
    const today = getToday()

    const payload: Partial<SampleEntry> = {}

    if (actionStatus === '촬영중') {
      payload.item_card_status = '촬영중'
      payload.shoot_requested_at = today
    }

    if (actionStatus === '촬영완료') {
      payload.item_card_status = '작업대기'
      payload.shoot_completed_at = today
    }

    if (actionStatus === '작업중') {
      payload.item_card_status = '작업중'
      payload.work_started_at = today
    }

    if (actionStatus === '작업완료') {
      payload.item_card_status = '작업완료'
      payload.work_completed_at = today
      payload.sample_status = '등록대기'
      payload.status = '등록대기'
    }

    const { error } = await supabase
      .from('sample_entries')
      .update(payload)
      .in('id', ids)

    if (error) {
      setSavingChinaCode(null)
      alert('상태 변경에 실패했습니다.')
      return
    }

    setSamples((prev) =>
      prev.map((sample) =>
        ids.includes(sample.id)
          ? {
              ...sample,
              ...payload,
            }
          : sample
      )
    )

    setSavingChinaCode(null)
  }

  const handleSaveProductInfo = async (
    chinaCode: string,
    ids: string[],
    formData: FormData
  ) => {
    setSavingChinaCode(chinaCode)

    const supabase = createClient()

    const payload = {
      korea_code: String(formData.get('korea_code') || '').trim() || null,
      product_name: String(formData.get('product_name') || '').trim() || null,
      sale_price:
        String(formData.get('sale_price') || '') === ''
          ? null
          : Number(formData.get('sale_price')),
      tag_price:
        String(formData.get('tag_price') || '') === ''
          ? null
          : Number(formData.get('tag_price')),
      cost_price:
        String(formData.get('cost_price') || '') === ''
          ? null
          : Number(formData.get('cost_price')),
    }

    const { error } = await supabase
      .from('sample_entries')
      .update(payload)
      .in('id', ids)

    if (error) {
      setSavingChinaCode(null)
      alert('상품정보 저장에 실패했습니다.')
      return
    }

    setSamples((prev) =>
      prev.map((sample) =>
        ids.includes(sample.id)
          ? {
              ...sample,
              ...payload,
            }
          : sample
      )
    )

    setSavingChinaCode(null)
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">아이템카드</h1>
          <p className="mt-1 text-sm text-gray-500">
            진행 상태 샘플의 촬영/작업 상태와 상품 정보를 관리합니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="중국품번, 한국품번, 상품명, 색상 검색"
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

              {FILTER_STATUS_OPTIONS.map((status) => (
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
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {groupedSamples.map((group) => {
              const representative = group.representative
              const items = group.items
              const ids = items.map((item) => item.id)
              const groupStatus = getGroupStatus(items)
              const isSaving = savingChinaCode === group.china_code

              const uniqueColorCount = new Set(
                items.map(
                  (item) => `${item.color_code || ''}-${item.color_name || ''}`
                )
              ).size

              return (
                <Card
                  key={group.china_code}
                  className="overflow-hidden rounded-2xl"
                >
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-500">현재상태</p>
                        <Badge variant="outline">{groupStatus}</Badge>
                      </div>

                      <div className="w-36">
                        <Select
                          disabled={isSaving}
                          onValueChange={(value) =>
                            handleChangeStatus(
                              group.china_code,
                              ids,
                              value as UserActionStatus
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="상태 변경" />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTION_STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="relative aspect-[5/3] overflow-hidden rounded-2xl bg-gray-50">
                      {representative.image_url ? (
                        <Image
                          src={representative.image_url}
                          alt={representative.china_code}
                          fill
                          className="object-contain p-3"
                          sizes="420px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-400">
                          이미지 없음
                        </div>
                      )}
                    </div>

                    <form
                      className="space-y-3"
                      action={(formData) =>
                        handleSaveProductInfo(group.china_code, ids, formData)
                      }
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">중국품번</p>
                          <p className="truncate font-bold text-gray-900">
                            {group.china_code || '-'}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">대표컬러</p>
                          <p className="truncate font-medium">
                            {getRepresentativeColor(representative)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">컬러수</p>
                          <p className="font-medium">{uniqueColorCount}개</p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">촬영완료일</p>
                          <p className="font-medium">
                            {formatDate(representative.shoot_completed_at)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">작업완료일</p>
                          <p className="font-medium">
                            {formatDate(representative.work_completed_at)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-gray-500">한국품번</label>
                        <Input
                          name="korea_code"
                          defaultValue={representative.korea_code || ''}
                          placeholder="한국품번"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-gray-500">상품명</label>
                        <Input
                          name="product_name"
                          defaultValue={representative.product_name || ''}
                          placeholder="상품명"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-2">
                          <label className="text-xs text-gray-500">판매가</label>
                          <Input
                            name="sale_price"
                            type="number"
                            defaultValue={formatPrice(representative.sale_price)}
                            placeholder="판매가"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs text-gray-500">TAG가</label>
                          <Input
                            name="tag_price"
                            type="number"
                            defaultValue={formatPrice(representative.tag_price)}
                            placeholder="TAG가"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs text-gray-500">원가</label>
                          <Input
                            name="cost_price"
                            type="number"
                            defaultValue={formatPrice(representative.cost_price)}
                            placeholder="원가"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">판매가</p>
                          <p className="font-medium">
                            {displayPrice(representative.sale_price)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">TAG가</p>
                          <p className="font-medium">
                            {displayPrice(representative.tag_price)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">원가</p>
                          <p className="font-medium">
                            {displayPrice(representative.cost_price)}
                          </p>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={isSaving}
                        className="w-full"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        상품정보 저장
                      </Button>
                    </form>

                    <div className="border-t pt-3">
                      <p className="mb-2 text-sm font-medium text-gray-700">
                        이미지 모아보기
                      </p>

                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-gray-50"
                          >
                            {item.image_url ? (
                              <Image
                                src={item.image_url}
                                alt={item.china_code}
                                fill
                                className="object-contain p-1"
                                sizes="48px"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] text-gray-400">
                                없음
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}