'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import ApiClient, { Kennel, Animal } from '@/app/lib/api';
import { getAnimalImageUrl } from '@/app/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

interface KennelMapViewProps {
  kennels: Kennel[];
  allAnimals: Animal[];
  onPositionSaved?: () => void;
}

interface KennelPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FreeAnimalPos {
  x: number;
  y: number;
}

const FREE_ANIMALS_LS_KEY = 'kennel-map-free-animals';

// 1 meter = 60 pixels on the map canvas
const PIXELS_PER_METER = 60;
// Default size if kennel has no dimensions specified
const DEFAULT_KENNEL_M = 2;
// Minimum pixel size so tiny kennels are still usable
const MIN_KENNEL_PX_W = 80;
const MIN_KENNEL_PX_H = 70;

const CANVAS_MIN_W = 1200;
const CANVAS_MIN_H = 700;
const GAP = 24;
const COLS = 5;

function getKennelDims(kennel: Kennel): { w: number; h: number } {
  const lengthCm = kennel.dimensions?.length;
  const widthCm  = kennel.dimensions?.width;
  const lengthM  = lengthCm !== undefined ? lengthCm / 100 : DEFAULT_KENNEL_M;
  const widthM   = widthCm  !== undefined ? widthCm  / 100 : DEFAULT_KENNEL_M;
  return {
    w: Math.max(MIN_KENNEL_PX_W, Math.round(lengthM * PIXELS_PER_METER)),
    h: Math.max(MIN_KENNEL_PX_H, Math.round(widthM  * PIXELS_PER_METER)),
  };
}

function getDefaultPos(kennel: Kennel, index: number): KennelPos {
  const dims = getKennelDims(kennel);
  if (kennel.map_x !== 0 || kennel.map_y !== 0) {
    return {
      x: kennel.map_x,
      y: kennel.map_y,
      w: kennel.map_w > 0 ? kennel.map_w : dims.w,
      h: kennel.map_h > 0 ? kennel.map_h : dims.h,
    };
  }
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return {
    x: col * (dims.w + GAP) + GAP,
    y: row * (dims.h + GAP) + GAP,
    w: dims.w,
    h: dims.h,
  };
}

// ---- Animal avatar circle (draggable) ----
function AnimalAvatar({ animal }: { animal: Animal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `animal-${animal.id}`,
    data: { type: 'animal', animal },
  });

  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 200 : undefined,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex flex-col items-center gap-0.5 touch-none select-none"
      title={animal.name}
    >
      <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-background shadow-sm ring-1 ring-border">
        <img
          src={getAnimalImageUrl(animal)}
          alt={animal.name}
          className="w-full h-full object-cover"
        />
      </div>
      <span className="text-[9px] font-medium max-w-[44px] truncate text-center leading-tight">
        {animal.name}
      </span>
    </div>
  );
}

