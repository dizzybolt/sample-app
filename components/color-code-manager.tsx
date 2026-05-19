'use client'

import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ColorCode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

interface ColorCodeManagerProps {
  initialColorCodes: ColorCode[]
}

export function ColorCodeManager({ initialColorCodes }: ColorCodeManagerProps) {
  const [colorCodes, setColorCodes] = useState(initialColorCodes)
  const [newColorCode, setNewColorCode] = useState('')
  const [newColorName, setNewColorName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const addColorCode = async () => {
    const colorCode = newColorCode.trim()
    const colorName = newColorName.trim()

    if (!colorCode) {
      alert('컬러코드를 입력해 주세요.')
      return
    }

    if (!colorName) {
      alert('컬러명을 입력해 주세요.')
      return
    }

    if (colorCodes.some((item) => item.color_code === colorCode)) {
      alert('이미 등록된 컬러코드입니다.')
      return
    }

    setIsSaving(true)

    const supabase = createClient()

    const { data, error } = await supabase
      .from('color_codes')
      .insert({
        color_code: colorCode,
        color_name: colorName,
        sort_order: colorCodes.length + 1,
        is_active: true,
      })
      .select('*')
      .single()

    setIsSaving(false)

    if (error) {
      alert('컬러 추가에 실패했습니다.')
      return
    }

    setColorCodes((prev) => [...prev, data])
    setNewColorCode('')
    setNewColorName('')
  }

  const updateColorCode = async (color: ColorCode) => {
    setIsSaving(true)

    const supabase = createClient()

    const { error } = await supabase
      .from('color_codes')
      .update({
        color_code: color.color_code,
        color_name: color.color_name,
        sort_order: color.sort_order || 0,
        is_active: color.is_active ?? true,
      })
      .eq('id', color.id)

    setIsSaving(false)

    if (error) {
      alert('저장에 실패했습니다.')
      return
    }

    alert('저장되었습니다.')
  }

  const deleteColorCode = async (id: string) => {
    const ok = window.confirm('이 컬러를 삭제할까요?')
    if (!ok) return

    const supabase = createClient()

    const { error } = await supabase.from('color_codes').delete().eq('id', id)

    if (error) {
      alert('삭제에 실패했습니다.')
      return
    }

    setColorCodes((prev) => prev.filter((item) => item.id !== id))
  }

  const updateLocalColor = (id: string, patch: Partial<ColorCode>) => {
    setColorCodes((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">컬러표 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            샘플 등록에서 사용할 컬러코드와 컬러명을 관리합니다.
          </p>
        </section>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold text-gray-900">새 컬러 추가</h2>

            <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <Input
                value={newColorCode}
                onChange={(e) => setNewColorCode(e.target.value)}
                placeholder="예: 01"
              />

              <Input
                value={newColorName}
                onChange={(e) => setNewColorName(e.target.value)}
                placeholder="예: 블랙"
              />

              <Button onClick={addColorCode} disabled={isSaving}>
                <Plus className="mr-2 h-4 w-4" />
                추가
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          {colorCodes.map((color) => (
            <Card key={color.id}>
              <CardContent className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-[120px_1fr_100px_auto_auto]">
                  <Input
                    value={color.color_code || ''}
                    onChange={(e) =>
                      updateLocalColor(color.id, {
                        color_code: e.target.value,
                      })
                    }
                    placeholder="컬러코드"
                  />

                  <Input
                    value={color.color_name || ''}
                    onChange={(e) =>
                      updateLocalColor(color.id, {
                        color_name: e.target.value,
                      })
                    }
                    placeholder="컬러명"
                  />

                  <Input
                    type="number"
                    value={color.sort_order || 0}
                    onChange={(e) =>
                      updateLocalColor(color.id, {
                        sort_order: Number(e.target.value || 0),
                      })
                    }
                    placeholder="정렬"
                  />

                  <Button
                    variant="outline"
                    onClick={() => updateColorCode(color)}
                    disabled={isSaving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    저장
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => deleteColorCode(color.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    삭제
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id={`active-${color.id}`}
                    type="checkbox"
                    checked={color.is_active ?? true}
                    onChange={(e) =>
                      updateLocalColor(color.id, {
                        is_active: e.target.checked,
                      })
                    }
                  />

                  <label
                    htmlFor={`active-${color.id}`}
                    className="text-sm text-gray-600"
                  >
                    사용
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  )
}