'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Loader2, ChevronLeft, ChevronRight, 
  AlertTriangle, BedDouble, Dog, Cat, Bird, Rabbit 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ApiClient, { KennelTimelineData, KennelTimelineStay } from '@/app/lib/api';
import Image from 'next/image';
import { getAnimalImageUrl } from '@/app/lib/utils';

const CELL_WIDTH = 32;
const LANE_HEIGHT = 44;
const HEADER_HEIGHT = 60;
const LEFT_COL_WIDTH = 180;

const SPECIES_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  // Shelter animals (světlejší)
  dog: { bg: 'bg-blue-400', border: 'border-blue-500', text: 'text-blue-600' },
  cat: { bg: 'bg-orange-400', border: 'border-orange-500', text: 'text-orange-600' },
  other: { bg: 'bg-emerald-400', border: 'border-emerald-500', text: 'text-emerald-600' },
  // Hotel animals (tmavší)
  dog_hotel: { bg: 'bg-blue-700', border: 'border-blue-800', text: 'text-blue-100' },
  cat_hotel: { bg: 'bg-orange-700', border: 'border-orange-800', text: 'text-orange-100' },
  other_hotel: { bg: 'bg-emerald-700', border: 'border-emerald-800', text: 'text-emerald-100' },
};

const SPECIES_ICONS: Record<string, typeof Rabbit> = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  other: Rabbit,
};

function getSpeciesColor(species: string, isHotel: boolean = false) {
  const key = isHotel ? `${species}_hotel` : species;
  const base = SPECIES_COLORS[key] || SPECIES_COLORS[species] || SPECIES_COLORS.other;
  return { ...base, badge: isHotel };
}

function doStaysOverlap(stay1: KennelTimelineStay, stay2: KennelTimelineStay): boolean {
  const start1 = new Date(stay1.start_at).getTime();
  const end1 = stay1.end_at ? new Date(stay1.end_at).getTime() : null;
  const start2 = new Date(stay2.start_at).getTime();
  const end2 = stay2.end_at ? new Date(stay2.end_at).getTime() : null;
  
  // Both ongoing - they overlap
  if (end1 === null && end2 === null) return true;
  
  // Stay1 ongoing, stay2 has end - overlap if stay2 is still active when stay1 started
  if (end1 === null && end2 !== null) return start1 < end2;
  
  // Stay1 has end, stay2 ongoing - overlap if stay1 is still active when stay2 started  
  if (end1 !== null && end2 === null) return end1 > start2;
  
  // Both have end times - standard overlap check
  if (end1 !== null && end2 !== null) {
    return start1 < end2 && end1 > start2;
  }
  return false;
}

function packStaysIntoLanes(stays: KennelTimelineStay[], capacity: number) {
  const lanes: KennelTimelineStay[][] = Array.from({ length: capacity }, () => []);
  
  for (const stay of stays) {
    const startDate = new Date(stay.start_at);
    const endDate = stay.end_at ? new Date(stay.end_at) : null;
    
    let placed = false;
    for (let laneIdx = 0; laneIdx < capacity; laneIdx++) {
      const lane = lanes[laneIdx];
      
      const canPlace = lane.every(existing => {
        const existingStart = new Date(existing.start_at);
        const existingEnd = existing.end_at ? new Date(existing.end_at) : null;
        
        // Different animals - only check time overlap
        if (stay.animal_id !== existing.animal_id) {
          // No overlap = can share lane
          if (endDate === null && existingEnd === null) return false; // both ongoing - can't share
          if (endDate === null) return existingEnd !== null && startDate < existingEnd; // stay ongoing, check vs existing end
          if (existingEnd === null) return endDate !== null && endDate > existingStart; // existing ongoing, check vs stay end
          // Both have ends - check overlap
          return !(startDate < existingEnd && endDate > existingStart);
        }
        
        // Same animal - check time overlap (allow if no time overlap)
        return !doStaysOverlap(stay, existing);
      });
      
      if (canPlace) {
        lane.push({ ...stay, lane: laneIdx });
        placed = true;
        break;
      }
    }
    
    if (!placed) {
      // Find lane with minimum time overlap
      const minOverlapLane = lanes.reduce((minIdx, lane, idx, arr) => {
        let overlapCount = 0;
        for (const existing of lane) {
          if (doStaysOverlap(stay, existing)) {
            overlapCount++;
          }
        }
        
        const minOverlap = arr[minIdx].reduce((count, ex) => {
          return doStaysOverlap(stay, ex) ? count + 1 : count;
        }, 0);
        
        return overlapCount < minOverlap ? idx : minIdx;
      }, 0);
      
      // Only mark as conflict if there's actual time overlap
      const hasTimeOverlap = lanes[minOverlapLane].some(existing => doStaysOverlap(stay, existing));
      lanes[minOverlapLane].push({ ...stay, lane: minOverlapLane, has_conflict: hasTimeOverlap });
    }
  }
  
  return lanes;
}

