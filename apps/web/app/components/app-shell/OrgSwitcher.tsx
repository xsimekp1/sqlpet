'use client'

import { Building2, Check, ChevronDown } from 'lucide-react'
import { useAuth } from '@/app/context/AuthContext'
import { useTranslations } from 'next-intl'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function OrgSwitcher() {
  const { memberships, selectedOrg, selectOrganization } = useAuth()
  const t = useTranslations('topbar')

  if (!selectedOrg) {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 px-3 justify-start"
        >
          <Building2 className="h-4 w-4" />
          <span className="hidden md:inline">{selectedOrg.name}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-2" align="start">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
            {t('switchOrg')}
          </p>
          {memberships.map((membership) => {
            const isCurrentOrg = membership.organization_id === selectedOrg.id

            return (
              <button
                key={membership.id}
                onClick={() => {
                  if (!isCurrentOrg) {
                    selectOrganization(membership.organization_id)
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm',
                  'hover:bg-accent hover:text-accent-foreground transition-colors',
                  isCurrentOrg && 'bg-accent'
                )}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <div className="flex-1 text-left">
                  <p className="font-medium">{membership.organization_name}</p>
                  <p className="text-xs text-muted-foreground">{membership.role_name}</p>
                </div>
                {isCurrentOrg && <Check className="h-4 w-4 shrink-0" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
