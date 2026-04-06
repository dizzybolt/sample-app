'use client'

import Image from 'next/image'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Pencil, Trash2 } from 'lucide-react'
import type { SampleEntry } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface SampleCardProps {
  sample: SampleEntry
  onEdit: (sample: SampleEntry) => void
  onDelete: (id: string) => void
}

function formatDate(dateString?: string | null) {
  if (!dateString) return '-'
  try {
    return format(new Date(dateString), 'yyyy년 M월 d일', { locale: ko })
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
  sample,
  onEdit,
  onDelete,
}: SampleCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3] w-full bg-muted">
        {sample.image_url ? (
          <Image
            src={sample.image_url}
            alt={sample.china_code}
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
            <div className="text-sm text-muted-foreground">중국코드</div>
            <div className="truncate text-lg font-semibold">
              {sample.china_code || '-'}
            </div>
          </div>

          <Badge variant={getStatusVariant(sample.status) as any}>
            {sample.status || '-'}
          </Badge>
        </div>

        <div className="grid grid-cols-[88px_1fr] gap-y-2 text-sm">
          <div className="text-muted-foreground">한국코드</div>
          <div className="font-medium">{sample.korea_code || '-'}</div>

          <div className="text-muted-foreground">컬러</div>
          <div className="font-medium">
            {sample.color_code && sample.color_name
              ? `${sample.color_code} ${sample.color_name}`
              : sample.color_name || sample.color_code || '-'}
          </div>

          {!!sample.order_qty && (
            <>
              <div className="text-muted-foreground">발주수량</div>
              <div className="font-medium">{sample.order_qty}개</div>
            </>
          )}
        </div>

        <div className="space-y-1 border-t pt-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>검수일: {formatDate(sample.checked_at)}</span>
          </div>

          {sample.ordered_at && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>발주일: {formatDate(sample.ordered_at)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(sample)}
          >
            <Pencil className="mr-1 h-4 w-4" />
            수정
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="flex-1"
            onClick={() => onDelete(sample.id)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            삭제
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}