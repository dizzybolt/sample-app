'use client'

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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import * as XLSX from 'xlsx'

export function ProductMasterManager() {
  const supabase = createClient()

  const [brandCodes, setBrandCodes] = useState<BrandCode[]>([])
  const [categoryCodes, setCategoryCodes] = useState<CategoryCode[]>([])
  const [seasonCodes, setSeasonCodes] = useState<SeasonCode[]>([])
  const [yearCodes, setYearCodes] = useState<YearCode[]>([])
  const [products, setProducts] = useState<ProductMaster[]>([])

  const [brandCode, setBrandCode] = useState('')
  const [categoryCode, setCategoryCode] = useState('')
  const [yearCode, setYearCode] = useState('')
  const [seasonCode, setSeasonCode] = useState('')

  const [productName, setProductName] = useState('')
  const [gender, setGender] = useState('')
  const [sizeGroupName, setSizeGroupName] = useState('')
  const [note, setNote] = useState('')

  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [brandRes, categoryRes, seasonRes, yearRes, productRes] =
      await Promise.all([
        supabase
          .from('brand_codes')
          .select('*')
          .neq('is_active', false)
          .order('sort_no', { ascending: true })
          .order('code', { ascending: true }),

        supabase
          .from('category_codes')
          .select('*')
          .neq('is_active', false)
          .order('sort_no', { ascending: true })
          .order('code', { ascending: true }),

        supabase
          .from('season_codes')
          .select('*')
          .neq('is_active', false)
          .order('sort_no', { ascending: true })
          .order('code', { ascending: true }),

        supabase
          .from('year_codes')
          .select('*')
          .neq('is_active', false)
          .order('sort_no', { ascending: true })
          .order('code', { ascending: true }),

        supabase
          .from('product_master')
          .select('*')
          .order('created_at', { ascending: false }),
      ])

    setBrandCodes((brandRes.data || []) as BrandCode[])
    setCategoryCodes((categoryRes.data || []) as CategoryCode[])
    setSeasonCodes((seasonRes.data || []) as SeasonCode[])
    setYearCodes((yearRes.data || []) as YearCode[])
    setProducts((productRes.data || []) as ProductMaster[])
  }

  const generated = useMemo(() => {
    if (!brandCode || !categoryCode || !yearCode || !seasonCode) {
      return null
    }

    return generateNextModelName({
      brandCode,
      categoryCode,
      yearCode,
      seasonCode,
      existingProducts: products,
    })
  }, [brandCode, categoryCode, yearCode, seasonCode, products])

  async function handleCreateProduct() {
    if (!generated) {
      alert('브랜드/카테고리/연도/시즌 코드를 모두 선택해 주세요.')
      return
    }

    setIsSaving(true)

    const { error } = await supabase.from('product_master').insert({
      model_name: generated.modelName,
      brand_code: brandCode,
      category_code: categoryCode,
      year_code: yearCode,
      season_code: seasonCode,
      seq_no: generated.seqNo,
      product_name: productName.trim() || null,
      gender: gender.trim() || null,
      size_group_name: sizeGroupName.trim() || null,
      note: note.trim() || null,
      status: '운영대기',
    })

    setIsSaving(false)

    if (error) {
      alert(`상품 마스터 생성 실패\n\n${error.message}`)
      return
    }

    alert(`상품 마스터가 생성되었습니다.\n\n${generated.modelName}`)

    setBrandCode('')
    setCategoryCode('')
    setYearCode('')
    setSeasonCode('')
    setProductName('')
    setGender('')
    setSizeGroupName('')
    setNote('')

    await fetchData()
  }

async function handleBulkUploadModels(file: File) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

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

      if (!modelName || existingModelNames.has(modelName)) {
        return null
      }

      const brandCode = modelName.slice(0, 3)
      const categoryCode = modelName.slice(3, 5)
      const seqText = modelName.slice(5, 8)
      const yearCode = modelName.slice(8, 9)
      const seasonCode = modelName.slice(9, 10)
      const seqNo = Number(seqText)

      if (
        !brandCode ||
        !categoryCode ||
        !yearCode ||
        !seasonCode ||
        Number.isNaN(seqNo)
      ) {
        return null
      }

      return {
        model_name: modelName,
        brand_code: brandCode,
        category_code: categoryCode,
        seq_no: seqNo,
        year_code: yearCode,
        season_code: seasonCode,
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
        기존에 사용 중인 모델명을 엑셀로 업로드해 자동 생성 시 중복을 방지합니다.
    </p>

    <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-900">필수 열</p>
        <p className="mt-1">
        모델명, 브랜드코드, 카테고리코드, 연도코드, 시즌코드, 일련번호
        </p>
        <p className="mt-2 text-xs text-gray-500">
        선택 열: 상품명, 성별, 사이즈그룹, 상태, 비고
        </p>
    </div>

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
            value={sizeGroupName}
            onChange={(e) => setSizeGroupName(e.target.value)}
            placeholder="사이즈 그룹명"
          />

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="비고"
          />
        </div>

        <Button
          type="button"
          onClick={handleCreateProduct}
          disabled={isSaving}
          className="mt-4"
        >
          상품 마스터 생성
        </Button>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">등록된 상품 마스터</h2>

        <div className="mt-4 space-y-2">
          {products.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 상품이 없습니다.</p>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                className="rounded-xl border p-4"
              >
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