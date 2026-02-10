'use client'

import { LucideIcon, X, GripVertical } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WidgetCardProps {
  id: string
  title: string
  icon: LucideIcon
  children: React.ReactNode
  editMode?: boolean
  onRemove?: () => void
  className?: string
  dragHandleProps?: any
}

export function WidgetCard({
  id,
  title,
  icon: Icon,
  children,
  editMode = false,
  onRemove,
  className,
  dragHandleProps
}: WidgetCardProps) {
  return (
    <Card className={cn('relative', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        {editMode && (
          <div className="flex items-center gap-1">
            <button
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
