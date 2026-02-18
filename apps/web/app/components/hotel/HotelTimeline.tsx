'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Loader2, AlertTriangle, BedDouble, Dog, Cat, Bird, Rabbit 
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ApiClient, { KennelTimelineData, KennelTimelineStay } from '@/app/lib/api';
import Image from 'next/image';

const CELL_WIDTH = 32;
const LANE_HEIGHT = 44;
const HEADER_HEIGHT = 60;
const LEFT_COL_WIDTH = 180;

const SPECIES_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  dog: { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-blue-600' },
  cat: { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-orange-600' },
  other: { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-emerald-600' },
};

const SPECIES_ICONS: Record<string, typeof Rabbit> = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  other: Rabbit,
};

function getSpeciesColor(species: string) {
  return SPECIES_COLORS[species] || SPECIES_COLORS.other;
}

interface HotelStay extends KennelTimelineStay {
  lane?: number;
  has_conflict?: boolean;
}

function detectConflicts(stays: HotelStay[]): HotelStay[] {
  const sorted = [...stays].sort((a, b) => 
    new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );
  
  const result: HotelStay[] = [];
  const conflictingIds = new Set<string>();
  
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    
    for (let j = i + 1; j < sorted.length; j++) {
      const compare = sorted[j];
      const currentStart = new Date(current.start_at);
      const currentEnd = current.end_at ? new Date(current.end_at) : null;
      const compareStart = new Date(compare.start_at);
      const compareEnd = compare.end_at ? new Date(compare.end_at) : null;
      
      if (currentEnd && compareEnd && currentStart < compareEnd && currentEnd > compareStart) {
        conflictingIds.add(compare.id);
      }
    }
  }
  
  for (const stay of stays) {
    if (conflictingIds.has(stay.id)) continue;
    
    let hasConflict = false;
    for (const other of stays) {
      if (other.id === stay.id) continue;
      if (conflictingIds.has(other.id)) continue;
      
      const stayStart = new Date(stay.start_at);
      const stayEnd = stay.end_at ? new Date(stay.end_at) : null;
      const otherStart = new Date(other.start_at);
      const otherEnd = other.end_at ? new Date(other.end_at) : null;
      
      if (stayEnd && otherEnd && stayStart < otherEnd && stayEnd > otherStart) {
        hasConflict = true;
        break;
      }
    }
    
    result.push({ ...stay, has_conflict: hasConflict });
  }
  
  return result;
}

