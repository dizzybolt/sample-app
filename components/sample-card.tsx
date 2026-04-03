'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { SampleEntry } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MoreVertical, Pencil, Trash2, ImageIcon, Calendar } from 'lucide-react'

interface SampleCardProps {
  sample: SampleEntry
  onEdit: (sample: SampleEntry) => void
  onDelete: (id: string) => void
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case '완료':
      return 'default'
    case '진행중':
      return 'secondary'
    default:
      return 'outline'
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function SampleCard({ sample, onEdit, onDelete }: SampleCardProps) {
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)

  return (
    <>
      <Card className="group overflow-hidden transition-shadow hover:shadow-md">
        <CardContent className="p-0">
          {/* Image Section */}
          <div className="relative aspect-[4/3] bg-muted">
            {sample.image_url ? (
              <Image
                src={sample.image_url}
                alt={sample.china_code}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
              </div>
            )}
            
            {/* Status Badge */}
            <Badge 
              variant={getStatusVariant(sample.status)}
              className="absolute left-3 top-3"
            >
              {sample.status}
            </Badge>

            {/* Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-3 top-3 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(sample)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  수정
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteAlert(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Info Section */}
          <div className="p-4">
            {/* Codes */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">중국코드</span>
                <span className="font-mono font-medium">{sample.china_code}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">한국코드</span>
                <span className="font-mono font-medium">{sample.korea_code || '-'}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="my-3 border-t" />

            {/* Details */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">컬러</span>
                <p className="font-medium">
                  {sample.color_code ? `${sample.color_code} ${sample.color_name || ''}` : '-'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">수량</span>
                <p className="font-medium">{sample.quantity}개</p>
              </div>
            </div>

            {/* Checked Date */}
            {sample.checked_at && (
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>검수일: {formatDate(sample.checked_at)}</span>
              </div>
            )}

            {/* Memo */}
            {sample.memo && (
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                {sample.memo}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>샘플을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 샘플 &quot;{sample.china_code}&quot;이(가) 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(sample.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
