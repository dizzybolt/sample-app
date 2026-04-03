'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { SampleEntry, ColorCode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarIcon, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

function getTodayCode() {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}-`
}

interface SampleFormProps {
  sample?: SampleEntry | null
  colorCodes: ColorCode[]
  onSuccess: () => void
  onCancel: () => void
}

const supabase = createClient()

export function SampleForm({ sample, colorCodes, onSuccess, onCancel }: SampleFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [chinaCode, setChinaCode] = useState(
  sample?.china_code || getTodayCode()
)
  const [koreaCode, setKoreaCode] = useState(sample?.korea_code || '')
  const [selectedColorCode, setSelectedColorCode] = useState(sample?.color_code || '')
  const [quantity, setQuantity] = useState(sample?.quantity?.toString() || '1')
  const [checkedAt, setCheckedAt] = useState<Date | undefined>(
    sample?.checked_at ? new Date(sample.checked_at) : new Date()
  )
  const [status, setStatus] = useState(sample?.status || '확인')
  const [memo, setMemo] = useState(sample?.memo || '')
  const [imageUrl, setImageUrl] = useState(sample?.image_url || '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(sample?.image_url || null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setImageUrl('')
    if (cameraInputRef.current) {
  cameraInputRef.current.value = ''
}
if (galleryInputRef.current) {
  galleryInputRef.current.value = ''
}
  }

  const uploadImageAndCreateSample = async () => {
  if (!imageFile) {
    throw new Error('이미지 파일이 필요합니다.')
  }

  const selectedColor = colorCodes.find(c => c.color_code === selectedColorCode)

  const formData = new FormData()
  formData.append('file', imageFile)
  formData.append('china_code', chinaCode.trim())
  formData.append('korea_code', koreaCode.trim())
  formData.append('color_code', selectedColorCode)
  formData.append('color_name', selectedColor?.color_name || '')
  formData.append('qty', String(parseInt(quantity) || 1))
  formData.append('checked_at', checkedAt ? checkedAt.toISOString() : '')
  formData.append('note', memo.trim())
  formData.append('status', status)

  const res = await fetch('https://sample-upload-api.onrender.com/upload-image', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()

  if (!res.ok || !data.success) {
    throw new Error(data.detail || data.message || '이미지 업로드 실패')
  }

  return data
}

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsSubmitting(true)
  setError(null)

  try {
    if (!chinaCode.trim()) {
      throw new Error('중국코드는 필수 입력입니다.')
    }

    if (!selectedColorCode) {
      throw new Error('컬러는 필수 선택입니다.')
    }

    if (!checkedAt) {
      throw new Error('검수일은 필수입니다.')
    }

    if (sample?.id) {
      // 수정: Supabase 직접 update
      const selectedColor = colorCodes.find(c => c.color_code === selectedColorCode)

      const sampleData = {
        china_code: chinaCode.trim(),
        korea_code: koreaCode.trim() || null,
        color_code: selectedColorCode || null,
        color_name: selectedColor?.color_name || null,
        qty: parseInt(quantity) || 1,
        checked_at: checkedAt.toISOString(),
        status,
        note: memo.trim() || null,
      }

      const { error: updateError } = await supabase
        .from('sample_entries')
        .update(sampleData)
        .eq('id', sample.id)

      if (updateError) throw updateError
    } else {
      // 신규 등록: Render API만 호출
      await uploadImageAndCreateSample()
    }

    onSuccess()
  } catch (err) {
    setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
  } finally {
    setIsSubmitting(false)
  }
}

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Image Upload */}
      <div className="space-y-2">
        <Label>샘플 이미지</Label>
        <div className="flex items-start gap-4">
  {imagePreview ? (
    <div className="relative">
      <div className="relative h-24 w-24 overflow-hidden rounded-lg border">
        <Image
          src={imagePreview}
          alt="Preview"
          fill
          className="object-cover"
        />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute -right-2 -top-2 h-6 w-6"
        onClick={removeImage}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  ) : (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => cameraInputRef.current?.click()}
      >
        📷 사진 촬영
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => galleryInputRef.current?.click()}
      >
        🖼 앨범 선택
      </Button>
    </div>
  )}

  {/* 카메라 */}
  <input
    ref={cameraInputRef}
    type="file"
    accept="image/*"
    capture="environment"
    onChange={handleImageChange}
    className="hidden"
  />

  {/* 앨범 */}
  <input
    ref={galleryInputRef}
    type="file"
    accept="image/*"
    onChange={handleImageChange}
    className="hidden"
  />
</div>

      {/* China Code (Required) */}
      <div className="space-y-2">
        <Label htmlFor="chinaCode">
          중국코드 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="chinaCode"
          value={chinaCode}
          onChange={(e) => setChinaCode(e.target.value)}
          placeholder="예: CN-12345"
          required
        />
      </div>

      {/* Korea Code */}
      <div className="space-y-2">
        <Label htmlFor="koreaCode">한국코드</Label>
        <Input
          id="koreaCode"
          value={koreaCode}
          onChange={(e) => setKoreaCode(e.target.value)}
          placeholder="예: KR-12345"
        />
      </div>

      {/* Color Code */}
      <div className="space-y-2">
        <Label>컬러</Label>
        <Select value={selectedColorCode || undefined} onValueChange={setSelectedColorCode}>
          <SelectTrigger>
            <SelectValue placeholder="컬러 선택" />
          </SelectTrigger>
          <SelectContent>
            {colorCodes.map((color) => (
              <SelectItem key={color.id} value={color.color_code}>
                {color.color_name} ({color.color_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quantity */}
      <div className="space-y-2">
        <Label htmlFor="quantity">수량</Label>
        <Input
          id="quantity"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>

      {/* Checked At */}
      <div className="space-y-2">
        <Label>검수일</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !checkedAt && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {checkedAt ? format(checkedAt, 'PPP', { locale: ko }) : '날짜 선택'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={checkedAt}
              onSelect={setCheckedAt}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label>상태</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="확인">확인</SelectItem>
            <SelectItem value="진행">진행</SelectItem>
            <SelectItem value="미진행">미진행</SelectItem>
            <SelectItem value="발주">발주</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Memo */}
      <div className="space-y-2">
        <Label htmlFor="memo">메모</Label>
        <Textarea
          id="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="샘플에 대한 메모를 입력하세요..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? (
            <>
              <Spinner className="mr-2" />
              저장 중...
            </>
          ) : sample ? '수정' : '등록'}
        </Button>
      </div>
    </form>
  )
}
