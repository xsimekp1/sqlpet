'use client'

import { useEffect, useState } from 'react'
import { CheckSquare, ArrowRight, Plus, Loader2 } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import ApiClient from '@/app/lib/api'
import { CreateTaskDialog } from '@/app/components/tasks/CreateTaskDialog'

interface TasksWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

export function TasksWidget({ editMode, onRemove, dragHandleProps }: TasksWidgetProps) {
  const t = useTranslations('dashboard')

  const [tasksDue, setTasksDue] = useState<number | null>(null)
  const [highPriority, setHighPriority] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        setLoading(true)
        // Fetch all active tasks in a single call
        const resp = await ApiClient.getTasks({ page_size: 100 })
        const active = resp.items.filter(
          t => t.status !== 'completed' && t.status !== 'cancelled'
        )
        setTasksDue(active.length)
        setHighPriority(active.filter(t => t.priority === 'high' || t.priority === 'urgent').length)
      } catch {
        setTasksDue(0)
        setHighPriority(0)
      } finally {
        setLoading(false)
      }
    }
    fetchCounts()
  }, [])

  return (
    <>
      <WidgetCard
        id="tasks"
        title={t('tasks')}
        icon={CheckSquare}
        editMode={editMode}
        onRemove={onRemove}
        dragHandleProps={dragHandleProps}
        className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/50 dark:border-blue-800/30"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <CheckSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              ) : (
                <>
                  <p className="text-4xl font-bold text-blue-700 dark:text-blue-400">{tasksDue ?? 0}</p>
                  <p className="text-sm text-muted-foreground">{t('tasksDue')}</p>
                </>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => setCreateOpen(true)}
              title="Nový úkol"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {!loading && (highPriority ?? 0) > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30">
              <div className="h-2 w-2 rounded-full bg-orange-500" />
              <span className="text-sm text-orange-700 dark:text-orange-400 font-medium">
                {highPriority} prioritních
              </span>
            </div>
          )}

          <Link href="/dashboard/tasks">
            <Button variant="link" size="sm" className="px-0 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </WidgetCard>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          // Refresh count
          ApiClient.getTasks({ page_size: 100 }).then(resp => {
            const active = resp.items.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
            setTasksDue(active.length)
            setHighPriority(active.filter(t => t.priority === 'high' || t.priority === 'urgent').length)
          }).catch(() => {})
        }}
      />
    </>
  )
}
