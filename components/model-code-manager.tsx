'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  BrandCode,
  CategoryCode,
  SeasonCode,
  YearCode,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type TabType = 'brand' | 'category' | 'season' | 'year'

type CodeRow = {
  id: string
  sort_no?: number | null
  code: string
  name?: string | null
  note?: string | null
  is_active?: boolean | null
}

const tabs: { key: TabType; label: string }[] = [
  { key: 'brand', label: '브랜드코드' },
  { key: 'category', label: '카테고리코드' },
  { key: 'year', label: '연도코드' },
  { key: 'season', label: '시즌코드' },
]

function getTableName(tab: TabType) {
  if (tab === 'brand') return 'brand_codes'
  if (tab === 'category') return 'category_codes'
  if (tab === 'season') return 'season_codes'
  return 'year_codes'
}

function getNameColumn(tab: TabType) {
  if (tab === 'brand') return 'type'
  if (tab === 'category') return 'category_name'
  if (tab === 'season') return 'season_name'
  return 'year_label'
}

function getNoteColumn(tab: TabType) {
  if (tab === 'brand') return 'description'
  return 'note'
}

function normalizeRows(
  tab: TabType,
  rows: BrandCode[] | CategoryCode[] | SeasonCode[] | YearCode[]
): CodeRow[] {
  return rows.map((row: any) => ({
    id: row.id,
    sort_no: row.sort_no ?? 0,
    code: row.code || '',
    name:
      row.type ||
      row.category_name ||
      row.season_name ||
      row.year_label ||
      '',
    note: row.description || row.note || '',
    is_active: row.is_active ?? true,
  }))
}

export function ModelCodeManager() {
  const supabase = createClient()

  const [tab, setTab] = useState<TabType>('brand')

  const [brandCodes, setBrandCodes] = useState<BrandCode[]>([])
  const [categoryCodes, setCategoryCodes] = useState<CategoryCode[]>([])
  const [seasonCodes, setSeasonCodes] = useState<SeasonCode[]>([])
  const [yearCodes, setYearCodes] = useState<YearCode[]>([])

  const [form, setForm] = useState({
    sort_no: '',
    code: '',
    name: '',
    note: '',
    is_active: true,
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentRows = useMemo(() => {
    if (tab === 'brand') return normalizeRows(tab, brandCodes)
    if (tab === 'category') return normalizeRows(tab, categoryCodes)
    if (tab === 'season') return normalizeRows(tab, seasonCodes)
    return normalizeRows(tab, yearCodes)
  }, [tab, brandCodes, categoryCodes, seasonCodes, yearCodes])

  async function fetchAll() {
    const [brandRes, categoryRes, seasonRes, yearRes] = await Promise.all([
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
        .from('season_codes')
        .select('*')
        .order('sort_no', { ascending: true })
        .order('code', { ascending: true }),

      supabase
        .from('year_codes')
        .select('*')
        .order('sort_no', { ascending: true })
        .order('code', { ascending: true }),
    ])

    setBrandCodes((brandRes.data || []) as BrandCode[])
    setCategoryCodes((categoryRes.data || []) as CategoryCode[])
    setSeasonCodes((seasonRes.data || []) as SeasonCode[])
    setYearCodes((yearRes.data || []) as YearCode[])
  }

  function resetForm() {
    setEditingId(null)
    setForm({
      sort_no: '',
      code: '',
      name: '',
      note: '',
      is_active: true,
    })
  }

  function startEdit(row: CodeRow) {
    setEditingId(row.id)
    setForm({
      sort_no: String(row.sort_no ?? ''),
      code: row.code || '',
      name: row.name || '',
      note: row.note || '',
      is_active: row.is_active ?? true,
    })
  }

  async function handleSave() {
    if (!form.code.trim()) {
      alert('코드를 입력해 주세요.')
      return
    }

    setIsSaving(true)

    const tableName = getTableName(tab)
    const nameColumn = getNameColumn(tab)
    const noteColumn = getNoteColumn(tab)

    const payload = {
      sort_no: form.sort_no === '' ? 0 : Number(form.sort_no),
      code: form.code.trim(),
      [nameColumn]: form.name.trim() || null,
      [noteColumn]: form.note.trim() || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    }

    const result = editingId
      ? await supabase.from(tableName).update(payload).eq('id', editingId)
      : await supabase.from(tableName).insert(payload)

    setIsSaving(false)

    if (result.error) {
      alert(`저장 실패\n\n${result.error.message}`)
      return
    }

    resetForm()
    await fetchAll()
  }

  async function handleDelete(row: CodeRow) {
    const ok = window.confirm(
      `${row.code} 코드를 삭제할까요?\n이미 사용 중인 코드라면 삭제하지 않는 것을 권장합니다.`
    )

    if (!ok) return

    const { error } = await supabase
      .from(getTableName(tab))
      .delete()
      .eq('id', row.id)

    if (error) {
      alert(`삭제 실패\n\n${error.message}`)
      return
    }

    await fetchAll()
  }

  async function toggleActive(row: CodeRow) {
    const { error } = await supabase
      .from(getTableName(tab))
      .update({
        is_active: !(row.is_active ?? true),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (error) {
      alert(`사용여부 변경 실패\n\n${error.message}`)
      return
    }

    await fetchAll()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.key}
            type="button"
            variant={tab === item.key ? 'default' : 'outline'}
            onClick={() => {
              setTab(item.key)
              resetForm()
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-900">
            {tabs.find((item) => item.key === tab)?.label} 등록/수정
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            모델명 자동 생성을 위한 기준 코드를 관리합니다.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[100px_140px_1fr_1fr_120px]">
          <Input
            value={form.sort_no}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, sort_no: e.target.value }))
            }
            placeholder="NO"
            type="number"
          />

          <Input
            value={form.code}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                code: e.target.value.toUpperCase(),
              }))
            }
            placeholder="코드"
          />

          <Input
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder={
              tab === 'brand'
                ? '구분'
                : tab === 'category'
                  ? '카테고리명'
                  : tab === 'season'
                    ? '구분'
                    : '연도'
            }
          />

          <Input
            value={form.note}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, note: e.target.value }))
            }
            placeholder={tab === 'brand' ? '설명문' : '비고'}
          />

          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {editingId ? '수정 저장' : '추가'}
          </Button>
        </div>

        {editingId && (
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            className="mt-3"
          >
            수정 취소
          </Button>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">등록된 코드</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-3">NO</th>
                <th className="p-3">코드</th>
                <th className="p-3">
                  {tab === 'brand'
                    ? '구분'
                    : tab === 'category'
                      ? '카테고리명'
                      : tab === 'season'
                        ? '구분'
                        : '연도'}
                </th>
                <th className="p-3">{tab === 'brand' ? '설명문' : '비고'}</th>
                <th className="p-3">사용</th>
                <th className="p-3 text-right">관리</th>
              </tr>
            </thead>

            <tbody>
              {currentRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    등록된 코드가 없습니다.
                  </td>
                </tr>
              ) : (
                currentRows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="p-3">{row.sort_no ?? 0}</td>
                    <td className="p-3 font-bold">{row.code}</td>
                    <td className="p-3">{row.name || '-'}</td>
                    <td className="p-3">{row.note || '-'}</td>
                    <td className="p-3">
                      <Button
                        type="button"
                        size="sm"
                        variant={row.is_active ? 'default' : 'outline'}
                        onClick={() => toggleActive(row)}
                      >
                        {row.is_active ? '사용' : '미사용'}
                      </Button>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(row)}
                        >
                          수정
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(row)}
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
    </div>
  )
}