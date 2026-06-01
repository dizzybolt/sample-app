'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Inventory, Warehouse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('ko-KR')
}

export function InventoryManager() {
  const supabase = createClient()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [inventories, setInventories] = useState<Inventory[]>([])

  const [warehouseId, setWarehouseId] = useState('')
  const [sku, setSku] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [warehouseRes, inventoryRes] = await Promise.all([
      supabase
        .from('warehouses')
        .select('*')
        .order('name', { ascending: true }),

      supabase
        .from('inventory')
        .select('*')
        .order('updated_at', { ascending: false }),
    ])

    setWarehouses((warehouseRes.data || []) as Warehouse[])
    setInventories((inventoryRes.data || []) as Inventory[])
  }

  const filteredInventories = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return inventories.filter((item) => {
      const matchesKeyword =
        !keyword || item.sku.toLowerCase().includes(keyword)

      const matchesWarehouse =
        !warehouseId || item.warehouse_id === warehouseId

      return matchesKeyword && matchesWarehouse
    })
  }, [inventories, searchTerm, warehouseId])

  function getWarehouseName(id: string) {
    return warehouses.find((item) => item.id === id)?.name || '-'
  }

  async function handleSaveInventory() {
    if (!warehouseId) {
      alert('창고를 선택해 주세요.')
      return
    }

    if (!sku.trim()) {
      alert('SKU를 입력해 주세요.')
      return
    }

    const nextQty = Number(qty.replaceAll(',', ''))

    if (Number.isNaN(nextQty)) {
      alert('수량을 숫자로 입력해 주세요.')
      return
    }

    setIsSaving(true)

    const normalizedSku = sku.trim()

    const { data: existing } = await supabase
      .from('inventory')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('sku', normalizedSku)
      .maybeSingle()

    const beforeQty = Number(existing?.qty || 0)

    let inventoryId = existing?.id as string | undefined

    if (existing) {
      const { error } = await supabase
        .from('inventory')
        .update({
          qty: nextQty,
          note: reason.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        setIsSaving(false)
        alert(`재고 수정 실패\n\n${error.message}`)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('inventory')
        .insert({
          warehouse_id: warehouseId,
          sku: normalizedSku,
          qty: nextQty,
          note: reason.trim() || null,
        })
        .select('*')
        .single()

      if (error) {
        setIsSaving(false)
        alert(`재고 등록 실패\n\n${error.message}`)
        return
      }

      inventoryId = data.id
    }

    const changeQty = nextQty - beforeQty

    await supabase.from('inventory_logs').insert({
      inventory_id: inventoryId,
      warehouse_id: warehouseId,
      sku: normalizedSku,
      change_type: existing ? '수정' : '신규등록',
      change_qty: changeQty,
      before_qty: beforeQty,
      after_qty: nextQty,
      reason: reason.trim() || null,
      source_type: 'manual',
    })

    setIsSaving(false)

    alert('재고가 저장되었습니다.')

    setSku('')
    setQty('')
    setReason('')

    await fetchData()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">재고 등록/수정</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-[1.5fr_2fr_1fr_2fr_auto]">
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger>
              <SelectValue placeholder="창고 선택" />
            </SelectTrigger>

            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="SKU"
          />

          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="수량"
            inputMode="numeric"
          />

          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="사유 / 비고"
          />

          <Button
            type="button"
            disabled={isSaving}
            onClick={handleSaveInventory}
          >
            저장
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-gray-900">재고 목록</h2>

          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="SKU 검색"
            className="sm:max-w-xs"
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-3">창고</th>
                <th className="p-3">SKU</th>
                <th className="p-3 text-right">현재고</th>
                <th className="p-3">비고</th>
                <th className="p-3">수정일</th>
              </tr>
            </thead>

            <tbody>
              {filteredInventories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    등록된 재고가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredInventories.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3">{getWarehouseName(item.warehouse_id)}</td>
                    <td className="p-3 font-medium">{item.sku}</td>
                    <td className="p-3 text-right font-bold">
                      {formatNumber(item.qty)}개
                    </td>
                    <td className="p-3">{item.note || '-'}</td>
                    <td className="p-3">
                      {item.updated_at?.slice(0, 10) || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}