'use client'

import { useState, useMemo } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ModelCode, ModelCodeType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ModelCodeManagerProps {
  initialModelCodes: ModelCode[]
}

const CODE_TYPES: { value: ModelCodeType; label: string }[] = [
  { value: 'brand', label: '브랜드 코드' },
  { value: 'category', label: '카테고리 코드' },
  { value: 'year', label: '연도 코드' },
  { value: 'season', label: '시즌 코드' },
]

export function ModelCodeManager({
  initialModelCodes,
}: ModelCodeManagerProps) {
  const [modelCodes, setModelCodes] = useState(initialModelCodes)
  const [newCodeType, setNewCodeType] = useState<ModelCodeType>('brand')
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const groupedCodes = useMemo(() => {
    const grouped: Record<ModelCodeType, ModelCode[]> = {
      brand: [],
      category: [],
      year: [],
      season: [],
    }

    modelCodes.forEach((code) => {
      grouped[code.code_type].push(code)
    })

    Object.keys(grouped).forEach((key) => {
      grouped[key as ModelCodeType].sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
      )
    })

    return grouped
  }, [modelCodes])

  const addModelCode = async () => {
    const code = newCode.trim()
    const name = newName.trim()

    if (!code) {
      alert('코드를 입력해 주세요.')
      return
    }

    if (!name) {
      alert('코드명을 입력해 주세요.')
      return
    }

    if (
      modelCodes.some(
        (item) => item.code_type === newCodeType && item.code === code
      )
    ) {
      alert('이미 등록된 코드입니다.')
      return
    }

    setIsSaving(true)

    const supabase = createClient()

    const allCodesOfType = modelCodes.filter(
      (c) => c.code_type === newCodeType
    )

    const { data, error } = await supabase
      .from('model_codes')
      .insert({
        code_type: newCodeType,
        code,
        name,
        sort_order: allCodesOfType.length + 1,
        is_active: true,
      })
      .select('*')
      .single()

    setIsSaving(false)

    if (error) {
      alert('코드 추가에 실패했습니다.')
      console.error(error)
      return
    }

    setModelCodes((prev) => [...prev, data])
    setNewCode('')
    setNewName('')
  }

  const updateModelCode = async (modelCode: ModelCode) => {
    setIsSaving(true)

    const supabase = createClient()

    const { error } = await supabase
      .from('model_codes')
      .update({
        code: modelCode.code,
        name: modelCode.name,
        sort_order: modelCode.sort_order || 0,
        is_active: modelCode.is_active ?? true,
      })
      .eq('id', modelCode.id)

    setIsSaving(false)

    if (error) {
      alert('저장에 실패했습니다.')
      console.error(error)
      return
    }

    alert('저장되었습니다.')
  }

  const deleteModelCode = async (id: string) => {
    const ok = window.confirm('이 코드를 삭제할까요?')
    if (!ok) return

    const supabase = createClient()

    const { error } = await supabase.from('model_codes').delete().eq('id', id)

    if (error) {
      alert('삭제에 실패했습니다.')
      console.error(error)
      return
    }

    setModelCodes((prev) => prev.filter((item) => item.id !== id))
  }

  const updateLocalCode = (id: string, patch: Partial<ModelCode>) => {
    setModelCodes((prev) =>
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
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold text-gray-900">새 코드 추가</h2>

          <div className="grid gap-3 sm:grid-cols-[150px_120px_2fr_auto]">
            <Select value={newCodeType} onValueChange={(value) => setNewCodeType(value as ModelCodeType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CODE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="예: 01"
            />

            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 화이트"
            />

            <Button onClick={addModelCode} disabled={isSaving}>
              <Plus className="mr-2 h-4 w-4" />
              추가
            </Button>
          </div>
        </CardContent>
      </Card>

      {CODE_TYPES.map((type) => (
        <section key={type.value} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{type.label}</h2>

          {groupedCodes[type.value].length === 0 ? (
            <p className="text-sm text-gray-500">등록된 코드가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {groupedCodes[type.value].map((modelCode) => (
                <Card key={modelCode.id}>
                  <CardContent className="p-4">
                    <div className="grid gap-3 sm:grid-cols-[100px_2fr_100px_auto_auto]">
                      <Input
                        value={modelCode.code || ''}
                        onChange={(e) =>
                          updateLocalCode(modelCode.id, {
                            code: e.target.value,
                          })
                        }
                        placeholder="코드"
                      />

                      <Input
                        value={modelCode.name || ''}
                        onChange={(e) =>
                          updateLocalCode(modelCode.id, {
                            name: e.target.value,
                          })
                        }
                        placeholder="코드명"
                      />

                      <Input
                        type="number"
                        value={modelCode.sort_order || 0}
                        onChange={(e) =>
                          updateLocalCode(modelCode.id, {
                            sort_order: Number(e.target.value || 0),
                          })
                        }
                        placeholder="정렬"
                      />

                      <Button
                        variant="outline"
                        onClick={() => updateModelCode(modelCode)}
                        disabled={isSaving}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        저장
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => deleteModelCode(modelCode.id)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
