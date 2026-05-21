'use client'

import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface ImagePreviewDialogProps {
  src?: string | null
  alt?: string
  children: React.ReactNode
}

type Point = {
  x: number
  y: number
}

function getDistance(a: Point, b: Point) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function getCenter(a: Point, b: Point) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }
}

export function ImagePreviewDialog({
  src,
  alt = '이미지 미리보기',
  children,
}: ImagePreviewDialogProps) {
  const [open, setOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const lastPointRef = useRef<Point>({ x: 0, y: 0 })
  const closeLockRef = useRef(false)

  const touchesRef = useRef<Map<number, Point>>(new Map())
  const pinchStartDistanceRef = useRef(0)
  const pinchStartScaleRef = useRef(1)
  const pinchStartCenterRef = useRef<Point>({ x: 0, y: 0 })
  const pinchStartPositionRef = useRef<Point>({ x: 0, y: 0 })

  if (!src) return <>{children}</>

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setDragging(false)
    touchesRef.current.clear()
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
                e.preventDefault()

                touchesRef.current.set(e.pointerId, {
                  x: e.clientX,
                  y: e.clientY,
                })

                e.currentTarget.setPointerCapture(e.pointerId)

                const points = Array.from(touchesRef.current.values())

                if (points.length === 1) {
                  if (scale <= 1) return

                  setDragging(true)
                  lastPointRef.current = points[0]
                }

                if (points.length === 2) {
                  setDragging(false)

                  pinchStartDistanceRef.current = getDistance(
                    points[0],
                    points[1]
                  )
                  pinchStartScaleRef.current = scale
                  pinchStartCenterRef.current = getCenter(points[0], points[1])
                  pinchStartPositionRef.current = position
                }
              }}
              onPointerMove={(e) => {
                if (!touchesRef.current.has(e.pointerId)) return

                touchesRef.current.set(e.pointerId, {
                  x: e.clientX,
                  y: e.clientY,
                })

                const points = Array.from(touchesRef.current.values())

                if (points.length === 2) {
                  const currentDistance = getDistance(points[0], points[1])

                  if (pinchStartDistanceRef.current <= 0) return

                  const ratio =
                    currentDistance / pinchStartDistanceRef.current

                  const nextScale = Math.min(
                    Math.max(pinchStartScaleRef.current * ratio, 1),
                    6
                  )

                  const currentCenter = getCenter(points[0], points[1])
                  const dx = currentCenter.x - pinchStartCenterRef.current.x
                  const dy = currentCenter.y - pinchStartCenterRef.current.y

                  setScale(nextScale)

                  setPosition({
                    x: pinchStartPositionRef.current.x + dx,
                    y: pinchStartPositionRef.current.y + dy,
                  })

                  return
                }

                if (points.length === 1 && dragging && scale > 1) {
                  const point = points[0]

                  const dx = point.x - lastPointRef.current.x
                  const dy = point.y - lastPointRef.current.y

                  setPosition((prev) => ({
                    x: prev.x + dx,
                    y: prev.y + dy,
                  }))

                  lastPointRef.current = point
                }
              }}
              onPointerUp={(e) => {
                touchesRef.current.delete(e.pointerId)

                const points = Array.from(touchesRef.current.values())

                if (points.length === 0) {
                  setDragging(false)
                }

                if (points.length === 1) {
                  lastPointRef.current = points[0]
                  setDragging(scale > 1)
                }
              }}
              onPointerCancel={(e) => {
                touchesRef.current.delete(e.pointerId)
                setDragging(false)
              }}
              style={{
                cursor:
                  scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
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