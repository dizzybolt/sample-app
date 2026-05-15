'use client'

import { useMemo, useState } from 'react'
import { Search, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ColorCode, ItemCardStatus, SampleEntry } from '@/lib/types'
import { groupSamplesByChinaCode } from '@/lib/order-utils'
import { SampleCard } from '@/components/sample-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface ItemCardListProps {
  initialSamples: SampleEntry[]
  colorCodes: ColorCode[]
}

const ITEM_CARD_STATUS_OPTIONS: ItemCardStatus[] = [
  '촬영대기',
  '촬영중',
  '작업중',
  '작업완료',
]

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function getGroupStatus(items: SampleEntry[]) {
  const statuses = items
    .map((item) => item.item_card_status)
    .filter(Boolean) as ItemCardStatus[]

  if (statuses.length === 0) return '촬영대기'
  if (statuses.every((status) => status === statuses[0])) return statuses[0]

  return '혼합'
}

export function ItemCardList({ initialSamples }: ItemCardListProps) {
  const [samples, setSamples] = useState(initialSamples)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [savingChinaCode, setSavingChinaCode] = useState<string | null>(null)
  const [editingSample, setEditingSample] = useState<SampleEntry | null>(null)
  const [koreaCode, setKoreaCode] = useState('')
  const [productName, setProductName] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [tagPrice, setTagPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')

  const filteredSamples = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return samples.filter((sample) => {
      const itemStatus = sample.item_card_status

      const matchesSearch =
        !keyword ||
        sample.china_code?.toLowerCase().includes(keyword) ||
        sample.korea_code?.toLowerCase().includes(keyword) ||
        sample.color_name?.toLowerCase().includes(keyword) ||
        sample.color_code?.toLowerCase().includes(keyword)

      const matchesStatus =
        statusFilter === 'all' || itemStatus === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [samples, searchTerm, statusFilter])

  const groupedSamples = useMemo(() => {
    return groupSamplesByChinaCode(filteredSamples)
  }, [filteredSamples])

  const handleChangeGroupStatus = async (
    chinaCode: string,
    items: SampleEntry[],
    nextStatus: ItemCardStatus
  ) => {
    setSavingChinaCode(chinaCode)

    const supabase = createClient()
    const today = getToday()

    const updatePayload: Partial<SampleEntry> = {
      item_card_status: nextStatus,
    }

    if (nextStatus === '촬영중') {
      updatePayload.shoot_requested_at = today
    }

    if (nextStatus === '작업중') {
      updatePayload.work_started_at = today
    }

    if (nextStatus === '작업완료') {
      updatePayload.work_completed_at = today
      updatePayload.sample_status = '등록대기'
      updatePayload.status = '등록대기'
    }

    const ids = items.map((item) => item.id)

    const { error } = await supabase
      .from('sample_entries')
      .update(updatePayload)
      .in('id', ids)

    if (error) {
      setSavingChinaCode(null)
      alert('아이템카드 상태 변경에 실패했습니다.')
      return
    }

    setSamples((prev) =>
      prev.map((sample) => {
        if (!ids.includes(sample.id)) return sample

        return {
          ...sample,
          ...updatePayload,
        }
      })
    )

    setSavingChinaCode(null)
  }

  const handleEdit = (sample: SampleEntry) => {
    setEditingSample(sample)
    setKoreaCode(sample.korea_code || '')
    setProductName(sample.product_name || '')
    setSalePrice(sample.sale_price ? String(sample.sale_price) : '')
    setTagPrice(sample.tag_price ? String(sample.tag_price) : '')
    setCostPrice(sample.cost_price ? String(sample.cost_price) : '')
  }

  const handleSaveProductInfo = async () => {
  if (!editingSample) return

  const supabase = createClient()

  const payload = {
    korea_code: koreaCode.trim() || null,
    product_name: productName.trim() || null,
    sale_price: salePrice === '' ? null : Number(salePrice),
    tag_price: tagPrice === '' ? null : Number(tagPrice),
    cost_price: costPrice === '' ? null : Number(costPrice),
  }

  const { error } = await supabase
    .from('sample_entries')
    .update(payload)
    .eq('china_code', editingSample.china_code)

  if (error) {
    alert('상품정보 저장에 실패했습니다.')
    return
  }

  setSamples((prev) =>
    prev.map((sample) =>
      sample.china_code === editingSample.china_code
        ? {
            ...sample,
            ...payload,
          }
        : sample
    )
  )

  setEditingSample(null)
  alert('상품정보가 저장되었습니다.')
}

  const handleDelete = async (id: string) => {
    const ok = window.confirm('이 항목을 삭제하시겠습니까?')
    if (!ok) return

    const supabase = createClient()
    const { error } = await supabase.from('sample_entries').delete().eq('id', id)

    if (!error) {
      setSamples((prev) => prev.filter((sample) => sample.id !== id))
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">아이템카드</h1>
          <p className="mt-1 text-sm text-gray-500">
            진행 상태 샘플의 촬영/작업 상태를 중국품번 기준 카드로 관리합니다.
          </p>
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

              {ITEM_CARD_STATUS_OPTIONS.map((status) => (
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
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groupedSamples.map((group) => {
              const groupStatus = getGroupStatus(group.items)
              const isSaving = savingChinaCode === group.china_code

              return (
                <div key={group.china_code} className="space-y-2">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-gray-500">작업상태</p>
                        <Badge variant="outline">{groupStatus}</Badge>
                      </div>

                      {groupStatus === '작업완료' && (
                        <Badge className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          등록대기
                        </Badge>
                      )}
                    </div>

                    <Select
                      disabled={isSaving}
                      value={
                        groupStatus === '혼합' ? undefined : groupStatus
                      }
                      onValueChange={(value) =>
                        handleChangeGroupStatus(
                          group.china_code,
                          group.items,
                          value as ItemCardStatus
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="상태 변경" />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_CARD_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <SampleCard
                    group={group}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </div>
              )
            })}
          </section>
        )}
        <Dialog
  open={!!editingSample}
  onOpenChange={(open) => {
    if (!open) setEditingSample(null)
  }}
>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>아이템카드 상품정보 수정</DialogTitle>
    </DialogHeader>

    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500">중국품번</p>
        <p className="font-semibold">{editingSample?.china_code}</p>
      </div>

    <div className="space-y-2">
      <Label>한국품번</Label>
      <Input
        value={koreaCode}
        onChange={(e) => setKoreaCode(e.target.value)}
        placeholder="한국품번 입력"
      />
    </div>

      <div className="space-y-2">
        <Label>상품명</Label>
        <Input
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="상품명 입력"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>판매가</Label>
          <Input
            type="number"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            placeholder="판매가"
          />
        </div>

        <div className="space-y-2">
          <Label>TAG가</Label>
          <Input
            type="number"
            value={tagPrice}
            onChange={(e) => setTagPrice(e.target.value)}
            placeholder="TAG가"
          />
        </div>

        <div className="space-y-2">
          <Label>원가</Label>
          <Input
            type="number"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            placeholder="원가"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={() => setEditingSample(null)}
        >
          취소
        </Button>

        <Button onClick={handleSaveProductInfo}>
          저장
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
      </div>
    </main>
  )
}