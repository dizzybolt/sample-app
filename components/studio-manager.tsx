'use client'

import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Studio } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

interface StudioManagerProps {
  initialStudios: Studio[]
}

export function StudioManager({ initialStudios }: StudioManagerProps) {
  const [studios, setStudios] = useState(initialStudios)
  const [newName, setNewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const addStudio = async () => {
    const name = newName.trim()

    if (!name) {
      alert('스튜디오명을 입력해 주세요.')
      return
    }

    if (studios.some((studio) => studio.name === name)) {
      alert('이미 등록된 스튜디오입니다.')
      return
    }

    setIsSaving(true)

    const supabase = createClient()

    const { data, error } = await supabase
      .from('studios')
      .insert({
        name,
        sort_order: studios.length + 1,
        is_active: true,
      })
      .select('*')
      .single()

    setIsSaving(false)

    if (error) {
      alert('스튜디오 추가에 실패했습니다.')
      return
    }

    setStudios((prev) => [...prev, data])
    setNewName('')
  }

  const updateStudio = async (studio: Studio) => {
    setIsSaving(true)

    const supabase = createClient()

    const { error } = await supabase
      .from('studios')
      .update({
        name: studio.name,
        manager_name: studio.manager_name || null,
        phone: studio.phone || null,
        memo: studio.memo || null,
        sort_order: studio.sort_order || 0,
        is_active: studio.is_active ?? true,
      })
      .eq('id', studio.id)

    setIsSaving(false)

    if (error) {
      alert('저장에 실패했습니다.')
      return
    }

    alert('저장되었습니다.')
  }

  const deleteStudio = async (id: string) => {
    const ok = window.confirm('이 스튜디오를 삭제할까요?')
    if (!ok) return

    const supabase = createClient()

    const { error } = await supabase.from('studios').delete().eq('id', id)

    if (error) {
      alert('삭제에 실패했습니다.')
      return
    }

    setStudios((prev) => prev.filter((studio) => studio.id !== id))
  }

  const updateLocalStudio = (id: string, patch: Partial<Studio>) => {
    setStudios((prev) =>
      prev.map((studio) =>
        studio.id === id
          ? {
              ...studio,
              ...patch,
            }
          : studio
      )
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">스튜디오 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            아이템카드에서 사용할 촬영 스튜디오 목록을 관리합니다.
          </p>
        </section>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold text-gray-900">현재 등록된 스튜디오</h2>

            {studios.length === 0 ? (
              <p className="text-sm text-gray-500">
                등록된 스튜디오가 없습니다.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {studios.map((studio) => (
                  <div key={studio.id} className="rounded-2xl border bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">{studio.name}</p>
                      <span className="text-xs text-gray-500">
                        {studio.is_active === false ? '비활성' : '사용중'}
                      </span>
                    </div>

                    {studio.manager_name && (
                      <p className="mt-1 text-xs text-gray-500">
                        담당자: {studio.manager_name}
                      </p>
                    )}

                    {studio.phone && (
                      <p className="mt-1 text-xs text-gray-500">
                        연락처: {studio.phone}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold text-gray-900">새 스튜디오 추가</h2>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: A스튜디오"
              />

              <Button onClick={addStudio} disabled={isSaving}>
                <Plus className="mr-2 h-4 w-4" />
                추가
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          {studios.map((studio) => (
            <Card key={studio.id}>
              <CardContent className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_80px_auto_auto]">
                  <Input
                    value={studio.name}
                    onChange={(e) =>
                      updateLocalStudio(studio.id, { name: e.target.value })
                    }
                    placeholder="스튜디오명"
                  />

                  <Input
                    value={studio.manager_name || ''}
                    onChange={(e) =>
                      updateLocalStudio(studio.id, {
                        manager_name: e.target.value,
                      })
                    }
                    placeholder="담당자"
                  />

                  <Input
                    value={studio.phone || ''}
                    onChange={(e) =>
                      updateLocalStudio(studio.id, { phone: e.target.value })
                    }
                    placeholder="연락처"
                  />

                  <Input
                    type="number"
                    value={studio.sort_order || 0}
                    onChange={(e) =>
                      updateLocalStudio(studio.id, {
                        sort_order: Number(e.target.value || 0),
                      })
                    }
                    placeholder="정렬"
                  />

                  <Button
                    variant="outline"
                    onClick={() => updateStudio(studio)}
                    disabled={isSaving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    저장
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => deleteStudio(studio.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    삭제
                  </Button>
                </div>

                <Input
                  value={studio.memo || ''}
                  onChange={(e) =>
                    updateLocalStudio(studio.id, { memo: e.target.value })
                  }
                  placeholder="메모"
                />
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  )
}