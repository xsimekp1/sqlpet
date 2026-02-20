'use client'

import { DndContext, closestCenter, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useUIStore, WidgetConfig, WidgetSize } from '@/app/stores/uiStore'
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
import { MyTasksWidget } from './MyTasksWidget'
import { UpcomingOutcomesWidget } from './UpcomingOutcomesWidget'
import VaccinationsExpiringWidget from './VaccinationsExpiringWidget'

const ALL_WIDGETS: { id: string; size: WidgetSize }[] = [
  { id: 'medical-today', size: 'large' },
  { id: 'feeding-today', size: 'large' },
  { id: 'tasks', size: 'small' },
  { id: 'shelter-stats', size: 'large' },
  { id: 'occupancy', size: 'large' },
  { id: 'recently-admitted', size: 'small' },
  { id: 'walks-today', size: 'small' },
  { id: 'my-tasks', size: 'small' },
  { id: 'upcoming-outcomes', size: 'small' },
  { id: 'vaccinations-expiring', size: 'small' },
]

const widgetLabels: Record<string, string> = {
  'medical-today': 'medicalToday',
  'feeding-today': 'feedingToday',
  'tasks': 'tasks',
  'shelter-stats': 'shelterStats',
  'occupancy': 'occupancy',
  'recently-admitted': 'recentlyAdmitted',
  'walks-today': 'walksToday',
  'my-tasks': 'myTasks',
  'upcoming-outcomes': 'upcomingOutcomes',
  'vaccinations-expiring': 'vaccinationsExpiring',
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
  'my-tasks': MyTasksWidget,
  'upcoming-outcomes': UpcomingOutcomesWidget,
  'vaccinations-expiring': VaccinationsExpiringWidget,
}

interface SortableWidgetProps {
  widget: WidgetConfig
  editMode: boolean
  onRemove: () => void
}

function SortableWidget({ widget, editMode, onRemove }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const WidgetComponent = widgetComponents[widget.id as keyof typeof widgetComponents]

  if (!WidgetComponent) {
    return null
  }

  return (
    <div ref={setNodeRef} style={style} className={widget.size === 'large' ? 'md:col-span-2' : ''}>
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
      const oldIndex = dashboardWidgets.findIndex(w => w.id === active.id)
      const newIndex = dashboardWidgets.findIndex(w => w.id === over.id)
      setDashboardWidgets(arrayMove(dashboardWidgets, oldIndex, newIndex))
    }
  }

  const handleRemoveWidget = (widgetId: string) => {
    setDashboardWidgets(dashboardWidgets.filter(w => w.id !== widgetId))
  }

  const hiddenWidgets = ALL_WIDGETS.filter(w => !dashboardWidgets.some(dw => dw.id === w.id))

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={dashboardWidgets.map(w => w.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardWidgets.map((widget) => (
            <SortableWidget
              key={widget.id}
              widget={widget}
              editMode={dashboardEditMode}
              onRemove={() => handleRemoveWidget(widget.id)}
            />
          ))}
        </div>
      </SortableContext>

      {dashboardEditMode && hiddenWidgets.length > 0 && (
        <div className="mt-4 p-4 border border-dashed rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">{t('hiddenWidgets')}</p>
          <div className="flex flex-wrap gap-2">
            {hiddenWidgets.map(w => (
              <Button
                key={w.id}
                variant="outline"
                size="sm"
                onClick={() => setDashboardWidgets([...dashboardWidgets, { id: w.id, size: w.size }])}
              >
                <Plus className="h-3 w-3 mr-1" />
                {t(widgetLabels[w.id] as any)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </DndContext>
  )
}
