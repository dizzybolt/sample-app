'use client'

import { useState, useEffect } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { BrandCode, CategoryCode, SeasonCode, YearCode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ModelCodeManager() {
  const supabase = createClient()

  // Brand Codes
  const [brandCodes, setBrandCodes] = useState<BrandCode[]>([])
  const [newBrandCode, setNewBrandCode] = useState('')
  const [newBrandType, setNewBrandType] = useState('')
  const [newBrandDesc, setNewBrandDesc] = useState('')

  // Category Codes
  const [categoryCodes, setCategoryCodes] = useState<CategoryCode[]>([])
  const [newCategoryCode, setNewCategoryCode] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryNote, setNewCategoryNote] = useState('')

  // Season Codes
  const [seasonCodes, setSeasonCodes] = useState<SeasonCode[]>([])
  const [newSeasonCode, setNewSeasonCode] = useState('')
  const [newSeasonName, setNewSeasonName] = useState('')
  const [newSeasonNote, setNewSeasonNote] = useState('')

  // Year Codes
  const [yearCodes, setYearCodes] = useState<YearCode[]>([])
  const [newYearCode, setNewYearCode] = useState('')
  const [newYearLabel, setNewYearLabel] = useState('')
  const [newYearNote, setNewYearNote] = useState('')

  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadAllCodes()
  }, [])

  const loadAllCodes = async () => {
    try {
      const [brandRes, categoryRes, seasonRes, yearRes] = await Promise.all([
        supabase.from('brand_codes').select('*').order('sort_no'),
        supabase.from('category_codes').select('*').order('sort_no'),
        supabase.from('season_codes').select('*').order('sort_no'),
        supabase.from('year_codes').select('*').order('sort_no'),
      ])

      if (brandRes.data) setBrandCodes(brandRes.data)
      if (categoryRes.data) setCategoryCodes(categoryRes.data)
      if (seasonRes.data) setSeasonCodes(seasonRes.data)
      if (yearRes.data) setYearCodes(yearRes.data)
    } catch (error) {
      console.error('Failed to load codes:', error)
    }
  }

  // Brand Code Operations
  const addBrandCode = async () => {
    const code = newBrandCode.trim()
    if (!code) {
      alert('브랜드 코드를 입력해 주세요.')
      return
    }

    if (brandCodes.some((item) => item.code === code)) {
      alert('이미 등록된 브랜드 코드입니다.')
      return
    }

    setIsSaving(true)
    const { data, error } = await supabase
      .from('brand_codes')
      .insert({
        code,
        type: newBrandType || null,
        description: newBrandDesc || null,
        sort_no: brandCodes.length + 1,
        is_active: true,
      })
      .select()

    if (error) {
      console.error('Failed to add brand code:', error)
      alert('브랜드 코드 추가에 실패했습니다.')
    } else if (data) {
      setBrandCodes([...brandCodes, data[0]])
      setNewBrandCode('')
      setNewBrandType('')
      setNewBrandDesc('')
    }
    setIsSaving(false)
  }

  const deleteBrandCode = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    const { error } = await supabase.from('brand_codes').delete().eq('id', id)

    if (error) {
      console.error('Failed to delete:', error)
      alert('삭제에 실패했습니다.')
    } else {
      setBrandCodes(brandCodes.filter((item) => item.id !== id))
    }
  }

  // Category Code Operations
  const addCategoryCode = async () => {
    const code = newCategoryCode.trim()
    if (!code) {
      alert('카테고리 코드를 입력해 주세요.')
      return
    }

    if (categoryCodes.some((item) => item.code === code)) {
      alert('이미 등록된 카테고리 코드입니다.')
      return
    }

    setIsSaving(true)
    const { data, error } = await supabase
      .from('category_codes')
      .insert({
        code,
        category_name: newCategoryName || null,
        note: newCategoryNote || null,
        sort_no: categoryCodes.length + 1,
        is_active: true,
      })
      .select()

    if (error) {
      console.error('Failed to add category code:', error)
      alert('카테고리 코드 추가에 실패했습니다.')
    } else if (data) {
      setCategoryCodes([...categoryCodes, data[0]])
      setNewCategoryCode('')
      setNewCategoryName('')
      setNewCategoryNote('')
    }
    setIsSaving(false)
  }

  const deleteCategoryCode = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('category_codes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete:', error)
      alert('삭제에 실패했습니다.')
    } else {
      setCategoryCodes(categoryCodes.filter((item) => item.id !== id))
    }
  }

  // Season Code Operations
  const addSeasonCode = async () => {
    const code = newSeasonCode.trim()
    if (!code) {
      alert('시즌 코드를 입력해 주세요.')
      return
    }

    if (seasonCodes.some((item) => item.code === code)) {
      alert('이미 등록된 시즌 코드입니다.')
      return
    }

    setIsSaving(true)
    const { data, error } = await supabase
      .from('season_codes')
      .insert({
        code,
        season_name: newSeasonName || null,
        note: newSeasonNote || null,
        sort_no: seasonCodes.length + 1,
        is_active: true,
      })
      .select()

    if (error) {
      console.error('Failed to add season code:', error)
      alert('시즌 코드 추가에 실패했습니다.')
    } else if (data) {
      setSeasonCodes([...seasonCodes, data[0]])
      setNewSeasonCode('')
      setNewSeasonName('')
      setNewSeasonNote('')
    }
    setIsSaving(false)
  }

  const deleteSeasonCode = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('season_codes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete:', error)
      alert('삭제에 실패했습니다.')
    } else {
      setSeasonCodes(seasonCodes.filter((item) => item.id !== id))
    }
  }

  // Year Code Operations
  const addYearCode = async () => {
    const code = newYearCode.trim()
    if (!code) {
      alert('연도 코드를 입력해 주세요.')
      return
    }

    if (yearCodes.some((item) => item.code === code)) {
      alert('이미 등록된 연도 코드입니다.')
      return
    }

    setIsSaving(true)
    const { data, error } = await supabase
      .from('year_codes')
      .insert({
        code,
        year_label: newYearLabel || null,
        note: newYearNote || null,
        sort_no: yearCodes.length + 1,
        is_active: true,
      })
      .select()

    if (error) {
      console.error('Failed to add year code:', error)
      alert('연도 코드 추가에 실패했습니다.')
    } else if (data) {
      setYearCodes([...yearCodes, data[0]])
      setNewYearCode('')
      setNewYearLabel('')
      setNewYearNote('')
    }
    setIsSaving(false)
  }

  const deleteYearCode = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('year_codes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete:', error)
      alert('삭제에 실패했습니다.')
    } else {
      setYearCodes(yearCodes.filter((item) => item.id !== id))
    }
  }

  return (
    <Tabs defaultValue="brand" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="brand">브랜드</TabsTrigger>
        <TabsTrigger value="category">카테고리</TabsTrigger>
        <TabsTrigger value="season">시즌</TabsTrigger>
        <TabsTrigger value="year">연도</TabsTrigger>
      </TabsList>

      {/* Brand Codes Tab */}
      <TabsContent value="brand">
        <Card>
          <CardHeader>
            <CardTitle>브랜드 코드 관리</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    브랜드 코드 *
                  </label>
                  <Input
                    placeholder="예: Nike"
                    value={newBrandCode}
                    onChange={(e) => setNewBrandCode(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">타입</label>
                  <Input
                    placeholder="예: 스포츠"
                    value={newBrandType}
                    onChange={(e) => setNewBrandType(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">설명</label>
                  <Input
                    placeholder="설명"
                    value={newBrandDesc}
                    onChange={(e) => setNewBrandDesc(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <Button
                onClick={addBrandCode}
                disabled={isSaving}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                브랜드 코드 추가
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>코드</TableHead>
                    <TableHead>타입</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead>정렬</TableHead>
                    <TableHead>활성</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brandCodes.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.code}</TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.sort_no}</TableCell>
                      <TableCell>
                        {item.is_active ? '활성' : '비활성'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteBrandCode(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Category Codes Tab */}
      <TabsContent value="category">
        <Card>
          <CardHeader>
            <CardTitle>카테고리 코드 관리</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    카테고리 코드 *
                  </label>
                  <Input
                    placeholder="예: TOPS"
                    value={newCategoryCode}
                    onChange={(e) => setNewCategoryCode(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">이름</label>
                  <Input
                    placeholder="예: 상의"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">비고</label>
                  <Input
                    placeholder="비고"
                    value={newCategoryNote}
                    onChange={(e) => setNewCategoryNote(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <Button
                onClick={addCategoryCode}
                disabled={isSaving}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                카테고리 코드 추가
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>코드</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>비고</TableHead>
                    <TableHead>정렬</TableHead>
                    <TableHead>활성</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryCodes.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.code}</TableCell>
                      <TableCell>{item.category_name}</TableCell>
                      <TableCell>{item.note}</TableCell>
                      <TableCell>{item.sort_no}</TableCell>
                      <TableCell>
                        {item.is_active ? '활성' : '비활성'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCategoryCode(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Season Codes Tab */}
      <TabsContent value="season">
        <Card>
          <CardHeader>
            <CardTitle>시즌 코드 관리</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    시즌 코드 *
                  </label>
                  <Input
                    placeholder="예: SS"
                    value={newSeasonCode}
                    onChange={(e) => setNewSeasonCode(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">이름</label>
                  <Input
                    placeholder="예: 봄/여름"
                    value={newSeasonName}
                    onChange={(e) => setNewSeasonName(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">비고</label>
                  <Input
                    placeholder="비고"
                    value={newSeasonNote}
                    onChange={(e) => setNewSeasonNote(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <Button
                onClick={addSeasonCode}
                disabled={isSaving}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                시즌 코드 추가
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>코드</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>비고</TableHead>
                    <TableHead>정렬</TableHead>
                    <TableHead>활성</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seasonCodes.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.code}</TableCell>
                      <TableCell>{item.season_name}</TableCell>
                      <TableCell>{item.note}</TableCell>
                      <TableCell>{item.sort_no}</TableCell>
                      <TableCell>
                        {item.is_active ? '활성' : '비활성'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSeasonCode(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Year Codes Tab */}
      <TabsContent value="year">
        <Card>
          <CardHeader>
            <CardTitle>연도 코드 관리</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    연도 코드 *
                  </label>
                  <Input
                    placeholder="예: 2024"
                    value={newYearCode}
                    onChange={(e) => setNewYearCode(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">라벨</label>
                  <Input
                    placeholder="예: 2024년"
                    value={newYearLabel}
                    onChange={(e) => setNewYearLabel(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">비고</label>
                  <Input
                    placeholder="비고"
                    value={newYearNote}
                    onChange={(e) => setNewYearNote(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <Button
                onClick={addYearCode}
                disabled={isSaving}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                연도 코드 추가
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>코드</TableHead>
                    <TableHead>라벨</TableHead>
                    <TableHead>비고</TableHead>
                    <TableHead>정렬</TableHead>
                    <TableHead>활성</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearCodes.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.code}</TableCell>
                      <TableCell>{item.year_label}</TableCell>
                      <TableCell>{item.note}</TableCell>
                      <TableCell>{item.sort_no}</TableCell>
                      <TableCell>
                        {item.is_active ? '활성' : '비활성'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteYearCode(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
