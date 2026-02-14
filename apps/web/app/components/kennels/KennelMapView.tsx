'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import ApiClient, { Kennel, Animal } from '@/app/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

interface KennelMapViewProps {
  kennels: Kennel[];
  allAnimals: Animal[];
  onPositionSaved?: () => void;
}

// Box dimensions by size_category (px)
const SIZE_DIMS: Record<string, { w: number; h: number }> = {
  small:  { w: 100, h: 80  },
  medium: { w: 160, h: 120 },
  large:  { w: 240, h: 160 },
  xlarge: { w: 320, h: 200 },
};

const CANVAS_MIN_W = 1200;
const CANVAS_MIN_H = 700;
const GAP = 24;
const COLS = 5;

interface KennelPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getDefaultPos(kennel: Kennel, index: number): KennelPos {
  const dims = SIZE_DIMS[kennel.size_category] ?? SIZE_DIMS.medium;
  // If DB has explicit map position, use it
  if (kennel.map_x !== 0 || kennel.map_y !== 0) {
    return {
      x: kennel.map_x,
      y: kennel.map_y,
      w: kennel.map_w > 0 ? kennel.map_w : dims.w,
      h: kennel.map_h > 0 ? kennel.map_h : dims.h,
    };
  }
  // Auto-layout grid
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return {
    x: col * (dims.w + GAP) + GAP,
    y: row * (dims.h + GAP) + GAP,
    w: dims.w,
    h: dims.h,
  };
}

const STATUS_BORDER: Record<string, string> = {
  available:   'border-l-green-500',
  maintenance: 'border-l-yellow-500',
  closed:      'border-l-red-500',
};

// ---- Single draggable kennel box ----
function DraggableKennelBox({
  kennel,
  pos,
  animalsInKennel,
}: {
  kennel: Kennel;
  pos: KennelPos;
  animalsInKennel: Animal[];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: kennel.id,
    data: { kennel },
  });

  const style = {
    position: 'absolute' as const,
    left: pos.x,
    top: pos.y,
    width: pos.w,
    height: pos.h,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const borderClass = STATUS_BORDER[kennel.status] ?? 'border-l-gray-400';
  const occupancyPct = kennel.capacity > 0
    ? Math.min(100, Math.round((kennel.occupied_count / kennel.capacity) * 100))
    : 0;

  return (
    <motion.div
      layoutId={`kennel-${kennel.id}`}
      style={style}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-lg border border-l-4 bg-card shadow-md select-none flex flex-col overflow-hidden ${borderClass}`}
    >
      {/* Header */}
      <div className="px-2 py-1.5 flex items-center justify-between gap-1 border-b bg-muted/40">
        <Link
          href={`/dashboard/kennels/${kennel.id}`}
          className="text-sm font-bold hover:underline hover:text-primary truncate"
          onClick={e => e.stopPropagation()}
        >
          {kennel.code}
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          {animalsInKennel.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {animalsInKennel.length}
            </span>
          )}
          <Badge className="text-xs px-1.5 py-0">
            {kennel.occupied_count}/{kennel.capacity}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-2 py-1 flex flex-col justify-between min-h-0">
        <p className="text-xs text-muted-foreground truncate">{kennel.name}</p>

        {/* Mini occupancy bar */}
        <div className="mt-auto">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                occupancyPct >= 100 ? 'bg-red-500' :
                occupancyPct >= 80  ? 'bg-yellow-500' :
                occupancyPct > 0    ? 'bg-green-500' : 'bg-gray-300'
              }`}
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
          {animalsInKennel.length > 0 && (
            <p className="text-xs font-medium mt-0.5 truncate">
              {animalsInKennel.slice(0, 2).map(a => a.name).join(', ')}
              {animalsInKennel.length > 2 && <span className="text-muted-foreground"> +{animalsInKennel.length - 2}</span>}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---- Main map view ----
export default function KennelMapView({ kennels, allAnimals, onPositionSaved }: KennelMapViewProps) {
  // Build local position state from kennel data
  const [positions, setPositions] = useState<Record<string, KennelPos>>(() => {
    const init: Record<string, KennelPos> = {};
    kennels.forEach((k, i) => {
      init[k.id] = getDefaultPos(k, i);
    });
    return init;
  });

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, delta } = event;
    const kennelId = active.id as string;

    // Use functional update to get current position and compute new position atomically
    let savedPos: KennelPos | null = null;
    setPositions(prev => {
      const old = prev[kennelId];
      if (!old) return prev;
      const updated: KennelPos = {
        ...old,
        x: Math.max(0, Math.round(old.x + delta.x)),
        y: Math.max(0, Math.round(old.y + delta.y)),
      };
      savedPos = updated;
      return { ...prev, [kennelId]: updated };
    });

    // Save after state update using the computed position
    setTimeout(async () => {
      if (!savedPos) return;
      try {
        await ApiClient.updateKennelMapPosition(kennelId, {
          map_x: savedPos.x,
          map_y: savedPos.y,
          map_w: savedPos.w,
          map_h: savedPos.h,
        });
        toast.success('Poloha uložena');
        onPositionSaved?.();
      } catch {
        toast.error('Nepodařilo se uložit polohu');
      }
    }, 0);
  }, [onPositionSaved]);

  // Compute canvas size to fit all boxes
  const canvasW = Math.max(
    CANVAS_MIN_W,
    ...Object.values(positions).map(p => p.x + p.w + GAP)
  );
  const canvasH = Math.max(
    CANVAS_MIN_H,
    ...Object.values(positions).map(p => p.y + p.h + GAP)
  );

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div
        className="relative overflow-auto rounded-lg border bg-muted/20"
        style={{ minHeight: CANVAS_MIN_H }}
      >
        {/* Dotted grid background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground)/0.3) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            width: canvasW,
            height: canvasH,
          }}
        />

        {/* Kennel boxes */}
        <div style={{ position: 'relative', width: canvasW, height: canvasH }}>
          {kennels.map(kennel => {
            const pos = positions[kennel.id];
            if (!pos) return null;
            const animalsInKennel = allAnimals.filter(a => a.current_kennel_id === kennel.id);
            return (
              <DraggableKennelBox
                key={kennel.id}
                kennel={kennel}
                pos={pos}
                animalsInKennel={animalsInKennel}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border-l-2 border-l-green-500 bg-card inline-block" />
          Dostupný
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border-l-2 border-l-yellow-500 bg-card inline-block" />
          Údržba
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border-l-2 border-l-red-500 bg-card inline-block" />
          Uzavřen
        </span>
        <span className="ml-auto">Přetáhněte kotec pro změnu polohy</span>
      </div>
    </DndContext>
  );
}
