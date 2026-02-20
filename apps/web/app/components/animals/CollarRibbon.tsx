'use client'

import { useTranslations } from 'next-intl'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getCollarColor, type CollarColor } from '@/app/lib/collarColors'

type CollarRibbonProps = {
  color: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Corner ribbon showing collar color for litter identification
 *
 * Displays a colored triangle in the top-left corner of animal photo
 */
export function CollarRibbon({ color, size = 'md' }: CollarRibbonProps) {
  const t = useTranslations('animals.collar')

  if (!color) return null

  const config = getCollarColor(color)
  if (!config) return null

  // Size classes for the ribbon
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }

  const ribbonSize = sizeClasses[size]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`absolute top-0 left-0 ${ribbonSize} overflow-hidden pointer-events-auto z-10`}
            style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
          >
            <div
              className={`w-full h-full ${config.bg} ${config.darkBg} opacity-90`}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('label')}: {t(`colors.${color}`)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Collar badge for use in table/list views
 */
export function CollarBadge({ color }: { color: string | null | undefined }) {
  const t = useTranslations('animals.collar')

  if (!color) return <span className="text-muted-foreground text-sm">—</span>

  const config = getCollarColor(color)
  if (!config) return <span className="text-muted-foreground text-sm">—</span>

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-3 h-3 rounded-full ${config.bg} ${config.darkBg} border-2 border-white dark:border-gray-800 shadow-sm`}
            />
            <span className="text-sm capitalize">{t(`colors.${color}`)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('label')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
