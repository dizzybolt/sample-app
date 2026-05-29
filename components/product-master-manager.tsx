'use client'

import * as XLSX from 'xlsx'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  BrandCode,
  CategoryCode,
  ProductMaster,
  SeasonCode,
  YearCode,
} from '@/lib/types'
import { generateNextModelName } from '@/lib/model-name'
import { generateSkuList } from '@/lib/sku-generator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ColorCodeRow = {
  id: string
  color_code: string
  color_name?: string | null
  sort_order?: number | null
}

type SizeGroupRow = {
  id: string
  name: string
  sizes: string[]
  sort_order?: number | null
}

export function ProductMasterManager() {
  const supabase = createClient()

  const [brandCodes, setBrandCodes] = useState<BrandCode[]>([])
  const [categoryCodes, setCategoryCodes] = useState<CategoryCode[]>([])
  const [seasonCodes, setSeasonCodes] = useState<SeasonCode[]>([])
  const [yearCodes, setYearCodes] = useState<YearCode[]>([])
  const [products, setProducts] = useState<ProductMaster[]>([])
  const [colorCodes, setColorCodes] = useState<ColorCodeRow[]>([])
  const [sizeGroups, setSizeGroups] = useState<SizeGroupRow[]>([])

  const [brandCode, setBrandCode] = useState('')
  const [categoryCode, setCategoryCode] = useState('')
  const [yearCode, setYearCode] = useState('')
  const [seasonCode, setSeasonCode] = useState('')

  const [productName, setProductName] = useState('')
  const [gender, setGender] = useState('')
  const [note, setNote] = useState('')

  const [selectedColorCode, setSelectedColorCode] = useState('')
  const [selectedSizeGroupId, setSelectedSizeGroupId] = useState('')

  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [
      brandRes,
      categoryRes,
      yearRes,
      seasonRes,
      productRes,
      colorRes,
      sizeGroupRes,
    ] = await Promise.all([
      supabase
        .from('brand_codes')
        .select('*')
        .order('sort_no', { ascending: true })
        .order('code', { ascending: true }),

      supabase
        .from('category_codes')
        .select('*')
        .order('sort_no', { ascending: true })
        .order('code', { ascending: true }),

      supabase
        .from('year_codes')
        .select('*')
        .order('sort_no', { ascending: true })
        .order('code', { ascending: true }),

      supabase
        .from('season_codes')
        .select('*')
        .order('sort_no', { ascending: true })
        .order('code', { ascending: true }),

      supabase
        .from('product_master')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('color_codes')
        .select('*')
        .neq('is_active', false)
        .order('sort_order', { ascending: true }),

      supabase
        .from('size_groups')
        .select('*')
        .neq('is_active', false)
        .order('sort_order', { ascending: true }),
    ])

    setBrandCodes((brandRes.data || []) as BrandCode[])
    setCategoryCodes((categoryRes.data || []) as CategoryCode[])
    setYearCodes((yearRes.data || []) as YearCode[])
    setSeasonCodes((seasonRes.data || []) as SeasonCode[])
    setProducts((productRes.data || []) as ProductMaster[])
    setColorCodes((colorRes.data || []) as ColorCodeRow[])
    setSizeGroups((sizeGroupRes.data || []) as SizeGroupRow[])
  }

  const generated = useMemo(() => {
    if (!brandCode || !categoryCode || !yearCode || !seasonCode) return null

    return generateNextModelName({
      brandCode,
      categoryCode,
      yearCode,
      seasonCode,
      existingProducts: products,
    })
  }, [brandCode, categoryCode, yearCode, seasonCode, products])

  const selectedColor = colorCodes.find(
    (color) => color.color_code === selectedColorCode
  )

  const selectedSizeGroup = sizeGroups.find(
    (group) => group.id === selectedSizeGroupId
  )

  const selectedSizes: string[] = Array.isArray(selectedSizeGroup?.sizes)
    ? selectedSizeGroup.sizes
    : []

  const generatedSkus =
    generated && selectedColorCode && selectedSizes.length > 0
      ? generateSkuList({
          modelName: generated.modelName,
          colorCode: selectedColorCode,
          colorName: selectedColor?.color_name || '',
          sizes: selectedSizes,
        })
      : []

  async function handleCreateProduct() {
    if (!generated) {
      alert('브랜드/카테고리/연도/시즌 코드를 모두 선택해 주세요.')
      return
    }

    setIsSaving(true)

    const skuValues = generatedSkus.map((item) => item.sku)

    if (skuValues.length > 0) {
      const { data: duplicatedSkus } = await supabase
        .from('product_skus')
        .select('sku')
        .in('sku', skuValues)

      if ((duplicatedSkus || []).length > 0) {
        setIsSaving(false)
        alert(
          `이미 등록된 SKU가 있습니다.\n\n${duplicatedSkus
            ?.map((item) => item.sku)
            .join('\n')}`
        )
        return
      }
    }

    const { data: product, error: productError } = await supabase
      .from('product_master')
      .insert({
        model_name: generated.modelName,
        brand_code: brandCode,
        category_code: categoryCode,
        year_code: yearCode,
        season_code: seasonCode,
        seq_no: generated.seqNo,
        product_name: productName.trim() || null,
        gender: gender.trim() || null,
        size_group_name: selectedSizeGroup?.name || null,
        note: note.trim() || null,
        status: '운영대기',
      })
      .select('*')
      .single()

    if (productError) {
      setIsSaving(false)
      alert(`상품 마스터 생성 실패\n\n${productError.message}`)
      return
    }

    if (generatedSkus.length > 0) {
      const skuRows = generatedSkus.map((item) => ({
        product_id: product.id,
        model_name: generated.modelName,
        sku: item.sku,
        color_code: item.colorCode,
        color_name: item.colorName || null,
        size_label: item.sizeLabel,
        image_url: null,
        is_active: true,
      }))

      const { error: skuError } = await supabase
        .from('product_skus')
        .insert(skuRows)

      if (skuError) {
        setIsSaving(false)
        alert(`SKU 생성 실패\n\n${skuError.message}`)
        return
      }
    }

    setIsSaving(false)

    alert(
      `상품 마스터가 생성되었습니다.\n\n모델명: ${
        generated.modelName
      }\nSKU: ${generatedSkus.length}개`
    )

    setBrandCode('')
    setCategoryCode('')
    setYearCode('')
    setSeasonCode('')
    setProductName('')
    setGender('')
    setNote('')
    setSelectedColorCode('')
    setSelectedSizeGroupId('')

    await fetchData()
  }

  async function handleBulkUploadModels(file: File) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
    })

    if (rows.length === 0) {
      alert('업로드할 모델명이 없습니다.')
      return
    }

    const existingModelNames = new Set(
      products.map((product) => product.model_name)
    )

    const insertRows = rows
      .map((row) => {
        const modelName = String(row.모델명 || row.model_name || '').trim()

        if (!modelName || existingModelNames.has(modelName)) return null

        const brandCodeValue = modelName.slice(0, 3)
        const categoryCodeValue = modelName.slice(3, 5)
        const seqText = modelName.slice(5, 8)
        const yearCodeValue = modelName.slice(8, 9)
        const seasonCodeValue = modelName.slice(9, 10)
        const seqNo = Number(seqText)

        if (
          !brandCodeValue ||
          !categoryCodeValue ||
          !yearCodeValue ||
          !seasonCodeValue ||
          Number.isNaN(seqNo)
        ) {
          return null
        }

        return {
          model_name: modelName,
          brand_code: brandCodeValue,
          category_code: categoryCodeValue,
          seq_no: seqNo,
          year_code: yearCodeValue,
          season_code: seasonCodeValue,
          status: '기존등록',
          note: '기존 사용 모델명 일괄 등록',
        }
      })
      .filter(Boolean)

    if (insertRows.length === 0) {
      alert('신규 등록할 모델명이 없습니다.')
      return
    }

    setIsSaving(true)

    const { error } = await supabase.from('product_master').insert(insertRows)

    setIsSaving(false)

    if (error) {
      alert(`모델명 일괄 등록 실패\n\n${error.message}`)
      return
    }

    alert(
      `모델명 일괄 등록 완료\n\n전체 ${rows.length}건 중 신규 ${insertRows.length}건 등록`
    )

    await fetchData()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">모델명 생성</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Select value={brandCode} onValueChange={setBrandCode}>
            <SelectTrigger>
              <SelectValue placeholder="브랜드코드" />
            </SelectTrigger>
            <SelectContent>
              {brandCodes.map((item) => (
                <SelectItem key={item.id} value={item.code}>
                  {item.code} {item.type ? `- ${item.type}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryCode} onValueChange={setCategoryCode}>
            <SelectTrigger>
              <SelectValue placeholder="카테고리코드" />
            </SelectTrigger>
            <SelectContent>
              {categoryCodes.map((item) => (
                <SelectItem key={item.id} value={item.code}>
                  {item.code}{' '}
                  {item.category_name ? `- ${item.category_name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={yearCode} onValueChange={setYearCode}>
            <SelectTrigger>
              <SelectValue placeholder="연도코드" />
            </SelectTrigger>
            <SelectContent>
              {yearCodes.map((item) => (
                <SelectItem key={item.id} value={item.code}>
                  {item.code} {item.year_label ? `- ${item.year_label}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={seasonCode} onValueChange={setSeasonCode}>
            <SelectTrigger>
              <SelectValue placeholder="시즌코드" />
            </SelectTrigger>
            <SelectContent>
              {seasonCodes.map((item) => (
                <SelectItem key={item.id} value={item.code}>
                  {item.code}{' '}
                  {item.season_name ? `- ${item.season_name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-5 rounded-xl bg-gray-50 p-4">
          <p className="text-sm text-gray-500">생성 예정 모델명</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {generated?.modelName || '-'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            브랜드 + 카테고리 + 일련번호 3자리 + 연도 + 시즌
          </p>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">기존 모델명 일괄 등록</h2>
        <p className="mt-1 text-sm text-gray-500">
          엑셀 첫 번째 열에 “모델명” 헤더를 넣고 기존 모델명을 업로드합니다.
        </p>

        <div className="mt-4">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={isSaving}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return

              handleBulkUploadModels(file)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">상품 정보</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="상품명"
          />

          <Input
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            placeholder="성별 / 구분"
          />

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="비고"
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">SKU 생성 설정</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Select value={selectedColorCode} onValueChange={setSelectedColorCode}>
            <SelectTrigger>
              <SelectValue placeholder="컬러코드 선택" />
            </SelectTrigger>
            <SelectContent>
              {colorCodes.map((color) => (
                <SelectItem key={color.id} value={color.color_code}>
                  {color.color_code} - {color.color_name || ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedSizeGroupId}
            onValueChange={setSelectedSizeGroupId}
          >
            <SelectTrigger>
              <SelectValue placeholder="사이즈그룹 선택" />
            </SelectTrigger>
            <SelectContent>
              {sizeGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-5 rounded-xl bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-700">생성 예정 SKU</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {generatedSkus.length === 0 ? (
              <p className="text-sm text-gray-400">
                모델명/컬러/사이즈그룹을 선택하세요.
              </p>
            ) : (
              generatedSkus.map((item) => (
                <div
                  key={item.sku}
                  className="rounded-lg border bg-white px-3 py-2 text-sm"
                >
                  {item.sku}
                </div>
              ))
            )}
          </div>
        </div>

        <Button
          type="button"
          onClick={handleCreateProduct}
          disabled={isSaving}
          className="mt-4"
        >
          상품 마스터 + SKU 생성
        </Button>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">등록된 상품 마스터</h2>

        <div className="mt-4 space-y-2">
          {products.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 상품이 없습니다.</p>
          ) : (
            products.map((product) => (
              <div key={product.id} className="rounded-xl border p-4">
                <p className="font-bold text-gray-900">
                  {product.model_name}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {product.product_name || '-'} / {product.status || '-'}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  브랜드 {product.brand_code} · 카테고리{' '}
                  {product.category_code} · 연도 {product.year_code} · 시즌{' '}
                  {product.season_code} · 일련번호 {product.seq_no}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}