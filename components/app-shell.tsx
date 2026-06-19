'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Barcode,
  BookOpen,
  Camera,
  ChevronDown,
  ClipboardList,
  FileCog,
  FileText,
  Home,
  IdCard,
  ImageIcon,
  Layers3,
  Menu,
  Package,
  PackageCheck,
  Palette,
  Ruler,
  Settings,
  Shirt,
  Truck,
  Warehouse,
  Wrench,
  X,
  Combine,
  Boxes,
  Grid2x2Plus,
  Images,
  LayoutList,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const menuSections = [
  {
    key: 'operation',
    title: '운영관리',
    items: [
      { title: '전체 메뉴', href: '/', icon: Home },
      { title: '대시보드', href: '/dashboard', icon: BarChart3 },
      { title: '샘플관리', href: '/samples', icon: ClipboardList },
      { title: '발주관리', href: '/orders', icon: FileText },
      { title: '입고관리', href: '/inbound', icon: PackageCheck },
      { title: '상품 마스터', href: '/products', icon: LayoutList },
    ],
  },
  {
    key: 'product',
    title: '상품관리',
    items: [
      { title: '아이템카드', href: '/item-cards', icon: IdCard },
      { title: 'SKU 매핑관리', href: '/sku-mappings', icon: Barcode },
      { title: '이미지관리', href: '/product-images', icon: Images },
    ],
  },
  {
    key: 'inventory',
    title: '재고관리',
    items: [
      { title: '재고관리', href: '/inventory', icon: Boxes },
      { title: '재고 등록/수정', href: '/inventory-adjustments', icon: PackageCheck },
      { title: '창고관리', href: '/warehouses', icon: Warehouse },
    ],
  },
  {
    key: 'utility',
    title: '도구',
    items: [
      { title: '구성상품 생성기', href: '/utility/bundle-builder', icon: Combine },
    ],
  },
  {
    key: 'admin',
    title: '설정',
    items: [
      { title: '모델명 생성 기준 설정', href: '/model-codes', icon: Settings },
      { title: '컬러 기준 설정', href: '/color-codes', icon: Palette },
      { title: '사이즈 기준 설정', href: '/size-groups', icon: Ruler },
      { title: '스튜디오 관리', href: '/studios', icon: Camera },
      { title: '발주/입고 출력 헤더 설정', href: '/print-headers', icon: Grid2x2Plus },
    ],
  },
  {
    key: 'guide',
    title: '가이드',
    items: [{ title: '가이드', href: '/guide', icon: BookOpen }],
  },
]

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const getActiveSectionKeys = () =>
    menuSections
      .filter((section) =>
        section.items.some((item) =>
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        )
      )
      .map((section) => section.key)

  const [openSections, setOpenSections] = useState<string[]>(getActiveSectionKeys)

  useEffect(() => {
    setOpenSections((prev) => {
      const activeKeys = getActiveSectionKeys()
      return Array.from(new Set([...prev, ...activeKeys]))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function toggleSection(key: string) {
    setOpenSections((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }

  function renderNavItem(item: (typeof menuSections)[number]['items'][number]) {
    const Icon = item.icon
    const isActive =
      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setIsOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
          isActive
            ? 'bg-gray-900 text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )}
      >
        <Icon className="h-4 w-4" />
        {item.title}
      </Link>
    )
  }

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r bg-white p-4">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-900">BHPC OMA</h1>
        <p className="text-xs text-gray-500">BHPC Operations Management App</p>
      </div>

      <nav className="space-y-3 overflow-y-auto">
        {menuSections.map((section) => {
          const isSectionOpen = openSections.includes(section.key)

          return (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
              >
                {section.title}

                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    isSectionOpen ? 'rotate-180' : ''
                  )}
                />
              </button>

              {isSectionOpen && (
                <div className="mt-1 space-y-1">
                  {section.items.map(renderNavItem)}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <div className="hidden lg:block">{sidebar}</div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b bg-white px-4 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(true)}
            aria-label="메뉴 열기"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <h1 className="font-bold text-gray-900">BHPC OMA</h1>
        </header>

        {isOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => setIsOpen(false)}
              aria-label="메뉴 닫기"
            />

            <div className="relative z-10 h-full w-72 bg-white">
              <div className="flex items-center justify-between border-b p-4">
                <p className="font-bold">메뉴</p>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  aria-label="메뉴 닫기"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {sidebar}
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}