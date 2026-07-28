'use client'

import * as XLSX from 'xlsx'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProductImage } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListPagination } from '@/components/list-pagination'
import { batchUpsert, type BulkProgress } from '@/lib/bulk-upload'
import { OpsDataFreshness } from '@/components/ops-data-freshness'

const pageSize = 50

export function ProductImageManager() {
  const supabase = createClient()

  const [images, setImages] = useState<ProductImage[]>([])

  const [modelName, setModelName] = useState('')
  const [colorCode, setColorCode] = useState('')
  const [imageScope, setImageScope] = useState<'MODEL' | 'COLOR'>('MODEL')
  const [imageUrl, setImageUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [ftpPath, setFtpPath] = useState('')
  const [memo, setMemo] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [isSaving, setIsSaving] = useState(false)
  
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<BulkProgress | null>(null)

  useEffect(() => {
    searchImages()
  }, [currentPage])

  async function searchImages() {
    let query = supabase
      .from('product_images')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(
        (currentPage - 1) * pageSize,
        currentPage * pageSize - 1
      )

    const keyword = searchTerm.trim()

    if (keyword) {
      query = query.or(
        `model_name.ilike.%${keyword}%,image_url.ilike.%${keyword}%`
      )
    }

    const { data, error, count } = await query

    if (error) {
      alert(`이미지 조회 실패\n\n${error.message}`)
      return
    }

    setImages((data || []) as ProductImage[])
    setTotalCount(count || 0)
  }

  function resetForm() {
    setEditingId(null)

    setModelName('')
    setColorCode('')
    setImageScope('MODEL')
    setImageUrl('')
    setFileName('')
    setFtpPath('')
    setMemo('')
  }

  function handleEdit(item: ProductImage) {
    setEditingId(item.id)

    setModelName(item.model_name || '')
    setColorCode(item.color_code || '')
    setImageScope(item.image_scope || 'MODEL')
    setImageUrl(item.image_url || '')
    setFileName(item.file_name || '')
    setFtpPath(item.ftp_path || '')
    setMemo(item.memo || '')
  }

  async function handleSave() {
    if (!modelName.trim()) {
      alert('모델명을 입력해 주세요.')
      return
    }

    if (!imageUrl.trim()) {
      alert('URL을 입력해 주세요.')
      return
    }

    const normalizedModelName = modelName.trim().toUpperCase()
    const normalizedColorCode = colorCode.trim().padStart(2, '0')

    if (imageScope === 'COLOR' && !/^\d{2}$/.test(normalizedColorCode)) {
      alert('컬러 이미지는 두 자리 컬러코드를 입력해 주세요.')
      return
    }

    setIsSaving(true)

    const payload = {
      model_name: normalizedModelName,
      color_code: imageScope === 'COLOR' ? normalizedColorCode : null,
      image_key:
        imageScope === 'COLOR'
          ? `${normalizedModelName}_${normalizedColorCode}`
          : normalizedModelName,
      image_scope: imageScope,
      image_size: 1000,
      image_url: imageUrl.trim(),

      file_name: fileName.trim() || null,
      ftp_path: ftpPath.trim() || null,
      memo: memo.trim() || null,

      is_active: true,
      updated_at: new Date().toISOString(),
    }

    const result = editingId
      ? await supabase
          .from('product_images')
          .update(payload)
          .eq('id', editingId)
      : await supabase
          .from('product_images')
          .insert(payload)

    setIsSaving(false)

    if (result.error) {
      alert(`저장 실패\n\n${result.error.message}`)
      return
    }

    alert(editingId ? '수정되었습니다.' : '등록되었습니다.')

    resetForm()
    await searchImages()
  }

  async function handleDelete(item: ProductImage) {
    const ok = window.confirm(
      `${item.model_name} 이미지를 삭제할까요?`
    )

    if (!ok) return

    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', item.id)

    if (error) {
      alert(`삭제 실패\n\n${error.message}`)
      return
    }

    await searchImages()
  }

async function handleUploadExcel(file: File) {
  const buffer = await file.arrayBuffer()

  const workbook = XLSX.read(buffer, {
    type: 'array',
  })

  const worksheet = workbook.Sheets[workbook.SheetNames[0]]

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: '',
  })

  if (rows.length === 0) {
    alert('업로드할 데이터가 없습니다.')
    return
  }

  const uploadRows = rows
    .map((row) => {
      const modelName = String(row.모델명 || row.model_name || '').trim()
      const imageUrl = String(row.URL || row.image_url || '').trim()
      const colorCode = String(row.컬러코드 || row.color_code || '').trim()
      const imageScope = String(
        row.이미지구분 || row.image_scope || (colorCode ? 'COLOR' : 'MODEL')
      ).toUpperCase()
      const fileName = String(row.파일명 || row.file_name || '').trim()
      const ftpPath = String(row.FTP경로 || row.ftp_path || '').trim()
      const memo = String(row.비고 || row.memo || '').trim()

      if (
        !modelName ||
        !imageUrl ||
        !['MODEL', 'COLOR'].includes(imageScope) ||
        (imageScope === 'COLOR' && !/^\d{2}$/.test(colorCode))
      ) {
        return null
      }

      return {
        model_name: modelName.toUpperCase(),
        color_code: imageScope === 'COLOR' ? colorCode : null,
        image_key:
          imageScope === 'COLOR'
            ? `${modelName.toUpperCase()}_${colorCode}`
            : modelName.toUpperCase(),
        image_scope: imageScope,
        image_size: 1000,
        image_url: imageUrl,
        file_name: fileName || null,
        ftp_path: ftpPath || null,
        memo: memo || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }
    })
    .filter(Boolean)

      const uniqueRows = Array.from(
        new Map(
          uploadRows.map((row) => [row!.ftp_path || row!.image_url, row])
        ).values()
      )

  if (uploadRows.length === 0) {
    alert('업로드 가능한 데이터가 없습니다.')
    return
  }

  setUploading(true)
  setIsSaving(true)
  setUploadProgress({
    total: uniqueRows.length,
    processed: 0,
    success: 0,
    fail: 0,
    percent: 0,
  })

  const result = await batchUpsert({
    supabase,
    tableName: 'product_images',
    rows: uniqueRows,
    onConflict: 'ftp_path',
    chunkSize: 500,
    onProgress: setUploadProgress,
  })

  setUploading(false)
  setIsSaving(false)

    alert(
    `업로드 완료\n\n성공 ${result.success.toLocaleString()}건\n실패 ${result.fail.toLocaleString()}건${
        result.errors.length
        ? `\n\n오류 예시:\n${result.errors.slice(0, 3).join('\n')}`
        : ''
    }`
    )

  await searchImages()
}

  function downloadExcel() {
    const rows = images.map((item) => ({
      모델명: item.model_name,
      컬러코드: item.color_code || '',
      이미지구분: item.image_scope,
      이미지키: item.image_key,
      URL: item.image_url,
      파일명: item.file_name || '',
      FTP경로: item.ftp_path || '',
      비고: item.memo || '',
    }))

    const worksheet =
      XLSX.utils.json_to_sheet(rows)

    const workbook =
      XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      '이미지목록'
    )

    XLSX.writeFile(
      workbook,
      '이미지목록.xlsx'
    )
  }

  const totalPage = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(totalCount / pageSize)
      ),
    [totalCount]
  )

  return (
    <div className="space-y-6">

      <section className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <h1 className="text-2xl font-bold">이미지관리</h1>
        <OpsDataFreshness sources={['images']} />
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">

        <h2 className="font-semibold">
          등록 / 수정
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-7">

          <Input
            value={modelName}
            onChange={(e) =>
              setModelName(e.target.value)
            }
            placeholder="모델명"
          />

          <select
            value={imageScope}
            onChange={(event) => {
              const nextScope = event.target.value as 'MODEL' | 'COLOR'
              setImageScope(nextScope)
              if (nextScope === 'MODEL') setColorCode('')
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="MODEL">모델 이미지</option>
            <option value="COLOR">컬러 이미지</option>
          </select>

          <Input
            value={colorCode}
            onChange={(event) => setColorCode(event.target.value)}
            placeholder="컬러코드(00)"
            maxLength={2}
            disabled={imageScope === 'MODEL'}
          />

          <Input
            value={imageUrl}
            onChange={(e) =>
              setImageUrl(e.target.value)
            }
            placeholder="URL"
          />

          <Input
            value={fileName}
            onChange={(e) =>
              setFileName(e.target.value)
            }
            placeholder="파일명"
          />

          <Input
            value={ftpPath}
            onChange={(e) =>
              setFtpPath(e.target.value)
            }
            placeholder="FTP경로"
          />

          <Input
            value={memo}
            onChange={(e) =>
              setMemo(e.target.value)
            }
            placeholder="비고"
          />
        </div>

        <div className="mt-4 flex gap-2">

          <Button
            disabled={isSaving}
            onClick={handleSave}
          >
            저장
          </Button>

          {editingId && (
            <Button
              variant="outline"
              onClick={resetForm}
            >
              취소
            </Button>
          )}
        </div>
      </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex gap-2">
            <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={isSaving || uploading}
            onChange={(e) => {
                const file = e.target.files?.[0]

                if (!file) return

                handleUploadExcel(file)

                e.target.value = ''
            }}
            />

            <Button
            variant="outline"
            disabled={isSaving || uploading}
            onClick={downloadExcel}
            >
            엑셀
            </Button>
        </div>

        {uploading && uploadProgress && (
            <div className="mt-4 rounded-xl border bg-blue-50 p-4 text-sm text-blue-700">
            <div className="flex items-center justify-between">
                <p className="font-medium">업로드 중...</p>
                <p>{uploadProgress.percent}%</p>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${uploadProgress.percent}%` }}
                />
            </div>

            <p className="mt-2 text-xs">
                {uploadProgress.processed.toLocaleString()} /{' '}
                {uploadProgress.total.toLocaleString()}건 처리 중
            </p>
            </div>
        )}
        </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-gray-900">이미지 목록</h2>
            <p className="text-sm text-gray-500">
              총 {totalCount.toLocaleString()}건
            </p>
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPage}
              onPageChange={setCurrentPage}
              disabled={isSaving || uploading}
            />
          </div>

          <div className="flex gap-2">
            <Input
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(e.target.value)
              }
              placeholder="검색"
            />

            <Button
              onClick={() => {
                setCurrentPage(1)
                searchImages()
              }}
            >
              검색
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">

          <table className="w-full min-w-[1200px] text-sm">

            <thead>
              <tr className="border-b bg-gray-50">

                <th className="p-3">
                  이미지
                </th>

                <th className="p-3">
                  모델명
                </th>

                <th className="p-3">
                  구분
                </th>

                <th className="p-3">
                  컬러
                </th>

                <th className="p-3">
                  URL
                </th>

                <th className="p-3">
                  관리
                </th>
              </tr>
            </thead>

            <tbody>

              {images.map((item) => (
                <tr
                  key={item.id}
                  className="border-b"
                >

                  <td className="p-3">
                    <img
                      src={item.image_url}
                      alt={item.image_key}
                      loading="lazy"
                      decoding="async"
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded border object-cover"
                    />
                  </td>

                  <td className="p-3">
                    {item.model_name}
                  </td>

                  <td className="p-3 text-center">
                    {item.image_scope}
                  </td>

                  <td className="p-3 text-center">
                    {item.color_code || '-'}
                  </td>

                  <td className="p-3">
                    {item.image_url}
                  </td>

                  <td className="p-3">

                    <div className="flex gap-2">

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleEdit(item)
                        }
                      >
                        수정
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          handleDelete(item)
                        }
                      >
                        삭제
                      </Button>

                    </div>

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  )
}
