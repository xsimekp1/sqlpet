'use client'

import { DndContext, closestCenter, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useUIStore } from '@/stores/uiStore'
import { MedicalTodayWidget } from './MedicalTodayWidget'
import { FeedingTodayWidget } from './FeedingTodayWidget'
import { TasksWidget } from './TasksWidget'
import { AlertsWidget } from './AlertsWidget'
import { OccupancyWidget } from './OccupancyWidget'
import { RecentWidget } from './RecentWidget'

// Widget registry
const widgetComponents = {
  'medical-today': MedicalTodayWidget,
  'feeding-today': FeedingTodayWidget,
  'tasks': TasksWidget,
  'alerts': AlertsWidget,
  'occupancy': OccupancyWidget,
  'recent': RecentWidget,
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
    </DndContext>
  )
}
