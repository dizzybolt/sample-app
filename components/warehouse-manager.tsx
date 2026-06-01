'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Warehouse } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function WarehouseManager() {
  const supabase = createClient()

  const [warehouses, setWarehouses] = useState<
    Warehouse[]
  >([])

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchWarehouses()
  }, [])

  async function fetchWarehouses() {
    const { data } = await supabase
      .from('warehouses')
      .select('*')
      .order('name', { ascending: true })

    setWarehouses((data || []) as Warehouse[])
  }

  async function handleCreateWarehouse() {
    if (!name.trim()) {
      alert('창고명을 입력해 주세요.')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('warehouses')
      .insert({
        name: name.trim(),
        code: code.trim() || null,
        note: note.trim() || null,
        is_active: true,
      })

    setLoading(false)

    if (error) {
      alert(`창고 등록 실패\n\n${error.message}`)
      return
    }

    setName('')
    setCode('')
    setNote('')

    await fetchWarehouses()
  }

  async function handleDeleteWarehouse(id: string) {
    const ok = window.confirm(
      '창고를 삭제할까요?'
    )

    if (!ok) return

    const { error } = await supabase
      .from('warehouses')
      .delete()
      .eq('id', id)

    if (error) {
      alert(`삭제 실패\n\n${error.message}`)
      return
    }

    await fetchWarehouses()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">
          창고 등록
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            placeholder="창고명"
          />

          <Input
            value={code}
            onChange={(e) =>
              setCode(e.target.value)
            }
            placeholder="창고코드"
          />

          <Input
            value={note}
            onChange={(e) =>
              setNote(e.target.value)
            }
            placeholder="비고"
          />
        </div>

        <Button
          type="button"
          className="mt-4"
          disabled={loading}
          onClick={handleCreateWarehouse}
        >
          창고 등록
        </Button>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">
          등록된 창고
        </h2>

        <div className="mt-4 space-y-2">
          {warehouses.length === 0 ? (
            <p className="text-sm text-gray-500">
              등록된 창고가 없습니다.
            </p>
          ) : (
            warehouses.map((warehouse) => (
              <div
                key={warehouse.id}
                className="relative rounded-xl border p-4"
              >
                <button
                  type="button"
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border text-sm text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                  onClick={() =>
                    handleDeleteWarehouse(
                      warehouse.id
                    )
                  }
                >
                  ✕
                </button>

                <p className="font-bold text-gray-900">
                  {warehouse.name}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {warehouse.code || '-'}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  {warehouse.note || '-'}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}