function generateDateRange(from: string, to: string): Date[] {
  const dates: Date[] = [];
  const current = new Date(from);
  const end = new Date(to);
  
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

export default function KennelTimeline() {
  const t = useTranslations('kennels');
  const [data, setData] = useState<KennelTimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredStay, setHoveredStay] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  
  const today = useMemo(() => new Date(), []);
  today.setHours(0, 0, 0, 0);
  
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const timelineData = await ApiClient.getStaysTimeline();
        setData(timelineData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load timeline');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);
  
  const dates = useMemo(() => {
    if (!data) return [];
    return generateDateRange(data.from_date, data.to_date);
  }, [data]);
  
  const processedKennels = useMemo(() => {
    if (!data) return [];
    
    return data.kennels.map(kennel => ({
      ...kennel,
      laneData: packStaysIntoLanes(kennel.stays, kennel.capacity || 1),
    }));
  }, [data]);
  
  const getStayPosition = (stay: KennelTimelineStay) => {
    if (!data) return { left: 0, width: 0 };
    
    const startDate = new Date(stay.start_at);
    const endDate = stay.end_at ? new Date(stay.end_at) : new Date(data.to_date);
    
    const viewStart = new Date(data.from_date);
    const viewEnd = new Date(data.to_date);
    
    const startOffset = Math.max(0, Math.floor((startDate.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24)));
    const duration = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    return {
      left: startOffset * CELL_WIDTH,
      width: duration * CELL_WIDTH,
      isOngoing: !stay.end_at,
    };
  };
  
  const getNowPosition = () => {
    if (!data) return -1;
    const viewStart = new Date(data.from_date);
    const daysSinceStart = Math.floor((today.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceStart < 0 || daysSinceStart >= dates.length) return -1;
    return daysSinceStart * CELL_WIDTH + CELL_WIDTH / 2;
  };
  
  const nowPos = getNowPosition();
  
  const getAnimalPhoto = (stay: KennelTimelineStay) => {
    if (stay.animal_photo_url) return stay.animal_photo_url;
    return null;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <AlertTriangle className="h-5 w-5 mr-2" />
        {error}
      </div>
    );
  }
  
  if (!data || data.kennels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Žádné kotce k zobrazení</p>
      </div>
    );
  }
  
  return (
    <TooltipProvider delayDuration={200}>
      <div className="border rounded-lg overflow-hidden bg-background">
        {/* Header with dates */}
        <div 
          className="sticky top-0 z-20 bg-background border-b flex"
          style={{ marginLeft: LEFT_COL_WIDTH, height: HEADER_HEIGHT }}
        >
          <div 
            className="flex border-r overflow-hidden"
            style={{ width: dates.length * CELL_WIDTH }}
          >
            {dates.map((date, idx) => {
              const isToday = date.toDateString() === today.toDateString();
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center justify-center text-xs border-r",
                    isToday && "bg-primary/10 font-semibold",
                    isWeekend && "bg-muted/50",
                    hoveredCol === idx && "bg-muted"
                  )}
                  style={{ width: CELL_WIDTH, height: HEADER_HEIGHT }}
                  onMouseEnter={() => setHoveredCol(idx)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  <span className={cn("text-[10px]", isToday && "text-primary")}>
                    {date.toLocaleDateString('cs-CZ', { weekday: 'short' })}
                  </span>
                  <span className={cn("font-medium", isToday && "text-primary")}>
                    {date.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Timeline rows */}
        <div className="overflow-auto max-h-[calc(100vh-200px)]">
          {processedKennels.map((kennel) => {
            const rows = Math.max(1, kennel.capacity || 1);
            
            return (
              <div 
                key={kennel.kennel_id}
                className={cn(
                  "flex border-b",
                  hoveredRow === kennel.kennel_id && "bg-muted/30"
                )}
                onMouseEnter={() => setHoveredRow(kennel.kennel_id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Left column - Kennel info */}
                <div 
                  className="sticky left-0 z-10 flex-shrink-0 bg-background border-r flex flex-col justify-center"
                  style={{ width: LEFT_COL_WIDTH, minHeight: rows * LANE_HEIGHT }}
                >
                  <div className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      {kennel.zone_color && (
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: kennel.zone_color }}
                        />
                      )}
                      <span className="font-medium text-sm truncate">
                        {kennel.kennel_name}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{kennel.kennel_code}</span>
                      <span>·</span>
                      <span>{kennel.capacity} {kennel.capacity === 1 ? 'místo' : 'míst'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Timeline cells */}
                <div 
                  className="relative flex"
                  style={{ width: dates.length * CELL_WIDTH, minHeight: rows * LANE_HEIGHT }}
                >
                  {/* Grid lines */}
                  {dates.map((_, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex-shrink-0 border-r h-full",
                        idx % 7 === 6 && "border-r-2"
                      )}
                      style={{ width: CELL_WIDTH }}
                    />
                  ))}
                  
                  {/* Now line */}
                  {nowPos > 0 && (
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                      style={{ left: nowPos }}
                    >
                      <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-red-500" />
                    </div>
                  )}
                  
                  {/* Maintenance bar */}
                  {kennel.maintenance_start_at && (
                    (() => {
                      const maintStart = new Date(kennel.maintenance_start_at);
                      const maintEnd = kennel.maintenance_end_at ? new Date(kennel.maintenance_end_at) : null;
                      const viewStart = new Date(data!.from_date);
                      const viewEnd = new Date(data!.to_date);
                      
                      // Calculate position only if maintenance overlaps with view
                      if (maintEnd && maintEnd < viewStart) return null;
                      if (maintStart > viewEnd) return null;
                      
                      const startOffset = Math.max(0, Math.floor((maintStart.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24)));
                      const endDate = maintEnd || viewEnd;
                      const duration = Math.max(1, Math.floor((endDate.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24)) - startOffset);
                      
                      const isActive = maintStart <= today && (!maintEnd || maintEnd >= today);
                      
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "absolute h-full rounded-md flex items-center justify-center z-0",
                                isActive ? "bg-yellow-400/40" : "bg-yellow-200/30",
                                isActive && "animate-pulse"
                              )}
                              style={{
                                left: startOffset * CELL_WIDTH,
                                width: duration * CELL_WIDTH,
                              }}
                            >
                              <span className={cn(
                                "text-xs font-bold rotate-[-45deg] whitespace-nowrap",
                                isActive ? "text-yellow-700" : "text-yellow-600/70"
                              )}>
                                🔧
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <div className="font-semibold flex items-center gap-1">
                                🔧 {t('maintenance.title') || 'Rekonstrukce'}
                              </div>
                              <div>
                                {t('maintenance.from') || 'Od'}: {maintStart.toLocaleDateString('cs-CZ')}
                              </div>
                              {maintEnd && (
                                <div>
                                  {t('maintenance.to') || 'Do'}: {maintEnd.toLocaleDateString('cs-CZ')}
                                </div>
                              )}
                              {kennel.maintenance_reason && (
                                <div className="text-muted-foreground">
                                  {kennel.maintenance_reason}
                                </div>
                              )}
                              {isActive && (
                                <div className="font-medium text-yellow-600">
                                  {t('maintenance.active') || 'Nyní v rekonstrukci'}
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()
                  )}
                  
                  {/* Stay bars */}
                  {kennel.laneData.map((lane, laneIdx) => 
                    lane.map((stay) => {
                      const pos = getStayPosition(stay);
                      const colors = getSpeciesColor(stay.animal_species, stay.is_hotel);
                      const AnimalIcon = SPECIES_ICONS[stay.animal_species] || Rabbit;
                      
                      return (
                        <Tooltip key={stay.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "absolute h-8 rounded-md flex items-center gap-1.5 px-2 cursor-pointer transition-all",
                                colors.bg,
                                "border-l-4",
                                colors.border,
                                stay.has_conflict && "ring-2 ring-red-500 ring-offset-1",
                                hoveredStay === stay.id && "scale-[1.02] shadow-lg z-10"
                              )}
                              style={{
                                left: pos.left,
                                width: pos.width - 4,
                                top: (stay.lane ?? laneIdx) * LANE_HEIGHT + (LANE_HEIGHT - 32) / 2,
                                opacity: pos.isOngoing ? 0.85 : 1,
                                background: pos.isOngoing 
                                  ? `linear-gradient(90deg, ${colors.bg} 0%, ${colors.bg}90 100%)`
                                  : colors.bg,
                              }}
                              onMouseEnter={() => setHoveredStay(stay.id)}
                              onMouseLeave={() => setHoveredStay(null)}
                            >
                              {getAnimalPhoto(stay) && (
                                <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                                  <Image
                                    src={getAnimalPhoto(stay)!}
                                    alt=""
                                    width={20}
                                    height={20}
                                    className="object-cover w-full h-full"
                                    unoptimized
                                  />
                                </div>
                              )}
                              <span className="text-white text-xs font-medium truncate">
                                {stay.animal_name}
                              </span>
                              {stay.is_hotel && (
                                <BedDouble className="w-3 h-3 text-white/80 flex-shrink-0" />
                              )}
                              {stay.has_conflict && (
                                <AlertTriangle className="w-3 h-3 text-white flex-shrink-0" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <div className="font-semibold">{stay.animal_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {stay.animal_public_code}
                              </div>
                              <div className="text-xs flex items-center gap-1">
                                <AnimalIcon className="w-3 h-3" />
                                {stay.animal_species}
                                {stay.is_hotel && <BedDouble className="w-3 h-3 ml-1" />}
                              </div>
                              <div className="text-xs font-mono">
                                {new Date(stay.start_at).toLocaleString('cs-CZ', { 
                                  day: '2-digit', month: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                                {' → '}
                                {stay.end_at 
                                  ? new Date(stay.end_at).toLocaleString('cs-CZ', { 
                                      day: '2-digit', month: '2-digit', year: 'numeric',
                                      hour: '2-digit', minute: '2-digit'
                                    })
                                  : '∞'
                                }
                              </div>
                              {stay.has_conflict && (
                                <div className="text-xs text-red-500 font-medium">
                                  ⚠️ Konflikt - překryv s jiným pobytem
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="border-t p-3 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>Pes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-orange-500" />
            <span>Kočka</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span>Jiné</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500/80 flex items-center justify-center">
              <BedDouble className="w-2 h-2 text-white" />
            </div>
            <span>Hotel</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-0.5 h-3 bg-red-500" />
            <span>Dnes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-300 ring-2 ring-red-500" />
            <span>Konflikt</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
