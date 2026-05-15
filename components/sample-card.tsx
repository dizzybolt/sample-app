'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Images, Pencil, Trash2 } from 'lucide-react'
import type { SampleEntry, SampleGroup } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SampleCardProps {
  group: SampleGroup
  onEdit: (sample: SampleEntry) => void
  onDelete: (id: string) => void
}

function formatDate(dateString?: string | null) {
  if (!dateString) return '-'

  try {
    return format(new Date(dateString), 'yyyy.MM.dd', { locale: ko })
  } catch {
    return '-'
  }
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return '-'
  return `${Number(value).toLocaleString()}원`
}

function getRepresentativeColor(sample: SampleEntry) {
  if (sample.color_name && sample.color_code) {
    return `${sample.color_name} (${sample.color_code})`
  }

  return sample.color_name || sample.color_code || '-'
}

export function SampleCard({ group, onEdit, onDelete }: SampleCardProps) {
  if (!group || !group.representative) {
    return null
  }

  const representative = group.representative
  const items = group.items || []

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState(representative.id)

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedItemId) || representative
  }, [items, representative, selectedItemId])

  const uniqueColorCount = useMemo(() => {
    const colorKeys = new Set(
      items.map((item) => `${item.color_code || ''}-${item.color_name || ''}`)
    )

    return colorKeys.size || items.length
  }, [items])

  return (
    <>
      <Card className="overflow-hidden transition hover:-translate-y-1 hover:shadow-md">
        <button
          type="button"
          onClick={() => {
            setSelectedItemId(representative.id)
            setIsDetailOpen(true)
          }}
          className="block w-full text-left"
        >
          <div className="relative aspect-[4/3] w-full bg-gray-100">
            {representative.image_url ? (
              <Image
                src={representative.image_url}
                alt={representative.china_code}
                fill
                className="object-cover"
                sizes="360px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                이미지 없음
              </div>
            )}
          </div>

          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">중국품번</p>
                <h3 className="truncate text-lg font-bold text-gray-900">
                  {group.china_code || '-'}
                </h3>
              </div>

              <Badge variant="outline">
                {representative.item_card_status || representative.sample_status || '-'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">한국품번</p>
                <p className="truncate font-medium">
                  {representative.korea_code || '-'}
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
                <p className="text-xs text-gray-500">상품명</p>
                <p className="truncate font-medium">
                  {representative.product_name || '-'}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">판매가</p>
                <p className="font-medium">{formatPrice(representative.sale_price)}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">TAG가</p>
                <p className="font-medium">{formatPrice(representative.tag_price)}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">원가</p>
                <p className="font-medium">{formatPrice(representative.cost_price)}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">샘플입고일</p>
                <p className="font-medium">{formatDate(representative.checked_at)}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">작업완료일</p>
                <p className="font-medium">
                  {formatDate(representative.work_completed_at)}
                </p>
              </div>
            </div>
          </CardContent>
        </button>

        <div className="border-t p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Images className="h-4 w-4" />
            이미지 모아보기
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedItemId(item.id)
                  setIsDetailOpen(true)
                }}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded border ${
                  selectedItemId === item.id ? 'ring-2 ring-primary' : ''
                }`}
              >
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.china_code}
                    fill
                    className="object-cover"
                    sizes="56px"
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
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{group.china_code}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100">
                {selectedItem.image_url ? (
                  <Image
                    src={selectedItem.image_url}
                    alt={selectedItem.china_code}
                    fill
                    className="object-cover"
                    sizes="520px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    이미지 없음
                  </div>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded border ${
                      selectedItem.id === item.id ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.china_code}
                        fill
                        className="object-cover"
                        sizes="64px"
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

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500">중국품번</p>
                <p className="text-xl font-bold">{selectedItem.china_code || '-'}</p>
              </div>

              <Badge variant="outline">
                {selectedItem.item_card_status || selectedItem.sample_status || '-'}
              </Badge>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="한국품번" value={selectedItem.korea_code || '-'} />
                <Info label="상품명" value={selectedItem.product_name || '-'} />
                <Info label="컬러" value={getRepresentativeColor(selectedItem)} />
                <Info label="컬러수" value={`${uniqueColorCount}개`} />
                <Info label="판매가" value={formatPrice(selectedItem.sale_price)} />
                <Info label="TAG가" value={formatPrice(selectedItem.tag_price)} />
                <Info label="원가" value={formatPrice(selectedItem.cost_price)} />
                <Info label="샘플입고일" value={formatDate(selectedItem.checked_at)} />
                <Info
                  label="촬영요청일"
                  value={formatDate(selectedItem.shoot_requested_at)}
                />
                <Info
                  label="촬영완료일"
                  value={formatDate(selectedItem.shoot_completed_at)}
                />
                <Info
                  label="작업시작일"
                  value={formatDate(selectedItem.work_started_at)}
                />
                <Info
                  label="작업완료일"
                  value={formatDate(selectedItem.work_completed_at)}
                />
              </div>

              <div>
                <p className="mb-1 text-xs text-gray-500">비고</p>
                <p className="rounded-xl bg-gray-50 p-3 text-sm">
                  {selectedItem.note || selectedItem.memo || '-'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailOpen(false)
                    onEdit(selectedItem)
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  수정
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => {
                    const ok = window.confirm('이 항목을 삭제하시겠습니까?')
                    if (!ok) return

                    setIsDetailOpen(false)
                    onDelete(selectedItem.id)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  삭제
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}