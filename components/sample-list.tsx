'use client'
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SampleEntry, ColorCode, SampleGroup } from '@/lib/types'
import { groupSamplesByChinaCode } from '@/lib/order-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Plus,
  Package,
  Filter,
  ChevronDown,
  ChevronUp,
  FileText,
  Home,
} from 'lucide-react'
import { SampleCard } from '@/components/sample-card'
import { SampleForm } from '@/components/sample-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SampleListProps {
  initialSamples: SampleEntry[]
  colorCodes: ColorCode[]
}

const STATUS_OPTIONS = ['샘플입고', '미진행', '진행', '보류', '등록대기'] as const

export function SampleList({ initialSamples, colorCodes }: SampleListProps) {
  const router = useRouter()

  const [samples, setSamples] = useState<SampleEntry[]>(initialSamples)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [colorFilter, setColorFilter] = useState<string>('all')
  const [dateFilterType, setDateFilterType] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSample, setEditingSample] = useState<SampleEntry | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refreshSamples = useCallback(async () => {
    setIsLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('sample_entries')
      .select('*')
      .order('checked_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error && data) {
      setSamples(data)
    }

    setIsLoading(false)
  }, [])

  const filteredSamples = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return samples.filter((sample) => {
      const matchesSearch =
        !keyword ||
        sample.china_code?.toLowerCase().includes(keyword) ||
        sample.korea_code?.toLowerCase().includes(keyword)

      const sampleStatus = sample.sample_status || sample.status

const matchesStatus =
  statusFilter === 'all' || sampleStatus === statusFilter

      const matchesColor =
        colorFilter === 'all' || sample.color_code === colorFilter

      let matchesDate = true

      if (dateFilterType !== 'all' && (dateFrom || dateTo)) {
        const rawDate =
          dateFilterType === 'checked_at'
            ? sample.checked_at
            : dateFilterType === 'confirmed_at'
            ? sample.confirmed_at
            : dateFilterType === 'updated_at'
            ? sample.updated_at
            : dateFilterType === 'ordered_at'
            ? sample.ordered_at
            : null

        if (rawDate) {
          const itemDate = new Date(rawDate)
          const fromDate = dateFrom ? new Date(dateFrom) : null
          const toDate = dateTo ? new Date(dateTo) : null

          if (fromDate) {
            fromDate.setHours(0, 0, 0, 0)
            if (itemDate < fromDate) matchesDate = false
          }

          if (toDate) {
            toDate.setHours(23, 59, 59, 999)
            if (itemDate > toDate) matchesDate = false
          }
        } else {
          matchesDate = false
        }
      }

      return matchesSearch && matchesStatus && matchesColor && matchesDate
    })
  }, [samples, searchTerm, statusFilter, colorFilter, dateFilterType, dateFrom, dateTo])

  const groupedSamples = useMemo<SampleGroup[]>(() => {
    return groupSamplesByChinaCode(filteredSamples)
  }, [filteredSamples])

  const statusCounts = useMemo(() => {
  const getSampleStatus = (sample: SampleEntry) =>
    sample.sample_status || sample.status

  return {
    all: samples.length,
    샘플입고: samples.filter((s) => getSampleStatus(s) === '샘플입고').length,
    미진행: samples.filter((s) => getSampleStatus(s) === '미진행').length,
    진행: samples.filter((s) => getSampleStatus(s) === '진행').length,
    보류: samples.filter((s) => getSampleStatus(s) === '보류').length,
    등록대기: samples.filter((s) => getSampleStatus(s) === '등록대기').length,
  }
}, [samples])

  const hasActiveDetailFilters =
    colorFilter !== 'all' ||
    dateFilterType !== 'all' ||
    !!dateFrom ||
    !!dateTo

  const hasAnyFilter =
    !!searchTerm ||
    statusFilter !== 'all' ||
    hasActiveDetailFilters

  const handleEdit = (sample: SampleEntry) => {
    setEditingSample(sample)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingSample(null)
  }

  const handleFormSuccess = async () => {
    await refreshSamples()
    handleFormClose()
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('이 샘플을 삭제하시겠습니까?')
    if (!confirmed) return

    const supabase = createClient()
    const { error } = await supabase
      .from('sample_entries')
      .delete()
      .eq('id', id)

    if (!error) {
      setSamples((prev) => prev.filter((s) => s.id !== id))
    }
  }

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setColorFilter('all')
    setDateFilterType('all')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex min-w-0 items-center gap-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
      <Package className="h-5 w-5 text-primary-foreground" />
    </div>

    <div className="min-w-0">
      <h1 className="text-2xl font-semibold leading-tight sm:text-xl">
        샘플 입고 관리
      </h1>
      <p className="text-sm text-muted-foreground">
        총 {samples.length}개 / 그룹 {groupedSamples.length}개
      </p>
    </div>
  </div>

  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
    
    <Button
      onClick={() => router.push('/')}
      variant="outline"
      size="sm"
      className="w-full sm:w-auto"
    >
      <Home className="mr-2 h-4 w-4" />
      메뉴
    </Button>
        
    <Button
      onClick={() => {
        setEditingSample(null)
        setIsFormOpen(true)
      }}
      size="sm"
      className="w-full sm:w-auto"
    >
      <Plus className="mr-2 h-4 w-4" />
      샘플 등록
    </Button>

        <Button
      type="button"
      variant="outline"
      onClick={() => router.push('/orders')}
      size="sm"
      className="w-full sm:w-auto"
    >
      <FileText className="mr-2 h-4 w-4" />
      발주서 생성
    </Button>
  </div>
