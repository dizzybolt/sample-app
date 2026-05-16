'use client'

import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SizeGroup } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

interface SizeGroupManagerProps {
  initialSizeGroups: SizeGroup[]
}

export function SizeGroupManager({ initialSizeGroups }: SizeGroupManagerProps) {
  const [sizeGroups, setSizeGroups] = useState(initialSizeGroups)
  const [newName, setNewName] = useState('')
  const [newSizes, setNewSizes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const addSizeGroup = async () => {
    if (!newName.trim()) {
      alert('사이즈 구분명을 입력해 주세요.')
      return
    }

    const exists = sizeGroups.some(
    (group) => group.name.trim() === newName.trim()
    )

    if (exists) {
    alert('이미 등록된 사이즈 구분명입니다.')
    return
    }

    const sizes = newSizes
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (sizes.length === 0) {
      alert('사이즈를 입력해 주세요. 예: 90,95,100,105')
      return
    }

    setIsSaving(true)

    const supabase = createClient()

    const { data, error } = await supabase
      .from('size_groups')
      .insert({
        name: newName.trim(),
        sizes,
        sort_order: sizeGroups.length + 1,
        is_active: true,
      })
      .select('*')
      .single()

    setIsSaving(false)

    if (error) {
      alert('사이즈 구분 추가에 실패했습니다.')
      return
    }

    setSizeGroups((prev) => [...prev, data])
    setNewName('')
    setNewSizes('')
  }

  const updateSizeGroup = async (group: SizeGroup) => {
    setIsSaving(true)

    const supabase = createClient()

    const { error } = await supabase
      .from('size_groups')
      .update({
        name: group.name,
        sizes: group.sizes,
        sort_order: group.sort_order || 0,
        is_active: group.is_active ?? true,
      })
      .eq('id', group.id)

    setIsSaving(false)

    if (error) {
      alert('저장에 실패했습니다.')
      return
    }

    alert('저장되었습니다.')
  }

  const deleteSizeGroup = async (id: string) => {
    const ok = window.confirm('이 사이즈 구분을 삭제할까요?')
    if (!ok) return

    const supabase = createClient()

    const { error } = await supabase.from('size_groups').delete().eq('id', id)

    if (error) {
      alert('삭제에 실패했습니다.')
      return
    }

    setSizeGroups((prev) => prev.filter((group) => group.id !== id))
  }

  const updateLocalGroup = (
    id: string,
    patch: Partial<SizeGroup>
  ) => {
    setSizeGroups((prev) =>
      prev.map((group) =>
        group.id === id
          ? {
              ...group,
              ...patch,
            }
          : group
      )
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">사이즈표 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            발주서와 입고 상세에서 사용할 사이즈 구분을 관리합니다.
          </p>
        </section>

        <Card>
        <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold text-gray-900">현재 등록된 사이즈표</h2>

            {sizeGroups.length === 0 ? (
            <p className="text-sm text-gray-500">
                등록된 사이즈표가 없습니다.
            </p>
            ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sizeGroups.map((group) => (
                <div
                    key={group.id}
                    className="rounded-2xl border bg-gray-50 p-3"
                >
                    <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">{group.name}</p>
                    <span className="text-xs text-gray-500">
                        {group.sizes?.length || 0}개
                    </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                    {(group.sizes || []).map((size) => (
                        <span
                        key={size}
                        className="rounded-full bg-white px-2 py-1 text-xs text-gray-700"
                        >
                        {size}
                        </span>
                    ))}
                    </div>
                </div>
                ))}
            </div>
            )}
        </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold text-gray-900">새 사이즈 구분 추가</h2>

            <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 여성상의"
              />

              <Input
                value={newSizes}
                onChange={(e) => setNewSizes(e.target.value)}
                placeholder="예: 90,95,100,105"
              />

              <Button onClick={addSizeGroup} disabled={isSaving}>
                <Plus className="mr-2 h-4 w-4" />
                추가
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          {sizeGroups.map((group) => (
            <Card key={group.id}>
              <CardContent className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_2fr_100px_auto_auto]">
                  <Input
                    value={group.name}
                    onChange={(e) =>
                      updateLocalGroup(group.id, {
                        name: e.target.value,
                      })
                    }
                    placeholder="사이즈 구분명"
                  />

                  <Input
                    value={(group.sizes || []).join(',')}
                    onChange={(e) =>
                      updateLocalGroup(group.id, {
                        sizes: e.target.value
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="사이즈 목록"
                  />

                  <Input
                    type="number"
                    value={group.sort_order || 0}
                    onChange={(e) =>
                      updateLocalGroup(group.id, {
                        sort_order: Number(e.target.value || 0),
                      })
                    }
                    placeholder="정렬"
                  />

                  <Button
                    variant="outline"
                    onClick={() => updateSizeGroup(group)}
                    disabled={isSaving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    저장
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => deleteSizeGroup(group.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    삭제
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(group.sizes || []).map((size) => (
                    <span
                      key={size}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      {size}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  )
}