// ---- Kennel box (draggable header + droppable body) ----
function DraggableKennelBox({
  kennel,
  pos,
  animalsInKennel,
}: {
  kennel: Kennel;
  pos: KennelPos;
  animalsInKennel: Animal[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: kennel.id,
    data: { type: 'kennel', kennel },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `kennel-drop-${kennel.id}`,
    data: { type: 'kennel-drop', kennelId: kennel.id },
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
  };

  const borderClass =
    kennel.status === 'maintenance'
      ? 'border-l-yellow-500'
      : kennel.status === 'closed'
      ? 'border-l-red-500'
      : 'border-l-green-500';

  return (
    <div
      ref={setDragRef}
      style={style}
      className={`rounded-lg border border-l-4 bg-card shadow-md flex flex-col overflow-hidden ${borderClass} ${isOver ? 'ring-2 ring-primary ring-offset-1' : ''}`}
      title={`${kennel.dimensions?.length ?? '?'}cm × ${kennel.dimensions?.width ?? '?'}cm`}
    >
      {/* Header — kennel drag handle only */}
      <div
        {...listeners}
        {...attributes}
        className="px-2 py-1.5 flex items-center justify-between gap-1 border-b bg-muted/40 cursor-grab active:cursor-grabbing"
      >
        <Link
          href={`/dashboard/kennels/${kennel.id}`}
          className="text-sm font-bold hover:underline hover:text-primary truncate"
          onClick={e => e.stopPropagation()}
        >
          {kennel.code}
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <Badge className="text-xs px-1.5 py-0">
            {kennel.occupied_count}/{kennel.capacity}
          </Badge>
        </div>
      </div>

      {/* Body — animal photo circles + droppable */}
      <div
        ref={setDropRef}
        className="flex-1 px-2 py-1.5 flex flex-col min-h-0 overflow-hidden"
      >
        {animalsInKennel.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 content-start overflow-hidden">
            {animalsInKennel.map(a => (
              <AnimalAvatar key={a.id} animal={a} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground truncate">{kennel.name}</p>
        )}

      </div>
    </div>
  );
}

// ---- Free animal token on canvas ----
function FreeAnimalToken({ animal, pos }: { animal: Animal; pos: FreeAnimalPos }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `animal-${animal.id}`,
    data: { type: 'animal', animal },
  });

  const style = {
    position: 'absolute' as const,
    left: pos.x,
    top: pos.y,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 200 : 10,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex flex-col items-center gap-0.5 touch-none select-none"
      title={animal.name}
    >
      <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-background shadow-md ring-1 ring-border">
        <img
          src={getAnimalImageUrl(animal)}
          alt={animal.name}
          className="w-full h-full object-cover"
        />
      </div>
      <span className="text-[9px] font-medium max-w-[52px] truncate text-center leading-tight bg-background/80 px-1 rounded">
        {animal.name}
      </span>
    </div>
  );
}

// ---- Main map view ----
export default function KennelMapView({ kennels, allAnimals, onPositionSaved }: KennelMapViewProps) {
  const t = useTranslations('kennels.map');

  const [positions, setPositions] = useState<Record<string, KennelPos>>(() => {
    const init: Record<string, KennelPos> = {};
    kennels.forEach((k, i) => {
      init[k.id] = getDefaultPos(k, i);
    });
    return init;
  });

  // Free animal positions (visually placed outside their kennel box on the canvas)
  const [freeAnimalPositions, setFreeAnimalPositions] = useState<Record<string, FreeAnimalPos>>({});

  // Load free positions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FREE_ANIMALS_LS_KEY);
      if (stored) setFreeAnimalPositions(JSON.parse(stored));
    } catch {}
  }, []);

  // Persist free positions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FREE_ANIMALS_LS_KEY, JSON.stringify(freeAnimalPositions));
    } catch {}
  }, [freeAnimalPositions]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, delta, over } = event;
    const dragType = (active.data.current as any)?.type;

    if (dragType === 'kennel') {
      // Reposition kennel box
      const kennelId = active.id as string;
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
      setTimeout(async () => {
        if (!savedPos) return;
        try {
          await ApiClient.updateKennelMapPosition(kennelId, {
            map_x: savedPos.x,
            map_y: savedPos.y,
            map_w: savedPos.w,
            map_h: savedPos.h,
          });
          onPositionSaved?.();
        } catch {
          toast.error(t('positionError'));
        }
      }, 0);
    } else if (dragType === 'animal') {
      // Animal repositioning
      const animal = (active.data.current as any).animal as Animal;
      const animalId = animal.id;
      const overDropType = (over?.data?.current as any)?.type;

      if (overDropType === 'kennel-drop') {
        const targetKennelId = (over?.data?.current as any)?.kennelId as string;
        setFreeAnimalPositions(prev => { const next = { ...prev }; delete next[animalId]; return next; });
        try {
          await ApiClient.moveAnimal({ animal_id: animalId, target_kennel_id: targetKennelId });
          toast.success(t('animalMoved'));
          onPositionSaved?.();
        } catch {
          toast.error(t('animalMoveError'));
        }
      } else {
        // Dropped on canvas → set/update free position
        setFreeAnimalPositions(prev => {
          const existing = prev[animalId];
          if (existing) {
            // Update existing free position
            return {
              ...prev,
              [animalId]: {
                x: Math.max(0, Math.round(existing.x + delta.x)),
                y: Math.max(0, Math.round(existing.y + delta.y)),
              },
            };
          }
          // First time dragging out — calculate absolute position from kennel
          const kennel = kennels.find(k => k.id === animal.current_kennel_id);
          const kennelPos = kennel ? positions[kennel.id] : null;
          const startX = kennelPos ? kennelPos.x + 20 : 100;
          const startY = kennelPos ? kennelPos.y + kennelPos.h + 10 : 100;
          return {
            ...prev,
            [animalId]: {
              x: Math.max(0, Math.round(startX + delta.x)),
              y: Math.max(0, Math.round(startY + delta.y)),
            },
          };
        });
      }
    }
  }, [kennels, positions, onPositionSaved, t]);

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

        {/* Canvas */}
        <div style={{ position: 'relative', width: canvasW, height: canvasH }}>
          {/* Kennel boxes */}
          {kennels.map((kennel) => {
            const pos = positions[kennel.id];
            if (!pos) return null;
            // Animals in this kennel that are not currently "ejected" to free canvas
            const animalsInKennel = allAnimals.filter(
              a => a.current_kennel_id === kennel.id && !freeAnimalPositions[a.id]
            );
            return (
              <DraggableKennelBox
                key={kennel.id}
                kennel={kennel}
                pos={pos}
                animalsInKennel={animalsInKennel}
              />
            );
          })}

          {/* Free animal tokens (ejected from kennel boxes) */}
          {Object.entries(freeAnimalPositions).map(([animalId, freePos]) => {
            const animal = allAnimals.find(a => a.id === animalId);
            if (!animal) return null;
            return <FreeAnimalToken key={animalId} animal={animal} pos={freePos} />;
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border-l-2 border-l-green-500 bg-card inline-block" />
          {t('legendAvailable')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border-l-2 border-l-yellow-500 bg-card inline-block" />
          {t('legendMaintenance')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border-l-2 border-l-red-500 bg-card inline-block" />
          {t('legendClosed')}
        </span>
        <span className="ml-auto">{t('dragHint')}</span>
      </div>
    </DndContext>
  );
}