</div>
        </div>
      </header>

      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="중국품번 또는 한국품번으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>필터</span>
              {hasActiveDetailFilters && (
                <Badge variant="secondary" className="ml-1">
                  적용됨
                </Badge>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((prev) => !prev)}
            >
              {showFilters ? (
                <>
                  <ChevronUp className="mr-1 h-4 w-4" />
                  상세 필터 닫기
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-4 w-4" />
                  상세 필터 열기
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setStatusFilter('all')}
            >
              전체 {statusCounts.all}
            </Badge>

            {STATUS_OPTIONS.map((status) => (
              <Badge
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setStatusFilter(status)}
              >
                {status} {statusCounts[status]}
              </Badge>
            ))}
          </div>

          {showFilters && (
            <div className="mt-4 space-y-3 rounded-lg border bg-background p-3">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Select value={colorFilter} onValueChange={setColorFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="컬러 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 컬러</SelectItem>
                    {colorCodes.map((color) => (
                      <SelectItem key={color.id} value={color.color_code}>
                        {color.color_name} ({color.color_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={dateFilterType} onValueChange={setDateFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="날짜 기준" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">날짜 기준 없음</SelectItem>
                    <SelectItem value="checked_at">검수일</SelectItem>
                    <SelectItem value="confirmed_at">확인일</SelectItem>
                    <SelectItem value="updated_at">수정일</SelectItem>
                    <SelectItem value="ordered_at">발주일자</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />

                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>

              {hasAnyFilter && (
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                    필터 초기화
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-32 rounded-lg bg-muted" />
                  <div className="mt-4 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-4 w-1/2 rounded bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : groupedSamples.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">샘플이 없습니다</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasAnyFilter
                  ? '검색 조건에 맞는 샘플이 없습니다.'
                  : '새 샘플을 등록해 주세요.'}
              </p>

              {!hasAnyFilter && (
                <Button
                  className="mt-4"
                  onClick={() => {
                    setEditingSample(null)
                    setIsFormOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  첫 샘플 등록하기
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupedSamples.map((group) => (
              <SampleCard
                key={group.china_code}
                group={group}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open)
          if (!open) {
            setEditingSample(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSample ? '샘플 수정' : '새 샘플 등록'}
            </DialogTitle>
          </DialogHeader>

          <SampleForm
            sample={editingSample}
            colorCodes={colorCodes}
            onSuccess={handleFormSuccess}
            onCancel={handleFormClose}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}