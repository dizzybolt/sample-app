'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Images, Pencil, Trash2 } from 'lucide-react'
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="break-words text-base font-bold text-gray-900">
        {value}
      </p>
    </div>
  )
}

export function SampleCard({ group, onEdit, onDelete }: SampleCardProps) {
  if (!group || !group.representative) return null

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
      <Card className="border-0 shadow-none">
        <button
          type="button"
          onClick={() => {
            setSelectedItemId(representative.id)
            setIsDetailOpen(true)
          }}
          className="block w-full text-left"
        >

          <div className="relative aspect-[5/3] w-full bg-gray-50 sm:aspect-[4/3]">
            {representative.image_url ? (
              <Image
                src={representative.image_url}
                alt={representative.china_code}
                fill
                className="object-contain p-3"
                sizes="(max-width: 640px) 100vw, 360px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                이미지 없음
              </div>
            )}
          </div>
          

          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Info label="중국품번" value={group.china_code || '-'} />
              <Info label="한국품번" value={representative.korea_code || '-'} />

              <Info
                label="대표컬러"
                value={getRepresentativeColor(representative)}
              />
              <Info label="컬러수" value={`${uniqueColorCount}개`} />

              <Info label="상품명" value={representative.product_name || '-'} />
              <Info
                label="판매가"
                value={formatPrice(representative.sale_price)}
              />

              <Info
                label="TAG가"
                value={formatPrice(representative.tag_price)}
              />
              <Info label="원가" value={formatPrice(representative.cost_price)} />

              <Info
                label="샘플입고일"
                value={formatDate(representative.checked_at)}
              />
              <Info
                label="작업완료일"
                value={formatDate(representative.work_completed_at)}
              />
            </div>
          </CardContent>
        </button>

        <div className="border-t p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Images className="h-4 w-4" />
            이미지 모아보기
          </div>

          <div className="flex w-full gap-2 overflow-x-auto pb-1">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedItemId(item.id)
                  setIsDetailOpen(true)
                }}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded border bg-gray-50 ${
                  selectedItemId === item.id ? 'ring-2 ring-gray-900' : ''
                }`}
              >
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.china_code}
                    fill
                    className="object-contain p-1"
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
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] !max-w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto p-4 sm:w-[92vw] sm:!max-w-[900px] sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {group.china_code}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <Badge variant="outline">
                {selectedItem.item_card_status ||
                  selectedItem.sample_status ||
                  '-'}
              </Badge>
            </div>

            <div className="mx-auto w-full max-w-3xl min-w-0">
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gray-50">
                {selectedItem.image_url ? (
                  <Image
                    src={selectedItem.image_url}
                    alt={selectedItem.china_code}
                    fill
                    className="object-contain p-3"
                    sizes="(max-width: 640px) 92vw, 720px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    이미지 없음
                  </div>
                )}
              </div>
            </div>

            <div className="mx-auto w-full max-w-3xl min-w-0">
              <div className="flex w-full max-w-full gap-2 overflow-x-auto overflow-y-hidden pb-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-gray-50 sm:h-20 sm:w-20 ${
                      selectedItem.id === item.id
                        ? 'ring-2 ring-gray-900'
                        : 'ring-1 ring-gray-200'
                    }`}
                  >
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.china_code}
                        fill
                        className="object-contain p-1"
                        sizes="80px"
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

            <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-x-6 gap-y-4">
              <Info label="중국품번" value={selectedItem.china_code || '-'} />
              <Info label="한국품번" value={selectedItem.korea_code || '-'} />

              <Info label="상품명" value={selectedItem.product_name || '-'} />
              <Info
                label="컬러"
                value={getRepresentativeColor(selectedItem)}
              />

              <Info label="컬러수" value={`${uniqueColorCount}개`} />
              <Info
                label="판매가"
                value={formatPrice(selectedItem.sale_price)}
              />

              <Info
                label="TAG가"
                value={formatPrice(selectedItem.tag_price)}
              />
              <Info label="원가" value={formatPrice(selectedItem.cost_price)} />

              <Info
                label="샘플입고일"
                value={formatDate(selectedItem.checked_at)}
              />
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

            <div className="mx-auto w-full max-w-3xl">
              <p className="mb-1 text-xs font-medium text-gray-500">비고</p>
              <p className="rounded-xl bg-gray-50 p-3 text-sm">
                {selectedItem.note || selectedItem.memo || '-'}
              </p>
            </div>

            <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-2 pt-2">
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
        </DialogContent>
      </Dialog>
    </>
  )
}