'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BrandCode,
  CategoryCode,
  SeasonCode,
  YearCode,
} from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type TabType =
  | 'brand'
  | 'category'
  | 'season'
  | 'year'

export function ModelCodeManager() {
  const [tab, setTab] = useState<TabType>('brand')

  const [brandCodes, setBrandCodes] = useState<BrandCode[]>([])
  const [categoryCodes, setCategoryCodes] = useState<CategoryCode[]>([])
  const [seasonCodes, setSeasonCodes] = useState<SeasonCode[]>([])
  const [yearCodes, setYearCodes] = useState<YearCode[]>([])

  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const supabase = createClient()
    const [
      brandRes,
      categoryRes,
      seasonRes,
      yearRes,
    ] = await Promise.all([
      supabase
        .from('brand_codes')
        .select('*')
        .order('sort_no'),

      supabase
        .from('category_codes')
        .select('*')
        .order('sort_no'),

      supabase
        .from('season_codes')
        .select('*')
        .order('sort_no'),

      supabase
        .from('year_codes')
        .select('*')
        .order('sort_no'),
    ])

    setBrandCodes((brandRes.data || []) as BrandCode[])
    setCategoryCodes(
      (categoryRes.data || []) as CategoryCode[]
    )
    setSeasonCodes(
      (seasonRes.data || []) as SeasonCode[]
    )
    setYearCodes((yearRes.data || []) as YearCode[])
  }

  async function addCode() {
    const supabase = createClient()
    if (!newCode.trim()) return

    if (tab === 'brand') {
      await supabase.from('brand_codes').insert({
        code: newCode,
        type: newName,
      })
    }

    if (tab === 'category') {
      await supabase.from('category_codes').insert({
        code: newCode,
        category_name: newName,
      })
    }

    if (tab === 'season') {
      await supabase.from('season_codes').insert({
        code: newCode,
        season_name: newName,
      })
    }

    if (tab === 'year') {
      await supabase.from('year_codes').insert({
        code: newCode,
        year_label: newName,
      })
    }

    setNewCode('')
    setNewName('')

    fetchAll()
  }

  async function deleteCode(
    table: string,
    id: string
  ) {
    const supabase = createClient()
    await supabase.from(table).delete().eq('id', id)

    fetchAll()
  }

  const currentList =
    tab === 'brand'
      ? brandCodes
      : tab === 'category'
        ? categoryCodes
        : tab === 'season'
          ? seasonCodes
          : yearCodes

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === 'brand' ? 'default' : 'outline'}
          onClick={() => setTab('brand')}
        >
          브랜드코드
        </Button>

        <Button
          variant={
            tab === 'category'
              ? 'default'
              : 'outline'
          }
          onClick={() => setTab('category')}
        >
          카테고리코드
        </Button>

        <Button
          variant={
            tab === 'season'
              ? 'default'
              : 'outline'
          }
          onClick={() => setTab('season')}
        >
          시즌코드
        </Button>

        <Button
          variant={tab === 'year' ? 'default' : 'outline'}
          onClick={() => setTab('year')}
        >
          연도코드
        </Button>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={newCode}
            onChange={(e) =>
              setNewCode(e.target.value)
            }
            placeholder="코드"
          />

          <Input
            value={newName}
            onChange={(e) =>
              setNewName(e.target.value)
            }
            placeholder="이름 / 설명"
          />

          <Button onClick={addCode}>
            추가
          </Button>
        </div>

        <div className="mt-5 space-y-2">
          {currentList.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border p-3"
            >
              <div>
                <p className="font-semibold">
                  {item.code}
                </p>

                <p className="text-sm text-gray-500">
                  {item.type ||
                    item.category_name ||
                    item.season_name ||
                    item.year_label}
                </p>
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  deleteCode(
                    tab === 'brand'
                      ? 'brand_codes'
                      : tab === 'category'
                        ? 'category_codes'
                        : tab === 'season'
                          ? 'season_codes'
                          : 'year_codes',
                    item.id
                  )
                }
              >
                삭제
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}