'use client'

import { useTranslations } from 'next-intl'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Home, 
  PawPrint, 
  Grid3x3, 
  HeartPulse, 
  Apple, 
  CheckSquare, 
  Users, 
  BarChart3, 
  Settings, 
  Inbox, 
  Heart,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface MenuItem {
  title: string
  description: string
  href: string
  icon: any
  badge?: string
  permission?: string | null
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

export default function MenuPage() {
  const t = useTranslations('menu')
  const pathname = usePathname()

  const menuSections: MenuSection[] = [
    {
      title: t('sections.main'),
      items: [
        {
          title: t('dashboard.title'),
          description: t('dashboard.description'),
          href: '/dashboard',
          icon: Home,
          permission: null
        },
        {
          title: t('animals.title'),
          description: t('animals.description'),
          href: '/dashboard/animals',
          icon: PawPrint,
          badge: '12',
          permission: 'animals.view'
        }
      ]
    },
    {
      title: t('sections.operations'),
      items: [
        {
          title: t('kennels.title'),
          description: t('kennels.description'),
          href: '/dashboard/kennels',
          icon: Grid3x3,
          permission: 'kennels.view'
        },
        {
          title: t('medical.title'),
          description: t('medical.description'),
          href: '/dashboard/medical',
          icon: HeartPulse,
          badge: '3',
          permission: 'medical.view'
        },
        {
          title: t('feeding.title'),
          description: t('feeding.description'),
          href: '/dashboard/feeding',
          icon: Apple,
          permission: 'feeding.view'
        },
        {
          title: t('tasks.title'),
          description: t('tasks.description'),
          href: '/dashboard/tasks',
          icon: CheckSquare,
          badge: '8',
          permission: 'tasks.view'
        }
      ]
    },
    {
      title: t('sections.people'),
      items: [
        {
          title: t('people.title'),
          description: t('people.description'),
          href: '/dashboard/people',
          icon: Users,
          permission: 'people.view'
        },
        {
          title: t('adoptions.title'),
          description: t('adoptions.description'),
          href: '/dashboard/adoptions',
          icon: Heart,
          badge: '2',
          permission: 'adoptions.view'
        }
      ]
    },
    {
      title: t('sections.system'),
      items: [
        {
          title: t('intake.title'),
          description: t('intake.description'),
          href: '/dashboard/intake',
          icon: Inbox,
          permission: 'intake.create'
        },
        {
          title: t('reports.title'),
          description: t('reports.description'),
          href: '/dashboard/reports',
          icon: BarChart3,
          permission: 'reports.view'
        },
        {
          title: t('settings.title'),
          description: t('settings.description'),
          href: '/dashboard/settings',
          icon: Settings,
          permission: 'settings.view'
        }
      ]
    }
  ]

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <div className="space-y-8">
        {menuSections.map((section) => (
          <div key={section.title}>
            <h2 className="text-lg font-semibold mb-4 px-1">{section.title}</h2>
            <div className="grid gap-4">
              {section.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                
                return (
                  <Link key={item.href} href={item.href}>
                    <Card className={`transition-colors hover:bg-accent cursor-pointer ${
                      active ? 'border-primary bg-primary/5' : ''
                    }`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              active ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{item.title}</CardTitle>
                              <CardDescription>{item.description}</CardDescription>
                            </div>
                          </div>
                          {item.badge && (
                            <Badge variant="secondary">{item.badge}</Badge>
                          )}
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}