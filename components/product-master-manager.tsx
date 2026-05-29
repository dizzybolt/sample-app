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
import { generateSkuList } from '@/lib/sku-generator'

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

  const [sizeGroups, setSizeGroups] = useState<any[]>([])

  const [selectedColorCode, setSelectedColorCode] =
    useState('')

  const [selectedColorName, setSelectedColorName] =
    useState('')

  const [selectedSizeGroupId, setSelectedSizeGroupId] =
    useState('')  

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [ 
        brandRes,
        categoryRes,
        seasonRes,
        yearRes,
        productRes,
        sizeGroupRes,
    ] = await Promise.all([
        supabase
          .from('brand_codes')
          .select('*')
          .eq('is_active', true)
          .order('sort_no', { ascending: true }),

        supabase
          .from('category_codes')
          .select('*')
          .eq('is_active', true)
          .order('sort_no', { ascending: true }),

        supabase
          .from('season_codes')
          .select('*')
          .eq('is_active', true)
          .order('sort_no', { ascending: true }),

        supabase
          .from('year_codes')
          .select('*')
          .eq('is_active', true)
          .order('sort_no', { ascending: true }),

        supabase
          .from('product_master')
          .select('*')
          .order('created_at', { ascending: false }),

        supabase
        .from('size_groups')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      ])

    setBrandCodes((brandRes.data || []) as BrandCode[])
    setCategoryCodes((categoryRes.data || []) as CategoryCode[])
    setSeasonCodes((seasonRes.data || []) as SeasonCode[])
    setYearCodes((yearRes.data || []) as YearCode[])
    setProducts((productRes.data || []) as ProductMaster[])
    setSizeGroups(sizeGroupRes.data || [])
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

  const selectedSizeGroup = sizeGroups.find(
    (group) => group.id === selectedSizeGroupId
  )

  const selectedSizes =
    selectedSizeGroup?.sizes || []

const generatedSkus =
  generated &&
  selectedColorCode &&
  selectedSizes.length > 0
    ? generateSkuList({
        modelName: generated.modelName,
        colorCode: selectedColorCode,
        colorName: selectedColorName,
        sizes: selectedSizes,
      })
    : []

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

    setProductName('')
    setGender('')
    setSizeGroupName('')
    setNote('')

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
                  {item.code} {item.category_name ? `- ${item.category_name}` : ''}
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
                  {item.code} {item.season_name ? `- ${item.season_name}` : ''}
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
    <h2 className="font-semibold text-gray-900">
        SKU 생성
    </h2>

    <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Input
        value={selectedColorCode}
        onChange={(e) =>
            setSelectedColorCode(e.target.value)
        }
        placeholder="컬러코드"
        />

        <Input
        value={selectedColorName}
        onChange={(e) =>
            setSelectedColorName(e.target.value)
        }
        placeholder="컬러명"
        />

        <Select
        value={selectedSizeGroupId}
        onValueChange={setSelectedSizeGroupId}
        >
        <SelectTrigger>
            <SelectValue placeholder="사이즈그룹" />
        </SelectTrigger>

        <SelectContent>
            {sizeGroups.map((group) => (
            <SelectItem
                key={group.id}
                value={group.id}
            >
                {group.name}
            </SelectItem>
            ))}
        </SelectContent>
        </Select>
    </div>

    <div className="mt-5 rounded-xl bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-700">
        생성 예정 SKU
        </p>

        <div className="mt-3 space-y-2">
        {generatedSkus.length === 0 ? (
            <p className="text-sm text-gray-400">
            컬러/사이즈그룹을 선택하세요.
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
                className="flex flex-col gap-1 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-bold text-gray-900">{product.model_name}</p>
                  <p className="text-sm text-gray-500">
                    {product.product_name || '-'} / {product.status || '-'}
                  </p>
                </div>

                <p className="text-sm text-gray-500">
                  {product.brand_code}
                  {product.category_code}-{product.seq_no}
                  {product.year_code}
                  {product.season_code}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}