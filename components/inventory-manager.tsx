'use client'

import * as XLSX from 'xlsx'
import { useEffect, useMemo, useState, Fragment } from 'react' // 🟢 Fragment import 추가
import { createClient } from '@/lib/supabase/client'
import type { Inventory, InventoryLog, Warehouse, SkuMapping, ProductImage } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { batchUpsert, type BulkProgress } from '@/lib/bulk-upload'
import { OpsDataFreshness } from '@/components/ops-data-freshness'

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('ko-KR')
}

export function InventoryManager() {
  const supabase = createClient()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [inventories, setInventories] = useState<Inventory[]>([])

  // 🛠️ 인라인 수정을 위한 임시 입력 State들
  const [editWarehouseId, setEditWarehouseId] = useState('')
  const [editSku, setEditSku] = useState('')
  const [editQty, setEditQty] = useState('')
  const [editReason, setEditReason] = useState('')

  const [searchTerm, setSearchTerm] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  const [totalCount, setTotalCount] = useState(0)

  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [bulkUploadMode, setBulkUploadMode] = useState<'replace' | 'adjust'>(
    'replace'
  )

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<BulkProgress | null>(null)

  const [selectedLogSku, setSelectedLogSku] = useState('')
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([])

  const [skuMappings, setSkuMappings] = useState<SkuMapping[]>([])
  const [productImages, setProductImages] = useState<ProductImage[]>([])

  useEffect(() => {
    fetchWarehouses()
  }, [])

  useEffect(() => {
    searchInventory()
  }, [currentPage])

  async function fetchInventoryLogs(sku: string) {
    if (selectedLogSku === sku) {
      setSelectedLogSku('')
      setInventoryLogs([])
      return
    }

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
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)
    ])

    setWarehouses((warehouseRes.data || []) as Warehouse[])
    const nextInventories = (inventoryRes.data || []) as Inventory[]
    setInventories(nextInventories)
    setTotalCount(inventoryRes.count || 0)

    await fetchInventoryRelations(nextInventories)
  }

  async function fetchWarehouses() {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      alert(`창고 조회 실패\n\n${error.message}`)
      return
    }

    setWarehouses((data || []) as Warehouse[])
  }

  async function searchInventory() {
    const keyword = searchTerm.trim()

    let query = supabase
      .from('inventory')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(
        (currentPage - 1) * pageSize,
        currentPage * pageSize - 1
      )
      .limit(50)

    if (keyword) {
      const keywords = keyword
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)

      if (keywords.length === 1) {
        query = query.ilike(
          'sku',
          `%${keywords[0]}%`
        )
      } else {
        const conditions = keywords
          .map((value) => `sku.ilike.%${value}%`)
          .join(',')

        query = query.or(conditions)
      }
    }

    const { data, error, count } = await query

    if (error) {
      alert(`재고 검색 실패\n\n${error.message}`)
      return
    }

    const nextInventories = (data || []) as Inventory[]

    setInventories(nextInventories)
    setTotalCount(count || 0)

    await fetchInventoryRelations(nextInventories)
  }

  async function fetchInventoryRelations(items: Inventory[]) {
    const skus = items.map((item) => item.sku).filter(Boolean)

    if (skus.length === 0) {
      setSkuMappings([])
      setProductImages([])
      return
    }

    const { data: mappingData } = await supabase
      .from('sku_mappings')
      .select('*')
      .in('sku', skus)

    const mappings = (mappingData || []) as SkuMapping[]
    setSkuMappings(mappings)

    const modelNames = Array.from(
      new Set(mappings.map((item) => item.model_name).filter(Boolean))
    )

    if (modelNames.length === 0) {
      setProductImages([])
      return
    }

    const { data: imageData } = await supabase
      .from('product_images')
      .select('*')
      .in('model_name', modelNames)

    setProductImages((imageData || []) as ProductImage[])
  }

  const filteredInventories = useMemo(() => {
    return [...inventories].sort((a, b) => {
      const dateA = a.work_date || a.updated_at || ''
      const dateB = b.work_date || b.updated_at || ''

      const dateCompare = dateB.localeCompare(dateA)

      if (dateCompare !== 0) return dateCompare

      const mappingA = getSkuMapping(a.sku)
      const mappingB = getSkuMapping(b.sku)

      const modelA = mappingA?.model_name || a.sku.split('_')[0] || ''
      const modelB = mappingB?.model_name || b.sku.split('_')[0] || ''

      const modelCompare = modelA.localeCompare(modelB, 'ko')

      if (modelCompare !== 0) return modelCompare

      const colorA = mappingA?.color_code || a.sku.split('_')[1] || ''
      const colorB = mappingB?.color_code || b.sku.split('_')[1] || ''

      const colorCompare = colorA.localeCompare(colorB, 'ko', { numeric: true })

      if (colorCompare !== 0) return colorCompare

      const sizeA = mappingA?.size_code || a.sku.split('_')[2] || ''
      const sizeB = mappingB?.size_code || b.sku.split('_')[2] || ''

      return sizeA.localeCompare(sizeB, 'ko', { numeric: true })
    })
  }, [inventories, skuMappings])

  function getWarehouseName(id: string) {
    return warehouses.find((item) => item.id === id)?.name || '-'
  }

  function normalizeSku(sku: string) {
    return sku
      .trim()
      .toUpperCase()
      .replace(/_FREE$/, '_F')
  }

  function getSkuMapping(sku: string) {
    const normalizedSku = normalizeSku(sku)

    return skuMappings.find(
      (item) =>
        normalizeSku(item.sku) === normalizedSku
    )
  }

  function getProductImage(modelName?: string | null) {
    if (!modelName) return null
    return productImages.find((item) => item.model_name === modelName)
  }

  function shouldShowModelImage(item: Inventory, index: number) {
    const mapping = getSkuMapping(item.sku)
    const prevItem = filteredInventories[index - 1]
    const prevMapping = prevItem ? getSkuMapping(prevItem.sku) : null

    return mapping?.model_name !== prevMapping?.model_name
  }

  function handleEditInventory(item: Inventory) {
    setEditingId(item.id)
    setEditWarehouseId(item.warehouse_id)
    setEditSku(item.sku)
    setEditQty(String(item.qty || 0))
    setEditReason(item.note || '')
  }

  async function handleSaveInventory() {
    if (!editWarehouseId) {
      alert('창고를 선택해 주세요.')
      return
    }

    if (!editSku.trim()) {
      alert('SKU를 입력해 주세요.')
      return
    }

    const nextQty = Number(editQty.replaceAll(',', ''))

    if (Number.isNaN(nextQty)) {
      alert('수량을 숫자로 입력해 주세요.')
      return
    }

    setIsSaving(true)
    const normalizedSku = editSku.trim()

    const { data: existing } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', editingId)
      .maybeSingle()

    const beforeQty = Number(existing?.qty || 0)

    const { error } = await supabase
      .from('inventory')
      .update({
        warehouse_id: editWarehouseId,
        sku: normalizedSku,
        qty: nextQty,
        note: editReason.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingId)

    if (error) {
      setIsSaving(false)
      alert(`재고 수정 실패\n\n${error.message}`)
      return
    }

    const changeQty = nextQty - beforeQty

    await supabase.from('inventory_logs').insert({
      inventory_id: editingId,
      warehouse_id: editWarehouseId,
      sku: normalizedSku,
      change_type: '재고조정',
      change_qty: changeQty,
      before_qty: beforeQty,
      after_qty: nextQty,
      reason: editReason.trim() || null,
      source_type: 'manual',
    })

    setIsSaving(false)
    alert('재고 정보가 수정되었습니다.')

    setEditingId(null)
    setEditSku('')
    setEditQty('')
    setEditReason('')

    await fetchData()
  }

  async function handleBulkUploadInventory(file: File) {
    function normalizeInventorySku(value: string) {
      const parts = String(value || '').trim().toUpperCase().split('_')

      if (parts.length >= 3 && parts[parts.length - 1] === 'FREE') {
        parts[parts.length - 1] = 'F'
      }

      return parts.join('_')
    }

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

    setUploading(true)
    setIsSaving(true)
    setUploadProgress({
      total: rows.length,
      processed: 0,
      success: 0,
      fail: 0,
      percent: 0,
    })

    const uploadWorkDate = new Date().toISOString().slice(0, 10)

    const parsedRows = rows
      .map((row) => {
        const warehouseName = String(row.창고명 || row.warehouse_name || '').trim()
        const warehouseCode = String(row.창고코드 || row.warehouse_code || '').trim()
        const uploadSku = normalizeInventorySku(String(row.SKU || row.sku || '').trim())
        
        const rawQtyStr = String(row.수량 || row.qty || '0').replaceAll(',', '').trim()
        let uploadQty = Number(rawQtyStr)
        if (rawQtyStr === '-' || Number.isNaN(uploadQty) || uploadQty < 0) {
          uploadQty = 0
        }

        const uploadNote = String(row.비고 || row.note || '').trim()

        const targetWarehouse = warehouses.find((warehouse) => {
          if (warehouseName && warehouse.name === warehouseName) return true
          if (warehouseCode && warehouse.code === warehouseCode) return true
          return false
        })

        if (!targetWarehouse || !uploadSku) {
          return null
        }

        return {
          warehouse_id: targetWarehouse.id,
          sku: uploadSku,
          upload_qty: uploadQty,
          note: uploadNote,
        }
      })
      .filter(Boolean)

    if (parsedRows.length === 0) {
      setUploading(false)
      setIsSaving(false)
      alert('업로드 가능한 재고 데이터가 없습니다.')
      return
    }

    const mergedMap = new Map<string, NonNullable<(typeof parsedRows)[number]>>()

    for (const row of parsedRows) {
      const key = `${row!.warehouse_id}__${row!.sku}`
      const prev = mergedMap.get(key)

      if (!prev) {
        mergedMap.set(key, row!)
        continue
      }

      if (bulkUploadMode === 'adjust') {
        mergedMap.set(key, {
          ...row!,
          upload_qty: prev.upload_qty + row!.upload_qty,
          note: row!.note || prev.note,
        })
      } else {
        mergedMap.set(key, row!)
      }
    }

    const targetRows = Array.from(mergedMap.values())
    const targetWarehouseIds = Array.from(new Set(targetRows.map((row) => row.warehouse_id)))
    const targetSkus = Array.from(new Set(targetRows.map((row) => row.sku)))

    const existingRows: Inventory[] = []
    const CHUNK_SIZE = 150
    for (let i = 0; i < targetSkus.length; i += CHUNK_SIZE) {
      const chunkSkus = targetSkus.slice(i, i + CHUNK_SIZE)
      const { data: chunkData, error: chunkError } = await supabase
        .from('inventory')
        .select('*')
        .in('warehouse_id', targetWarehouseIds)
        .in('sku', chunkSkus)

      if (chunkError) {
        setUploading(false)
        setIsSaving(false)
        alert(`기존 재고 분할 조회 실패\n\n${chunkError.message}`)
        return
      }
      if (chunkData) {
        existingRows.push(...(chunkData as Inventory[]))
      }
    }

    const existingMap = new Map<string, Inventory>()

    existingRows.forEach((item) => {
      existingMap.set(`${item.warehouse_id}__${item.sku}`, item)
    })

    const inventoryRows = targetRows.map((row) => {
      const key = `${row.warehouse_id}__${row.sku}`
      const existing = existingMap.get(key)
      const beforeQty = Number(existing?.qty || 0)

      const afterQty =
        bulkUploadMode === 'replace'
          ? row.upload_qty
          : beforeQty + row.upload_qty

      return {
        warehouse_id: row.warehouse_id,
        sku: row.sku,
        qty: afterQty,
        work_date: uploadWorkDate,
        note: row.note || null,
        updated_at: new Date().toISOString(),
      }
    })

    const inventoryResult = await batchUpsert({
      supabase,
      tableName: 'inventory',
      rows: inventoryRows,
      onConflict: 'warehouse_id,sku',
      chunkSize: 500,
      onProgress: (progress) => {
        setUploadProgress({
          ...progress,
          total: targetRows.length,
          percent: Math.round(progress.percent * 0.7),
        })
      },
    })

    const savedRows: Inventory[] = []
    for (let i = 0; i < targetSkus.length; i += CHUNK_SIZE) {
      const chunkSkus = targetSkus.slice(i, i + CHUNK_SIZE)
      const { data: chunkData, error: chunkError } = await supabase
        .from('inventory')
        .select('*')
        .in('warehouse_id', targetWarehouseIds)
        .in('sku', chunkSkus)

      if (chunkError) {
        setUploading(false)
        setIsSaving(false)
        alert(`저장된 재고 분할 재조회 실패\n\n${chunkError.message}`)
        return
      }
      if (chunkData) {
        savedRows.push(...(chunkData as Inventory[]))
      }
    }

    const savedMap = new Map<string, Inventory>()

    savedRows.forEach((item) => {
      existingMap.set(`${item.warehouse_id}__${item.sku}`, item)
      savedMap.set(`${item.warehouse_id}__${item.sku}`, item)
    })

    const logRows = targetRows
      .map((row) => {
        const key = `${row.warehouse_id}__${row.sku}`
        const existing = existingMap.get(key)
        const saved = savedMap.get(key)

        if (!saved) return null

        const beforeQty = Number(existing?.qty || 0)
        const afterQty = Number(saved.qty || 0)

        const changeQty =
          bulkUploadMode === 'replace'
            ? afterQty - beforeQty
            : row.upload_qty

        return {
          inventory_id: saved.id,
          warehouse_id: row.warehouse_id,
          sku: row.sku,
          change_type:
            existing
              ? bulkUploadMode === 'replace'
                ? '엑셀수량변경'
                : '엑셀수량조정'
              : '엑셀일괄등록',
          change_qty: changeQty,
          before_qty: beforeQty,
          after_qty: afterQty,
          work_date: uploadWorkDate,
          reason:
            row.note ||
            (bulkUploadMode === 'replace'
              ? '엑셀 수량 변경'
              : '엑셀 수량 조정'),
          source_type: 'excel',
        }
      })
      .filter(Boolean)

    const logResult = await batchUpsert({
      supabase,
      tableName: 'inventory_logs',
      rows: logRows,
      chunkSize: 500,
      onProgress: (progress) => {
        setUploadProgress({
          total: targetRows.length,
          processed: targetRows.length,
          success: inventoryResult.success,
          fail: inventoryResult.fail,
          percent: 70 + Math.round(progress.percent * 0.3),
        })
      },
    })

    setUploading(false)
    setIsSaving(false)

    alert(
      `재고 일괄 업로드 완료\n\n성공 ${inventoryResult.success.toLocaleString()}건\n실패 ${inventoryResult.fail.toLocaleString()}건\n로그 ${logResult.success.toLocaleString()}건 저장`
    )

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

  function downloadInventoryExcel() {
    const rows = filteredInventories.map(
      (item, index) => ({
        NO: index + 1,
        창고: warehouses.find((w) => w.id === item.warehouse_id)?.name || '',
        SKU: item.sku,
        재고수량: item.qty,
        기준일: item.work_date || item.updated_at?.slice(0, 10) || '',
        비고: item.note || '',
      })
    )

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '재고목록')

    const fileName = searchTerm.trim() ? `재고검색결과.xlsx` : `재고목록.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  // 🟢 1,000개 제한 없는 전체 엑셀 다운로드 함수 보완 추가
  async function downloadAllInventoryExcel() {
    const ok = window.confirm('전체 재고 데이터를 조회하여 엑셀로 다운로드합니다. 진행할까요?')
    if (!ok) return

    const keyword = searchTerm.trim()
    const targetItems: any[] = []
    
    let page = 0
    const FETCH_LIMIT = 1000
    let hasMore = true

    while (hasMore) {
      let query = supabase
        .from('inventory')
        .select('*')
        .order('updated_at', { ascending: false })
        .range(page * FETCH_LIMIT, (page + 1) * FETCH_LIMIT - 1)

      if (keyword) {
        const keywords = keyword.split(',').map((v) => v.trim()).filter(Boolean)
        if (keywords.length === 1) {
          query = query.ilike('sku', `%${keywords[0]}%`)
        } else {
          const conditions = keywords.map((value) => `sku.ilike.%${value}%`).join(',')
          query = query.or(conditions)
        }
      }

      const { data: chunkData, error } = await query

      if (error) {
        alert(`전체 재고 조회 중 오류 발생 (페이지 ${page + 1})\n\n${error.message}`)
        return
      }

      if (chunkData && chunkData.length > 0) {
        targetItems.push(...chunkData)
        if (chunkData.length < FETCH_LIMIT) {
          hasMore = false
        } else {
          page++
        }
      } else {
        hasMore = false
      }
    }

    if (targetItems.length === 0) {
      alert('다운로드할 재고 데이터가 없습니다.')
      return
    }

    const rows = targetItems.map((item, index) => ({
      NO: index + 1,
      창고: warehouses.find((w) => w.id === item.warehouse_id)?.name || '',
      SKU: item.sku,
      재고수량: item.qty,
      기준일: item.work_date || item.updated_at?.slice(0, 10) || '',
      비고: item.note || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '전체재고목록')

    const fileName = keyword 
      ? `전체재고검색결과_${new Date().toISOString().slice(0, 10)}.xlsx` 
      : `전체재고목록_${new Date().toISOString().slice(0, 10)}.xlsx`

    XLSX.writeFile(workbook, fileName)
  }

  return (
    <div className="space-y-6">
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
            disabled={isSaving || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return

              handleBulkUploadInventory(file)
              e.target.value = ''
            }}
          />

          {uploading && uploadProgress && (
            <div className="mt-4 rounded-xl border bg-blue-50 p-4 text-sm text-blue-700">
              <div className="flex items-center justify-between">
                <p className="font-medium">업로드 중...</p>
                <p>{uploadProgress.percent}%</p>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>

              <p className="mt-2 text-xs">
                {uploadProgress.processed.toLocaleString()} /{' '}
                {uploadProgress.total.toLocaleString()}건 처리 중
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-gray-900">재고 목록</h2>

            <p className="text-sm text-gray-500">
              총 {totalCount.toLocaleString()}건
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                이전
              </Button>

              <span className="text-sm text-gray-500">
                {currentPage} / {Math.max(1, Math.ceil(totalCount / pageSize))}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                onClick={() => setCurrentPage((prev) => prev + 1)}
              >
                다음
              </Button>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-[620px]">
            <div className="relative flex-1">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="SKU 검색 (, 로 복수검색)"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCurrentPage(1)
                searchInventory()
              }}
            >
              검색
            </Button>

            <Button
              type="button"
              variant="outline"
              className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
              onClick={downloadAllInventoryExcel}
            >
              전체 엑셀
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={downloadInventoryExcel}
            >
              현재페이지 엑셀
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-3 text-center">NO</th>
                <th className="p-3 text-center">이미지</th>
                <th className="p-3 text-center">창고</th>
                <th className="p-3 text-center">품번번호</th>
                <th className="p-3 text-center">단품번호</th>
                <th className="p-3 text-center">모델명</th>
                <th className="p-3 text-center">색상</th>
                <th className="p-3 text-center">사이즈</th>
                <th className="p-3 text-center font-semibold">SKU</th>
                <th className="p-3 text-center font-semibold">현재고</th>
                <th className="p-3 text-center">최근수정일</th>
                <th className="p-3 text-left">비고</th>
                <th className="p-3 text-right">관리</th>
              </tr>
            </thead>

            <tbody>
              {filteredInventories.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-6 text-center text-gray-500">
                    등록된 재고가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredInventories.map((item, index) => {
                  const isEditing = editingId === item.id
                  const isLogOpen = selectedLogSku === item.sku

                  const mapping = getSkuMapping(item.sku)
                  const image = getProductImage(mapping?.model_name)
                  const showImage = shouldShowModelImage(item, index)

                  return (
                    <Fragment key={item.id}>
                      <tr className={`border-b ${isEditing ? 'bg-blue-50/50' : ''}`}>
                        <td className="p-3 text-center">
                          {(currentPage - 1) * pageSize + index + 1}
                        </td>

                        <td className="p-3 text-center">
                          {showImage ? (
                            image?.image_url ? (
                              <img
                                src={image.image_url}
                                alt={mapping?.model_name || item.sku}
                                className="mx-auto h-14 w-14 rounded border object-cover" // 👈 이 부분
                              />
                            ) : (
                              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded border bg-gray-50 text-[10px] text-gray-400">
                                NO IMAGE
                              </div>
                            )
                          ) : null}
                        </td>

                        <td className="p-3 text-center">
                          {isEditing ? (
                            <Select value={editWarehouseId} onValueChange={setEditWarehouseId}>
                              <SelectTrigger className="w-[120px] mx-auto h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {warehouses.map((w) => (
                                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            getWarehouseName(item.warehouse_id)
                          )}
                        </td>

                        <td className="p-3 text-center">{mapping?.item_no || '-'}</td>
                        <td className="p-3 text-center">{mapping?.single_no || '-'}</td>
                        <td className="p-3 text-center">{mapping?.model_name || '-'}</td>
                        <td className="p-3 text-center">
                          {mapping ? `${String(mapping.color_code).padStart(2, '0')} ${mapping.color_name || ''}` : '-'}
                        </td>
                        <td className="p-3 text-center">{mapping?.size_code || '-'}</td>

                        <td className="p-3 text-center font-medium">
                          {isEditing ? (
                            <Input 
                              value={editSku} 
                              onChange={(e) => setEditSku(e.target.value)} 
                              className="w-[140px] mx-auto h-8 text-xs text-center"
                            />
                          ) : (
                            item.sku
                          )}
                        </td>

                        <td className="p-3 text-center font-bold">
                          {isEditing ? (
                            <Input 
                              value={editQty} 
                              onChange={(e) => setEditQty(e.target.value)} 
                              className="w-[70px] mx-auto h-8 text-xs text-center font-bold"
                              inputMode="numeric"
                            />
                          ) : (
                            formatNumber(item.qty)
                          )}
                        </td>

                        <td className="p-3 text-center">
                          {item.work_date || item.updated_at?.slice(0, 10) || '-'}
                        </td>

                        <td className="p-3 text-left">
                          {isEditing ? (
                            <Input 
                              value={editReason} 
                              onChange={(e) => setEditReason(e.target.value)} 
                              placeholder="수정 사유 입력"
                              className="w-full h-8 text-xs"
                            />
                          ) : (
                            item.note || '-'
                          )}
                        </td>

                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            {isEditing ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                                  disabled={isSaving}
                                  onClick={handleSaveInventory}
                                >
                                  저장
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => setEditingId(null)}
                                >
                                  취소
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={isLogOpen ? "default" : "outline"}
                                  className="h-8"
                                  onClick={() => fetchInventoryLogs(item.sku)}
                                >
                                  로그
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => handleEditInventory(item)}
                                >
                                  수정
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className="h-8"
                                  onClick={() => handleDeleteInventory(item)}
                                >
                                  삭제
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isLogOpen && (
                        <tr className="bg-gray-50/70 border-b">
                          <td colSpan={13} className="p-4 bg-gray-50/50">
                            <div className="rounded-xl border bg-white p-4 shadow-inner max-w-4xl mx-auto">
                              <div className="flex items-center justify-between border-b pb-2 mb-3">
                                <span className="font-semibold text-gray-800 text-xs">
                                  📊 [ {item.sku} ] 재고 변경 로그 기록
                                </span>
                                <button 
                                  onClick={() => { setSelectedLogSku(''); setInventoryLogs([]); }}
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                >
                                  닫기 ✕
                                </button>
                              </div>
                              
                              <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                  <tr className="border-b bg-gray-100 text-gray-600 font-medium">
                                    <th className="p-2">변경일자</th>
                                    <th className="p-2">작업구분</th>
                                    <th className="p-2 text-right">변동수량</th>
                                    <th className="p-2 text-right">변경 전</th>
                                    <th className="p-2 text-right">변경 후</th>
                                    <th className="p-2 pl-4">변경 사유 / 비고</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {inventoryLogs.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} className="p-4 text-center text-gray-400">
                                        조회된 변경 로그 내역이 없습니다.
                                      </td>
                                    </tr>
                                  ) : (
                                    inventoryLogs.map((log) => (
                                      <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50/50">
                                        <td className="p-2 text-gray-500">
                                          {log.work_date || log.created_at?.slice(0, 10) || '-'}
                                        </td>
                                        <td className="p-2">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            log.change_type === '삭제' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700'
                                          }`}>
                                            {log.change_type}
                                          </span>
                                        </td>
                                        <td className={`p-2 text-right font-bold ${Number(log.change_qty) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                          {Number(log.change_qty) >= 0 ? `+${formatNumber(log.change_qty)}` : formatNumber(log.change_qty)}
                                        </td>
                                        <td className="p-2 text-right text-gray-500">{formatNumber(log.before_qty)}</td>
                                        <td className="p-2 text-right font-medium text-gray-800">{formatNumber(log.after_qty)}</td>
                                        <td className="p-2 pl-4 text-gray-600">{log.reason || '-'}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}