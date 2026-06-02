'use client'

import * as XLSX from 'xlsx'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Inventory, InventoryLog, Warehouse } from '@/lib/types'
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
  const [editingId, setEditingId] = useState<string | null>(null)

  const [bulkUploadMode, setBulkUploadMode] = useState<'replace' | 'adjust'>(
  'replace'
  )

  const [selectedLogSku, setSelectedLogSku] = useState('')
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchInventoryLogs(sku: string) {
    setSelectedLogSku(sku)

    const { data, error } = await supabase
      .from('inventory_logs')
      .select('*')
      .eq('sku', sku)
      .order('created_at', { ascending: false })

    if (error) {
      alert(`로그 조회 실패\n\n${error.message}`)
      return
    }

    setInventoryLogs((data || []) as InventoryLog[])
  }

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

  function handleEditInventory(item: Inventory) {
    setEditingId(item.id)

    setWarehouseId(item.warehouse_id)
    setSku(item.sku)
    setQty(String(item.qty || 0))
    setReason(item.note || '')
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
      change_type: existing ? '재고조정' : '신규등록',
      change_qty: changeQty,
      before_qty: beforeQty,
      after_qty: nextQty,
      reason: reason.trim() || null,
      source_type: 'manual',
    })

    setIsSaving(false)

    alert('재고가 저장되었습니다.')

    setEditingId(null)
    setSku('')
    setQty('')
    setReason('')

    await fetchData()
  }

  async function handleBulkUploadInventory(file: File) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
    })

    if (rows.length === 0) {
      alert('업로드할 재고 데이터가 없습니다.')
      return
    }

    setIsSaving(true)

    let successCount = 0
    let failCount = 0

    for (const row of rows) {
      const warehouseName = String(row.창고명 || row.warehouse_name || '').trim()
      const warehouseCode = String(row.창고코드 || row.warehouse_code || '').trim()
      const uploadSku = String(row.SKU || row.sku || '').trim()
      const uploadQty = Number(String(row.수량 || row.qty || '0').replaceAll(',', ''))
      const uploadNote = String(row.비고 || row.note || '').trim()

      if (!uploadSku || Number.isNaN(uploadQty)) {
        failCount += 1
        continue
      }

      const targetWarehouse = warehouses.find((warehouse) => {
        if (warehouseName && warehouse.name === warehouseName) return true
        if (warehouseCode && warehouse.code === warehouseCode) return true
        return false
      })

      if (!targetWarehouse) {
        failCount += 1
        continue
      }

      const { data: existing } = await supabase
        .from('inventory')
        .select('*')
        .eq('warehouse_id', targetWarehouse.id)
        .eq('sku', uploadSku)
        .maybeSingle()

      const beforeQty = Number(existing?.qty || 0)

        if (existing) {
          const afterQty =
            bulkUploadMode === 'replace'
              ? uploadQty
              : beforeQty + uploadQty

          const changeQty =
            bulkUploadMode === 'replace'
              ? uploadQty - beforeQty
              : uploadQty

          const { error } = await supabase
            .from('inventory')
            .update({
              qty: afterQty,
              note: uploadNote || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)

          if (error) {
            failCount += 1
            continue
          }

          await supabase.from('inventory_logs').insert({
            inventory_id: existing.id,
            warehouse_id: targetWarehouse.id,
            sku: uploadSku,
            change_type:
              bulkUploadMode === 'replace'
                ? '엑셀수량변경'
                : '엑셀수량조정',
            change_qty: changeQty,
            before_qty: beforeQty,
            after_qty: afterQty,
            reason:
              uploadNote ||
              (bulkUploadMode === 'replace'
                ? '엑셀 수량 변경'
                : '엑셀 수량 조정'),
            source_type: 'excel',
          })
        } else {
        const { data, error } = await supabase
          .from('inventory')
          .insert({
            warehouse_id: targetWarehouse.id,
            sku: uploadSku,
            qty: uploadQty,
            note: uploadNote || null,
          })
          .select('*')
          .single()

        if (error) {
          failCount += 1
          continue
        }

        await supabase.from('inventory_logs').insert({
          inventory_id: data.id,
          warehouse_id: targetWarehouse.id,
          sku: uploadSku,
          change_type: '엑셀일괄등록',
          change_qty: uploadQty,
          before_qty: 0,
          after_qty: uploadQty,
          reason: uploadNote || '엑셀 일괄 등록',
          source_type: 'excel',
        })
      }

      successCount += 1
    }

    setIsSaving(false)

    alert(`재고 일괄 업로드 완료\n\n성공 ${successCount}건\n실패 ${failCount}건`)

    await fetchData()
  }

  async function handleDeleteInventory(item: Inventory) {
    const ok = window.confirm(
      `${item.sku} 재고를 삭제할까요?`
    )

    if (!ok) return

    await supabase.from('inventory_logs').insert({
      inventory_id: item.id,
      warehouse_id: item.warehouse_id,
      sku: item.sku,
      change_type: '삭제',
      change_qty: -(item.qty || 0),
      before_qty: item.qty || 0,
      after_qty: 0,
      reason: '재고 삭제',
      source_type: 'manual',
    })

    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', item.id)

    if (error) {
      alert(`삭제 실패\n\n${error.message}`)
      return
    }

    await fetchData()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">재고 등록/수정</h2>

        {editingId && (
          <p className="mt-2 text-sm text-blue-600">
            재고 수정 모드
          </p>
        )}

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
        <h2 className="font-semibold text-gray-900">엑셀 일괄 등록/수정</h2>

        <p className="mt-1 text-sm text-gray-500">
          창고명 또는 창고코드와 SKU를 기준으로 재고를 신규 등록하거나 수정합니다.
        </p>

        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-900">엑셀 헤더</p>
          <p className="mt-1">창고명, SKU, 수량, 비고</p>
          <p className="mt-1 text-xs text-gray-500">
            창고명 대신 창고코드를 사용할 경우: 창고코드, SKU, 수량, 비고
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={bulkUploadMode === 'replace' ? 'default' : 'outline'}
            onClick={() => setBulkUploadMode('replace')}
          >
            수량 변경(재고 전체 교체)
          </Button>

          <Button
            type="button"
            variant={bulkUploadMode === 'adjust' ? 'default' : 'outline'}
            onClick={() => setBulkUploadMode('adjust')}
          >
            수량 조정(기존 재고 ± 업로드 재고)
          </Button>
        </div>

        <div className="mt-4">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={isSaving}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return

              handleBulkUploadInventory(file)
              e.target.value = ''
            }}
          />
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
                <th className="p-3 text-right">관리</th>
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

                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => fetchInventoryLogs(item.sku)}
                        >
                          로그
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditInventory(item)}
                        >
                          수정
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteInventory(item)}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

    {selectedLogSku && (
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            재고 변경 로그 - {selectedLogSku}
          </h2>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedLogSku('')
              setInventoryLogs([])
            }}
          >
            닫기
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-3">일자</th>
                <th className="p-3">구분</th>
                <th className="p-3 text-right">변경수량</th>
                <th className="p-3 text-right">변경 전</th>
                <th className="p-3 text-right">변경 후</th>
                <th className="p-3">사유</th>
              </tr>
            </thead>

            <tbody>
              {inventoryLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    로그가 없습니다.
                  </td>
                </tr>
              ) : (
                inventoryLogs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="p-3">
                      {log.created_at?.slice(0, 16).replace('T', ' ') || '-'}
                    </td>
                    <td className="p-3">{log.change_type}</td>
                    <td className="p-3 text-right font-bold">
                      {formatNumber(log.change_qty)}
                    </td>
                    <td className="p-3 text-right">
                      {formatNumber(log.before_qty)}
                    </td>
                    <td className="p-3 text-right">
                      {formatNumber(log.after_qty)}
                    </td>
                    <td className="p-3">{log.reason || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    )}      
    </div>
  )
}