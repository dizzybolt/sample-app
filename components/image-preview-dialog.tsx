'use client'

import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface ImagePreviewDialogProps {
  src?: string | null
  alt?: string
  children: React.ReactNode
}

export function ImagePreviewDialog({
  src,
  alt = '이미지 미리보기',
  children,
}: ImagePreviewDialogProps) {
  const [open, setOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const lastPointRef = useRef({ x: 0, y: 0 })
  const closeLockRef = useRef(false)

  if (!src) return <>{children}</>

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setDragging(false)
  }

  const closeDialog = () => {
    closeLockRef.current = true
    setOpen(false)
    resetZoom()

    setTimeout(() => {
      closeLockRef.current = false
    }, 300)
  }

  const openDialog = () => {
    if (closeLockRef.current) return
    setOpen(true)
  }

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 6))
  }

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.25, 1)
      if (next === 1) {
        setPosition({ x: 0, y: 0 })
      }
      return next
    })
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openDialog()
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') openDialog()
        }}
        className="block w-full cursor-pointer"
      >
        {children}
      </div>

    {open && (
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeDialog()
          } else {
            openDialog()
          }
        }}
      >
        <DialogContent
          className="max-h-[92vh] max-w-6xl overflow-hidden p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>

          <div className="mb-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={zoomOut}
              className="rounded-md border px-3 py-1 text-sm"
            >
              축소
            </button>

            <button
              type="button"
              onClick={resetZoom}
              className="rounded-md border px-3 py-1 text-sm"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              onClick={zoomIn}
              className="rounded-md border px-3 py-1 text-sm"
            >
              확대
            </button>
          </div>

          <div
            className="relative h-[78vh] w-full overflow-hidden rounded-xl bg-gray-50"
            onWheel={(e) => {
              e.preventDefault()

              if (e.deltaY < 0) {
                zoomIn()
              } else {
                zoomOut()
              }
            }}
            onPointerDown={(e) => {
              if (scale <= 1) return

              setDragging(true)
              lastPointRef.current = {
                x: e.clientX,
                y: e.clientY,
              }

              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!dragging || scale <= 1) return

              const dx = e.clientX - lastPointRef.current.x
              const dy = e.clientY - lastPointRef.current.y

              setPosition((prev) => ({
                x: prev.x + dx,
                y: prev.y + dy,
              }))

              lastPointRef.current = {
                x: e.clientX,
                y: e.clientY,
              }
            }}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            style={{
              cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
              touchAction: 'none',
            }}
          >
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'center center',
              }}
            >
              <img
                src={src}
                alt={alt}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
}