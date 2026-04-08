'use client'

import { useRef, useState } from 'react'
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
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Cropper from 'react-easy-crop'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface SampleFormProps {
  sample?: SampleEntry | null
  colorCodes: ColorCode[]
  onSuccess: () => void
  onCancel: () => void
}

const supabase = createClient()

function getTodayCode() {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}-`
}

export function SampleForm({
  sample,
  colorCodes,
  onSuccess,
  onCancel,
}: SampleFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const sampleQty = sample?.qty ?? 1
  const sampleNote = sample?.note ?? sample?.memo ?? ''

  const [chinaCode, setChinaCode] = useState(
    sample?.china_code || getTodayCode()
  )
  const [koreaCode, setKoreaCode] = useState(sample?.korea_code || '')
  const [selectedColorCode, setSelectedColorCode] = useState(
    sample?.color_code || ''
  )
  const [quantity, setQuantity] = useState(String(sampleQty))
  const [checkedAt, setCheckedAt] = useState<Date | undefined>(
    sample?.checked_at ? new Date(sample.checked_at) : new Date()
  )
  const [confirmedAt, setConfirmedAt] = useState<Date | undefined>(
    sample?.confirmed_at ? new Date(sample.confirmed_at) : undefined
  )
  const [status, setStatus] = useState(sample?.status || '확인')
  const [memo, setMemo] = useState(sampleNote)
  const [orderQty, setOrderQty] = useState(
    sample?.order_qty != null ? String(sample.order_qty) : ''
  )
  const [orderedAt, setOrderedAt] = useState<Date | undefined>(
    sample?.ordered_at ? new Date(sample.ordered_at) : undefined
  )

  const [imageUrl, setImageUrl] = useState(sample?.image_url || '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    sample?.image_url || null
  )

  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)
  const [isCropOpen, setIsCropOpen] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setRawImageSrc(reader.result as string)
      setIsCropOpen(true)
    }
    reader.readAsDataURL(file)
  }

  const onCropComplete = (_croppedArea: any, croppedPixels: any) => {
    setCroppedAreaPixels(croppedPixels)
  }

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new window.Image()
      image.addEventListener('load', () => resolve(image))
      image.addEventListener('error', (error) => reject(error))
      image.src = url
    })

  const getCroppedImageBlob = async (imageSrc: string, cropPixels: {x: number; y: number; width: number; height: number}): Promise<Blob> => {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('캔버스 생성 실패')
    }

    canvas.width = cropPixels.width
    canvas.height = cropPixels.height

    ctx.drawImage(
      image,
      cropPixels.x,
      cropPixels.y,
      cropPixels.width,
      cropPixels.height,
      0,
      0,
      cropPixels.width,
      cropPixels.height
    )

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('크롭 이미지 생성 실패'))
          return
        }
        resolve(blob)
      }, 'image/jpeg', 0.95)
    })
  }
  
const optimizeImage = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const canvas = document.createElement('canvas')
    const reader = new FileReader()

    reader.onload = (event) => {
      img.src = event.target?.result as string
    }

    img.onload = async () => {
      const MAX_WIDTH = 1000

      let width = img.width
      let height = img.height

      if (width > MAX_WIDTH) {
        const ratio = MAX_WIDTH / width
        width = MAX_WIDTH
        height = Math.round(height * ratio)
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('이미지 처리 실패'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      const makeBlob = (quality: number) =>
        new Promise<Blob | null>((res) => {
          canvas.toBlob((blob) => res(blob), 'image/jpeg', quality)
        })

      let blob = await makeBlob(0.8)

      if (!blob) {
        reject(new Error('이미지 압축 실패'))
        return
      }

      if (blob.size > 2 * 1024 * 1024) {
        blob = await makeBlob(0.7)
      }

      if (!blob) {
        reject(new Error('이미지 압축 실패'))
        return
      }

      const optimizedFile = new File(
        [blob],
        file.name.replace(/\.\w+$/, '.jpg'),
        { type: 'image/jpeg' }
      )

      resolve(optimizedFile)
    }

    img.onerror = () => reject(new Error('이미지 로드 실패'))
    reader.onerror = () => reject(new Error('파일 읽기 실패'))

    reader.readAsDataURL(file)
  })
}

const handleCropConfirm = async () => {
  try {
    if (!rawImageSrc || !croppedAreaPixels) {
      throw new Error('크롭 영역이 없습니다.')
    }

    const croppedBlob = await getCroppedImageBlob(rawImageSrc, croppedAreaPixels)

    const croppedFile = new File([croppedBlob], `cropped_${Date.now()}.jpg`, {
      type: 'image/jpeg',
    })

    const optimizedFile = await optimizeImage(croppedFile)

    setImageFile(optimizedFile)

    const previewUrl = URL.createObjectURL(optimizedFile)
    setImagePreview(previewUrl)
    setImageUrl('')

    setIsCropOpen(false)
    setRawImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  } catch (err) {
    setError(err instanceof Error ? err.message : '이미지 처리 중 오류가 발생했습니다.')
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

    const selectedColor = colorCodes.find(
      (c) => c.color_code === selectedColorCode
    )

    const formData = new FormData()
    formData.append('file', imageFile)
    formData.append('china_code', chinaCode.trim())
    formData.append('korea_code', koreaCode.trim())
    formData.append('color_code', selectedColorCode)
    formData.append('color_name', selectedColor?.color_name || '')
    formData.append('qty', String(parseInt(quantity, 10) || 1))
    formData.append('checked_at', checkedAt ? checkedAt.toISOString() : '')
    formData.append('confirmed_at', confirmedAt ? confirmedAt.toISOString() : '')
    formData.append('order_qty', orderQty ? String(parseInt(orderQty, 10) || 0) : '')
    formData.append('ordered_at', orderedAt ? orderedAt.toISOString() : '')
    formData.append('note', memo.trim())
    formData.append('status', status)

    const res = await fetch(
      'https://sample-upload-api.onrender.com/upload-image',
      {
        method: 'POST',
        body: formData,
      }
    )

    const data = await res.json()

    if (!res.ok || !data.success) {
      throw new Error(data.detail || data.message || '이미지 업로드 실패')
    }

    return data
  }

  const resetForNewEntry = () => {
    setChinaCode(getTodayCode())
    setKoreaCode('')
    setSelectedColorCode('')
    setQuantity('1')
    setCheckedAt(new Date())
    setConfirmedAt(undefined)
    setStatus('확인')
    setMemo('')
    setOrderQty('')
    setOrderedAt(undefined)
    setImageUrl('')
    setImageFile(null)
    setImagePreview(null)

    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (!chinaCode.trim()) {
        throw new Error('중국품번은 필수 입력입니다.')
      }

      if (!selectedColorCode) {
        throw new Error('색상은 필수 선택입니다.')
      }

      if (!checkedAt) {
        throw new Error('검수일은 필수입니다.')
      }

      if (!quantity || parseInt(quantity, 10) < 1) {
        throw new Error('입고수량은 1 이상이어야 합니다.')
      }

      const selectedColor = colorCodes.find(
        (c) => c.color_code === selectedColorCode
      )

      if (!selectedColor) {
        throw new Error('선택한 색상 정보를 찾을 수 없습니다.')
      }

      if (sample?.id) {
        if (imageFile) {
          throw new Error('이미지 변경은 아직 지원하지 않습니다.')
        }

        const sampleData = {
          china_code: chinaCode.trim(),
          korea_code: koreaCode.trim() || null,
          color_code: selectedColorCode,
          color_name: selectedColor.color_name,
          qty: parseInt(quantity, 10) || 1,
          checked_at: checkedAt.toISOString(),
          confirmed_at: confirmedAt ? confirmedAt.toISOString() : null,
          status,
          note: memo.trim() || null,
          order_qty: orderQty ? parseInt(orderQty, 10) || 0 : null,
          ordered_at: orderedAt ? orderedAt.toISOString() : null,
          image_url: imageUrl || null,
        }

        const { error: updateError } = await supabase
          .from('sample_entries')
          .update(sampleData)
          .eq('id', sample.id)

        if (updateError) throw updateError
      } else {
        if (!imageFile) {
          throw new Error('이미지는 필수입니다.')
        }

        await uploadImageAndCreateSample()
        resetForNewEntry()
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Image Upload */}
        <div className="space-y-2">
          <Label>
            샘플 이미지 <span className="text-destructive">*</span>
          </Label>

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

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="hidden"
            />

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
        </div>

        {/* China Code */}
        <div className="space-y-2">
          <Label htmlFor="chinaCode">
            중국품번 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="chinaCode"
            value={chinaCode}
            onChange={(e) => setChinaCode(e.target.value)}
            placeholder="예: 260403-"
            required
          />
        </div>

        {/* Korea Code */}
        <div className="space-y-2">
          <Label htmlFor="koreaCode">한국품번</Label>
          <Input
            id="koreaCode"
            value={koreaCode}
            onChange={(e) => setKoreaCode(e.target.value)}
            placeholder="예: TEST0403"
          />
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label>
            색상 <span className="text-destructive">*</span>
          </Label>
          <Select
            value={selectedColorCode || undefined}
            onValueChange={setSelectedColorCode}
          >
            <SelectTrigger>
              <SelectValue placeholder="색상 선택" />
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
          <Label htmlFor="quantity">
            입고수량 <span className="text-destructive">*</span>
          </Label>
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
          <Label>
            검수일 <span className="text-destructive">*</span>
          </Label>
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
                {checkedAt
                  ? format(checkedAt, 'PPP', { locale: ko })
                  : '날짜 선택'}
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

        {/* Confirmed At */}
        <div className="space-y-2">
          <Label>확인일</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !confirmedAt && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {confirmedAt
                  ? format(confirmedAt, 'PPP', { locale: ko })
                  : '날짜 선택'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={confirmedAt}
                onSelect={setConfirmedAt}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label>
            상태 <span className="text-destructive">*</span>
          </Label>
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
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

        {/* Order Qty */}
        <div className="space-y-2">
          <Label htmlFor="orderQty">발주수량</Label>
          <Input
            id="orderQty"
            type="number"
            min="0"
            value={orderQty}
            onChange={(e) => setOrderQty(e.target.value)}
            placeholder="발주수량 입력"
          />
        </div>

        {/* Ordered At */}
        <div className="space-y-2">
          <Label>발주일자</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !orderedAt && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {orderedAt
                  ? format(orderedAt, 'PPP', { locale: ko })
                  : '날짜 선택'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={orderedAt}
                onSelect={setOrderedAt}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Memo */}
        <div className="space-y-2">
          <Label htmlFor="memo">비고</Label>
          <Textarea
            id="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="비고를 입력하세요..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            취소
          </Button>

          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? (
              <>
                <Spinner className="mr-2" />
                저장 중...
              </>
            ) : sample ? (
              '수정'
            ) : (
              '등록'
            )}
          </Button>
        </div>
      </form>

      <Dialog open={isCropOpen} onOpenChange={setIsCropOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>이미지 자르기</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative h-[400px] w-full overflow-hidden rounded-lg bg-black">
              {rawImageSrc && (
                <Cropper
                  image={rawImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={3 / 4}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>확대</Label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsCropOpen(false)
                  setRawImageSrc(null)
                }}
              >
                취소
              </Button>

              <Button
                type="button"
                className="flex-1"
                onClick={handleCropConfirm}
              >
                크롭 완료
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}