'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { PrintColumnHeader, PrintHeader } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

interface PrintHeaderManagerProps {
  initialHeaders: PrintHeader[]
  initialColumnHeaders: PrintColumnHeader[]
}

const HEADER_LABELS: Record<string, string> = {
  order: '발주서',
  inbound: '입고확인서',
}

export function PrintHeaderManager({
  initialHeaders,
initialColumnHeaders,
}: PrintHeaderManagerProps) {
  const [headers, setHeaders] = useState(initialHeaders)
  const [columnHeaders, setColumnHeaders] = useState(initialColumnHeaders)
  const [isSaving, setIsSaving] = useState(false)

  const updateLocalHeader = (
    id: string,
    patch: Partial<PrintHeader>
  ) => {
    setHeaders((prev) =>
      prev.map((header) =>
        header.id === id
          ? {
              ...header,
              ...patch,
            }
          : header
      )
    )
  }

  const saveHeader = async (header: PrintHeader) => {
    setIsSaving(true)

    const supabase = createClient()

    const { error } = await supabase
      .from('print_headers')
      .update({
        title: header.title || null,
        subtitle: header.subtitle || null,
        company_name: header.company_name || null,
        company_info: header.company_info || null,
        footer_memo: header.footer_memo || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', header.id)

    setIsSaving(false)

    if (error) {
      alert('저장에 실패했습니다.')
      return
    }

    alert('저장되었습니다.')
  }

    const updateLocalColumnHeader = (
    id: string,
    patch: Partial<PrintColumnHeader>
    ) => {
    setColumnHeaders((prev) =>
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

    const saveColumnHeader = async (item: PrintColumnHeader) => {
    setIsSaving(true)

    const supabase = createClient()

    const { error } = await supabase
        .from('print_column_headers')
        .update({
        column_label: item.column_label || '',
        updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

    setIsSaving(false)

    if (error) {
        alert('컬럼명 저장에 실패했습니다.')
        return
    }

    alert('컬럼명이 저장되었습니다.')
    }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">
            출력 헤더 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            발주서와 입고확인서 인쇄 시 표시될 헤더 문구를 관리합니다.
          </p>
        </section>

        <section className="grid gap-4">
          {headers.map((header) => (
            <Card key={header.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500">문서 구분</p>
                    <h2 className="text-xl font-bold text-gray-900">
                      {HEADER_LABELS[header.type] || header.type}
                    </h2>
                  </div>

                  <Button
                    onClick={() => saveHeader(header)}
                    disabled={isSaving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    저장
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      제목
                    </label>
                    <Input
                      value={header.title || ''}
                      onChange={(e) =>
                        updateLocalHeader(header.id, {
                          title: e.target.value,
                        })
                      }
                      placeholder="예: 발 주 서"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      부제목 / 번역명
                    </label>
                    <Input
                      value={header.subtitle || ''}
                      onChange={(e) =>
                        updateLocalHeader(header.id, {
                          subtitle: e.target.value,
                        })
                      }
                      placeholder="예: PURCHASE ORDER / 采购单"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      회사명
                    </label>
                    <Input
                      value={header.company_name || ''}
                      onChange={(e) =>
                        updateLocalHeader(header.id, {
                          company_name: e.target.value,
                        })
                      }
                      placeholder="회사명"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      회사정보
                    </label>
                    <Input
                      value={header.company_info || ''}
                      onChange={(e) =>
                        updateLocalHeader(header.id, {
                          company_info: e.target.value,
                        })
                      }
                      placeholder="주소 / 연락처 / 담당자 등"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    하단 메모
                  </label>
                  <Input
                    value={header.footer_memo || ''}
                    onChange={(e) =>
                      updateLocalHeader(header.id, {
                        footer_memo: e.target.value,
                      })
                    }
                    placeholder="예: 수량 및 색상 확인 후 회신 바랍니다."
                  />
                </div>

                <div className="rounded-2xl border bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">미리보기</p>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold tracking-wide text-gray-900">
                        {header.title || '-'}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {header.subtitle || '-'}
                      </p>
                    </div>

                    <div className="text-right text-sm">
                      <p className="font-semibold text-gray-900">
                        {header.company_name || '-'}
                      </p>
                      <p className="mt-1 text-gray-500">
                        {header.company_info || '-'}
                      </p>
                    </div>
                  </div>

                  {header.footer_memo && (
                    <p className="mt-3 text-sm text-gray-500">
                      {header.footer_memo}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
        
        <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">
            표 컬럼명 관리
        </h2>

        {(['order', 'inbound'] as const).map((type) => {
            const items = columnHeaders.filter((item) => item.type === type)

            return (
            <Card key={type}>
                <CardContent className="space-y-4 p-5">
                <div>
                    <p className="text-sm text-gray-500">문서 구분</p>
                    <h3 className="text-lg font-bold text-gray-900">
                    {HEADER_LABELS[type]}
                    </h3>
                </div>

                <div className="space-y-3">
                    {items.map((item) => (
                    <div
                        key={item.id}
                        className="grid gap-3 sm:grid-cols-[160px_1fr_auto]"
                    >
                        <div className="flex items-center rounded-md bg-gray-50 px-3 text-sm font-medium text-gray-600">
                        {item.column_key}
                        </div>

                        <Input
                        value={item.column_label}
                        onChange={(e) =>
                            updateLocalColumnHeader(item.id, {
                            column_label: e.target.value,
                            })
                        }
                        placeholder="표시할 컬럼명"
                        />

                        <Button
                        variant="outline"
                        onClick={() => saveColumnHeader(item)}
                        disabled={isSaving}
                        >
                        <Save className="mr-2 h-4 w-4" />
                        저장
                        </Button>
                    </div>
                    ))}
                </div>
                </CardContent>
            </Card>
            )
        })}
        </section>        
      </div>
    </main>
  )
}