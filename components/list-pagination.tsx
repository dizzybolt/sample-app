'use client'

import { Button } from '@/components/ui/button'

type ListPaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

export function ListPagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: ListPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages)

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        이전
      </Button>
      <span className="min-w-20 text-center text-sm text-gray-500">
        {currentPage} / {safeTotalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || currentPage >= safeTotalPages}
        onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
      >
        다음
      </Button>
    </div>
  )
}
