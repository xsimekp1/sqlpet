'use client'

import { DndContext, closestCenter, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useUIStore } from '@/app/stores/uiStore'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MedicalTodayWidget } from './MedicalTodayWidget'
import { FeedingTodayWidget } from './FeedingTodayWidget'
import { TasksWidget } from './TasksWidget'
import { ShelterStatsWidget } from './ShelterStatsWidget'
import { OccupancyWidget } from './OccupancyWidget'
import { RecentlyAdmittedWidget } from './RecentlyAdmittedWidget'
import { WalksTodayWidget } from './WalksTodayWidget'

const ALL_WIDGETS = ['medical-today', 'feeding-today', 'tasks', 'shelter-stats', 'occupancy', 'recently-admitted', 'walks-today'] as const
const widgetLabels: Record<string, string> = {
  'medical-today': 'medicalToday',
  'feeding-today': 'feedingToday',
  'tasks': 'tasks',
  'shelter-stats': 'shelterStats',
  'occupancy': 'occupancy',
  'recently-admitted': 'recentlyAdmitted',
  'walks-today': 'walksToday',
}

// Widget registry
const widgetComponents = {
  'medical-today': MedicalTodayWidget,
  'feeding-today': FeedingTodayWidget,
  'tasks': TasksWidget,
  'shelter-stats': ShelterStatsWidget,
  'occupancy': OccupancyWidget,
  'recently-admitted': RecentlyAdmittedWidget,
  'walks-today': WalksTodayWidget,
}

interface SortableWidgetProps {
  id: string
  editMode: boolean
  onRemove: () => void
}

function SortableWidget({ id, editMode, onRemove }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const WidgetComponent = widgetComponents[id as keyof typeof widgetComponents]

  if (!WidgetComponent) {
    return null
  }

  return (
    <div ref={setNodeRef} style={style}>
      <WidgetComponent
        editMode={editMode}
        onRemove={onRemove}
        dragHandleProps={editMode ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  )
}

export function DashboardGrid() {
  const { dashboardWidgets, setDashboardWidgets, dashboardEditMode } = useUIStore()
  const t = useTranslations('dashboard')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = dashboardWidgets.indexOf(active.id as string)
      const newIndex = dashboardWidgets.indexOf(over.id as string)
      setDashboardWidgets(arrayMove(dashboardWidgets, oldIndex, newIndex))
    }
  }

  const handleRemoveWidget = (widgetId: string) => {
    setDashboardWidgets(dashboardWidgets.filter(id => id !== widgetId))
  }

  const hiddenWidgets = ALL_WIDGETS.filter(id => !dashboardWidgets.includes(id))

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={dashboardWidgets} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dashboardWidgets.map((widgetId) => (
            <SortableWidget
              key={widgetId}
              id={widgetId}
              editMode={dashboardEditMode}
              onRemove={() => handleRemoveWidget(widgetId)}
            />
          ))}
        </div>
      </SortableContext>

      {dashboardEditMode && hiddenWidgets.length > 0 && (
        <div className="mt-4 p-4 border border-dashed rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">{t('hiddenWidgets')}</p>
          <div className="flex flex-wrap gap-2">
            {hiddenWidgets.map(id => (
              <Button
                key={id}
                variant="outline"
                size="sm"
                onClick={() => setDashboardWidgets([...dashboardWidgets, id])}
              >
                <Plus className="h-3 w-3 mr-1" />
                {t(widgetLabels[id] as any)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </DndContext>
  )
}