function packHotelStaysIntoLanes(stays: HotelStay[], capacity: number) {
  const safeStays = detectConflicts(stays);
  const lanes: HotelStay[][] = Array.from({ length: capacity }, () => []);
  
  for (const stay of safeStays) {
    const startDate = new Date(stay.start_at);
    const endDate = stay.end_at ? new Date(stay.end_at) : null;
    
    let placed = false;
    for (let laneIdx = 0; laneIdx < capacity; laneIdx++) {
      const lane = lanes[laneIdx];
      
      const canPlace = lane.every(existing => {
        const existingStart = new Date(existing.start_at);
        const existingEnd = existing.end_at ? new Date(existing.end_at) : null;
        
        if (existingEnd === null) return false;
        if (endDate === null) return false;
        
        return !(startDate < existingEnd && endDate > existingStart);
      });
      
      if (canPlace) {
        lane.push({ ...stay, lane: laneIdx });
        placed = true;
        break;
      }
    }
    
    if (!placed) {
      const minOverlapLane = lanes.reduce((minIdx, lane, idx) => {
        let overlapCount = 0;
        for (const existing of lane) {
          const existingStart = new Date(existing.start_at);
          const existingEnd = existing.end_at ? new Date(existing.end_at) : null;
          
          if (existingEnd === null || endDate === null) {
            overlapCount++;
            continue;
          }
          
          if (startDate < existingEnd && endDate > existingStart) {
            overlapCount++;
          }
        }
        
        const minOverlap = lanes[minIdx].reduce((count, ex) => {
          const exStart = new Date(ex.start_at);
          const exEnd = ex.end_at ? new Date(ex.end_at) : null;
          if (exEnd === null || endDate === null) return count + 1;
          if (startDate < exEnd && endDate > exStart) return count + 1;
          return count;
        }, 0);
        
        return overlapCount < minOverlap ? idx : minIdx;
      }, 0);
      
      lanes[minOverlapLane].push({ ...stay, lane: minOverlapLane });
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

export default function HotelTimeline() {
  const t = useTranslations('hotel');
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
  
  const hotelData = useMemo(() => {
    if (!data) return null;
    
    const hotelKennels = data.kennels.map(kennel => ({
      ...kennel,
      stays: kennel.stays.filter(stay => stay.is_hotel),
    })).filter(kennel => kennel.stays.length > 0);
    
    return {
      from_date: data.from_date,
      to_date: data.to_date,
      kennels: hotelKennels,
    };
  }, [data]);
  
  const dates = useMemo(() => {
    if (!hotelData) return [];
    return generateDateRange(hotelData.from_date, hotelData.to_date);
  }, [hotelData]);
  
  const processedKennels = useMemo(() => {
    if (!hotelData) return [];
    
    return hotelData.kennels.map(kennel => ({
      ...kennel,
      laneData: packHotelStaysIntoLanes(kennel.stays, Math.max(1, kennel.capacity || 1)),
    }));
  }, [hotelData]);
  
  const getStayPosition = (stay: HotelStay) => {
    if (!hotelData) return { left: 0, width: 0 };
    
    const startDate = new Date(stay.start_at);
    const endDate = stay.end_at ? new Date(stay.end_at) : new Date(hotelData.to_date);
    
    const viewStart = new Date(hotelData.from_date);
    
    const startOffset = Math.max(0, Math.floor((startDate.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24)));
    const duration = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    return {
      left: startOffset * CELL_WIDTH,
      width: duration * CELL_WIDTH,
      isOngoing: !stay.end_at,
    };
  };
  
  const getNowPosition = () => {
    if (!hotelData || dates.length === 0) return -1;
    const viewStart = new Date(hotelData.from_date);
    const daysSinceStart = Math.floor((today.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceStart < 0 || daysSinceStart >= dates.length) return -1;
    return daysSinceStart * CELL_WIDTH + CELL_WIDTH / 2;
  };
  
  const nowPos = getNowPosition();
  
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
  
  if (!hotelData || hotelData.kennels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Žádné hotelové rezervace k zobrazení</p>
      </div>
    );
  }
  
  return (
    <TooltipProvider delayDuration={200}>
      <div className="border rounded-lg overflow-hidden bg-background">
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
                <div 
                  className="sticky left-0 z-10 flex-shrink-0 bg-background border-r flex flex-col justify-center"
                  style={{ width: LEFT_COL_WIDTH, minHeight: rows * LANE_HEIGHT }}
                >
                  <div className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-4 w-4 text-primary" />
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
                
                <div 
                  className="relative flex"
                  style={{ width: dates.length * CELL_WIDTH, minHeight: rows * LANE_HEIGHT }}
                >
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
                  
                  {nowPos > 0 && (
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                      style={{ left: nowPos }}
                    >
                      <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-red-500" />
                    </div>
                  )}
                  
                  {kennel.laneData.map((lane, laneIdx) => 
                    lane.map((stay) => {
                      const pos = getStayPosition(stay);
                      const colors = getSpeciesColor(stay.animal_species);
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
                              }}
                              onMouseEnter={() => setHoveredStay(stay.id)}
                              onMouseLeave={() => setHoveredStay(null)}
                            >
                              {stay.animal_photo_url && (
                                <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                                  <Image
                                    src={stay.animal_photo_url}
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
                              </div>
                              <div className="text-xs">
                                {new Date(stay.start_at).toLocaleDateString('cs-CZ')}
                                {' → '}
                                {stay.end_at 
                                  ? new Date(stay.end_at).toLocaleDateString('cs-CZ')
                                  : 'dosud'}
                              </div>
                              {stay.has_conflict && (
                                <div className="text-xs text-red-500 font-medium">
                                  ⚠️ Konflikt - překryv s jinou rezervací
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
      </div>
    </TooltipProvider>
  );
}
