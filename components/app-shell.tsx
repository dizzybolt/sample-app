'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Camera,
  ClipboardList,
  FileCog,
  FileText,
  Home,
  IdCard,
  Menu,
  PackageCheck,
  Ruler,
  X,
  BookOpen,
  Palette,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const workNavItems = [
  { title: '홈', href: '/', icon: Home },
  { title: '대시보드', href: '/dashboard', icon: BarChart3 },
  { title: '샘플관리', href: '/samples', icon: ClipboardList },
  { title: '발주관리', href: '/orders', icon: FileText },
  { title: '입고관리', href: '/inbound', icon: PackageCheck },
  { title: '아이템카드', href: '/item-cards', icon: IdCard },
]

const adminNavItems = [
  { title: '컬러표', href: '/color-codes', icon: Palette },
  { title: '사이즈표', href: '/size-groups', icon: Ruler },
  { title: '스튜디오', href: '/studios', icon: Camera },
  { title: '출력 헤더 관리', href: '/print-headers', icon: FileCog },
]

const guideNavItem = {
  title: '가이드',
  href: '/guide',
  icon: BookOpen,
}

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const renderNavItem = (item: (typeof workNavItems)[number]) => {
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
    <aside className="flex h-full w-64 flex-col overflow-hidden border-r bg-white">
      <div className="border-b px-5 py-4">
        <h1 className="text-lg font-bold text-gray-900">샘플 입고 관리</h1>
        <p className="mt-1 text-xs text-gray-500">Sample Workflow</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold text-gray-400">
            Menu
          </p>

          {workNavItems.map(renderNavItem)}
        </div>

        <div className="mt-6 border-t pt-4">
          <p className="px-3 pb-2 text-xs font-semibold text-gray-400">
            Setting
          </p>

          <div className="space-y-1">
            {adminNavItems.map(renderNavItem)}
          </div>
        </div>
      </nav>
        <div className="shrink-0 border-t bg-white p-3">
          {renderNavItem(guideNavItem)}
        </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block">
        {sidebar}
      </div>

      <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-white px-4 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="ml-3">
          <p className="text-sm font-semibold text-gray-900">샘플 입고 관리</p>
        </div>
      </header>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-sm font-semibold">메뉴</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                aria-label="메뉴 닫기"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="min-h-0 flex-1">
              {sidebar}
            </div>
          </div>
        </div>
      )}

      <main className="lg:pl-64">{children}</main>
    </div>
  )
}