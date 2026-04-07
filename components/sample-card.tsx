'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Pencil, Trash2, Images } from 'lucide-react'
import type { SampleEntry } from '@/lib/types'
import type { SampleGroup } from '@/components/sample-list'
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

function getStatusVariant(status?: string | null) {
  switch (status) {
    case '확인':
      return 'default'
    case '진행':
      return 'secondary'
    case '미진행':
      return 'outline'
    case '발주':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function SampleCard({
  group,
  onEdit,
  onDelete,
}: SampleCardProps) {
  const representative = group.representative
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string>(representative.id)

  const selectedItem = useMemo(() => {
    return group.items.find((item) => item.id === selectedItemId) || representative
  }, [group.items, representative, selectedItemId])

  return (
    <>
      <Card className="overflow-hidden">
        <div
          className="relative aspect-[4/3] w-full cursor-pointer bg-muted"
          onClick={() => {
            setSelectedItemId(representative.id)
            setIsDetailOpen(true)
          }}
        >
          {representative.image_url ? (
            <Image
              src={representative.image_url}
              alt={representative.china_code}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              이미지 없음
            </div>
          )}
        </div>

        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-muted-foreground">중국품번</div>
              <div className="truncate text-lg font-semibold">
                {group.china_code || '-'}
              </div>
            </div>

            <Badge variant={getStatusVariant(representative.status) as any}>
              {representative.status || '-'}
            </Badge>
          </div>

          <div className="grid grid-cols-[88px_1fr] gap-y-2 text-sm">
            <div className="text-muted-foreground">대표 컬러</div>
            <div className="font-medium">
              {representative.color_name && representative.color_code
                ? `${representative.color_name} (${representative.color_code})`
                : representative.color_name || representative.color_code || '-'}
            </div>

            <div className="text-muted-foreground">이미지 수</div>
            <div className="flex items-center gap-1 font-medium">
              <Images className="h-4 w-4 text-muted-foreground" />
              {group.items.length}개
            </div>

            {!!representative.order_qty && (
              <>
                <div className="text-muted-foreground">발주수량</div>
                <div className="font-medium">{representative.order_qty}개</div>
              </>
            )}
          </div>

          <div className="space-y-1 border-t pt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>검수일: {formatDate(representative.checked_at)}</span>
            </div>

            {representative.ordered_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>발주일: {formatDate(representative.ordered_at)}</span>
              </div>
            )}
          </div>

          {/* 하단 미니멀 이미지 strip */}
          <div className="border-t pt-3">
            <div className="mb-2 text-xs text-muted-foreground">이미지 모아보기</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {group.items.map((item) => (
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
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                      없음
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 그룹 상세 팝업 */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{group.china_code}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted">
                {selectedItem.image_url ? (
                  <Image
                    src={selectedItem.image_url}
                    alt={selectedItem.china_code}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    이미지 없음
                  </div>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {group.items.map((item) => (
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
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                        없음
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">중국품번</div>
                  <div className="text-lg font-semibold">{selectedItem.china_code || '-'}</div>
                </div>

                <Badge variant={getStatusVariant(selectedItem.status) as any}>
                  {selectedItem.status || '-'}
                </Badge>
              </div>

              <div className="grid grid-cols-[88px_1fr] gap-y-2 text-sm">
                <div className="text-muted-foreground">한국품번</div>
                <div className="font-medium">{selectedItem.korea_code || '-'}</div>

                <div className="text-muted-foreground">컬러</div>
                <div className="font-medium">
                  {selectedItem.color_name && selectedItem.color_code
                    ? `${selectedItem.color_name} (${selectedItem.color_code})`
                    : selectedItem.color_name || selectedItem.color_code || '-'}
                </div>

                <div className="text-muted-foreground">검수일</div>
                <div className="font-medium">{formatDate(selectedItem.checked_at)}</div>

                <div className="text-muted-foreground">확인일</div>
                <div className="font-medium">{formatDate(selectedItem.confirmed_at)}</div>

                <div className="text-muted-foreground">수정일</div>
                <div className="font-medium">{formatDate(selectedItem.updated_at)}</div>

                <div className="text-muted-foreground">발주수량</div>
                <div className="font-medium">
                  {selectedItem.order_qty ? `${selectedItem.order_qty}개` : '-'}
                </div>

                <div className="text-muted-foreground">발주일자</div>
                <div className="font-medium">{formatDate(selectedItem.ordered_at)}</div>

                <div className="text-muted-foreground">비고</div>
                <div className="font-medium whitespace-pre-wrap break-words">
                  {selectedItem.note || selectedItem.memo || '-'}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsDetailOpen(false)
                    onEdit(selectedItem)
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  수정
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
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