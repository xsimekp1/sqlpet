'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ApiClient } from '@/app/lib/api';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Baby, LogIn, PersonStanding, Heart, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CalendarAnimal {
  id: string;
  name: string;
  primary_photo_url: string | null;
  current_intake_date: string | null;
  expected_litter_date: string | null;
  status: string;
  sex: string;
  is_pregnant: boolean;
}

interface Incident {
  id: string;
  animal_id: string;
  incident_type: string;
  incident_date: string;
}

interface CalendarEvent {
  date: string;
  type: 'intake' | 'litter' | 'escaped' | 'planned_adoption' | 'planned_outcome';
  animal: CalendarAnimal;
}

function AnimalMedallion({ animal, title }: { animal: CalendarAnimal; title: string }) {
  return (
    <Link
      href={`/dashboard/animals/${animal.id}`}
      title={`${animal.name} — ${title}`}
      className="group relative inline-flex"
    >
      {animal.primary_photo_url ? (
        <img
          src={animal.primary_photo_url}
          alt={animal.name}
          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow group-hover:scale-110 transition-transform"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-white shadow flex items-center justify-center group-hover:scale-110 transition-transform">
          <span className="text-[10px] font-bold text-primary">
            {animal.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}
    </Link>
  );
}

export default function CalendarPage() {
  const t = useTranslations('calendar');

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  // Fetch all animals (large page size to get enough data)
  console.time('[CALENDAR] Total load time');
  console.time('[CALENDAR] Fetch animals');
  const { data: animalsData, isLoading: animalsLoading } = useQuery<{ items: CalendarAnimal[] }>({
    queryKey: ['animals-calendar'],
    queryFn: async () => {
      const start = Date.now();
      const result = await ApiClient.getAnimals({ page_size: 500 });
      console.timeEnd('[CALENDAR] Fetch animals');
      console.log(`[CALENDAR] Animals received: ${result.items.length}, time: ${Date.now() - start}ms`);
      return result;
    },
    staleTime: 2 * 60 * 1000,
  });
  console.time('[CALENDAR] Fetch incidents');
  // Fetch escape incidents
  const { data: incidents = [] } = useQuery<Incident[]>({
    queryKey: ['incidents-escape'],
    queryFn: async () => {
      const start = Date.now();
      const result = await ApiClient.getIncidents({ incident_type: 'escape' });
      console.log(`[CALENDAR] Incidents received: ${result.length}, time: ${Date.now() - start}ms`);
      console.timeEnd('[CALENDAR] Fetch incidents');
      return result;
    },
    staleTime: 2 * 60 * 1000,
  });

  console.time('[CALENDAR] Fetch intakes');
  // Fetch intakes for planned_adoption events
  const { data: intakesData = [] } = useQuery({
    queryKey: ['intakes-calendar'],
    queryFn: async () => {
      const start = Date.now();
      const result = await ApiClient.get('/intakes');
      console.log(`[CALENDAR] Intakes received: ${(result as any[]).length}, time: ${Date.now() - start}ms`);
      console.timeEnd('[CALENDAR] Fetch intakes');
      return result;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Loading complete
  useMemo(() => {
    if (!animalsLoading && animalsData) {
      console.timeEnd('[CALENDAR] Total load time');
    }
  }, [animalsLoading, animalsData]);

  const animals: CalendarAnimal[] = animalsData?.items ?? [];

  // Build animal lookup map for incidents
  const animalById = useMemo(() => {
    const m: Record<string, CalendarAnimal> = {};
    for (const a of animals) m[a.id] = a;
    return m;
  }, [animals]);

  // Build events map: "YYYY-MM-DD" -> events[]
  const eventsMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};

    const addEvent = (dateStr: string | null, type: CalendarEvent['type'], animal: CalendarAnimal) => {
      if (!dateStr) return;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push({ date: dateStr, type, animal });
    };

    for (const animal of animals) {
      addEvent(animal.current_intake_date, 'intake', animal);
      if (animal.expected_litter_date && animal.sex === 'female' && animal.is_pregnant) {
        addEvent(animal.expected_litter_date, 'litter', animal);
      }
    }

    // Add escape incidents
    for (const incident of incidents) {
      const animal = animalById[incident.animal_id];
      if (animal) {
        addEvent(incident.incident_date, 'escaped', animal);
      }
    }

    // Add planned and actual outcome events
    for (const intake of intakesData as any[]) {
      const animal = animalById[intake.animal_id];
      if (animal) {
        // Planned outcome (future)
        if (intake.planned_outcome_date) {
          addEvent(intake.planned_outcome_date, 'outcome', animal);
        }
        // Actual outcome (past)
        if (intake.actual_outcome_date) {
          addEvent(intake.actual_outcome_date, 'outcome', animal);
        }
        // Legacy: planned_end_date as planned adoption
        if (intake.planned_end_date) {
          addEvent(intake.planned_end_date, 'planned_adoption', animal);
        }
      }
    }

    return map;
  }, [animals, incidents, intakesData, animalById]);

  // Calendar grid calculation
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday-first: getDay() returns 0=Sun..6=Sat; convert to Mon=0..Sun=6
  const startDow = (firstDay.getDay() + 6) % 7; // pad from Monday
  const daysInMonth = lastDay.getDate();

  // Total cells (always 6 rows × 7 = 42 so the grid doesn't jump)
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(year, month)
  );

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const weekdays = t.raw('weekdays') as string[];

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const dateKey = (d: number) => `${year}-${pad2(month + 1)}-${pad2(d)}`;
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight capitalize">{monthName}</h1>
          <p className="text-sm text-muted-foreground">{t('title')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>{t('today')}</Button>
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <LogIn className="h-5 w-5 text-blue-500" /> {t('intakeStart')}
        </span>
        <span className="flex items-center gap-1">
          <Baby className="h-5 w-5 text-pink-500" /> {t('expectedLitter')}
        </span>
        <span className="flex items-center gap-1">
          <PersonStanding className="h-5 w-5 text-orange-500" /> {t('escaped')}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="h-5 w-5 text-green-500" /> {t('plannedAdoption')}
        </span>
        <span className="flex items-center gap-1">
          <LogOut className="h-5 w-5 text-red-500" /> {t('plannedOutcome')}
        </span>
      </div>

      {/* Grid */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {weekdays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[100px] border-b border-r last:border-r-0 bg-muted/10"
                />
              );
            }

            const key = dateKey(day);
            const isToday = key === todayKey;
            const events = eventsMap[key] ?? [];
            const intakes = events.filter(e => e.type === 'intake');
            const litters = events.filter(e => e.type === 'litter');
            const escaped = events.filter(e => e.type === 'escaped');
            const plannedAdoptions = events.filter(e => e.type === 'planned_adoption');

            return (
              <div
                key={key}
                className={cn(
                  'min-h-[100px] border-b border-r last:border-r-0 p-1.5 flex flex-col gap-1',
                  isToday && 'bg-primary/5 ring-1 ring-inset ring-primary/30'
                )}
              >
                {/* Day number */}
                <div className={cn(
                  'text-sm font-medium self-start w-7 h-7 flex items-center justify-center rounded-full',
                  isToday && 'bg-primary text-primary-foreground font-bold'
                )}>
                  {day}
                </div>

                {/* Litter markers (date, no animal — just icons) */}
                {litters.length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {litters.map((ev, i) => (
                      <Link
                        key={i}
                        href={`/dashboard/animals/${ev.animal.id}`}
                        title={`${ev.animal.name} — ${t('expectedLitter')}`}
                        className="flex items-center gap-0.5 text-[10px] bg-pink-100 text-pink-700 border border-pink-200 rounded px-1 py-0.5 hover:bg-pink-200 transition-colors"
                      >
                        <Baby className="h-3 w-3" />
                        <span className="truncate max-w-[60px]">{ev.animal.name}</span>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Intake start medallions */}
                {intakes.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-auto">
                    {intakes.slice(0, 5).map((ev, i) => (
                      <div key={i} className="relative" title={`${ev.animal.name} — ${t('intakeStart')}`}>
                        <AnimalMedallion animal={ev.animal} title={t('intakeStart')} />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border border-white flex items-center justify-center">
                          <LogIn className="h-2 w-2 text-white" />
                        </div>
                      </div>
                    ))}
                    {intakes.length > 5 && (
                      <div className="w-8 h-8 rounded-full bg-muted border-2 border-white shadow flex items-center justify-center text-[9px] text-muted-foreground font-bold">
                        +{intakes.length - 5}
                      </div>
                    )}
                  </div>
                )}

                {/* Planned adoption medallions */}
                {plannedAdoptions.length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {plannedAdoptions.slice(0, 3).map((ev, i) => (
                      <div key={i} className="relative" title={`${ev.animal.name} — ${t('plannedAdoption')}`}>
                        <AnimalMedallion animal={ev.animal} title={t('plannedAdoption')} />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border border-white flex items-center justify-center">
                          <Heart className="h-2 w-2 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Escaped medallions */}
                {escaped.length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {escaped.slice(0, 3).map((ev, i) => (
                      <div key={i} className="relative" title={`${ev.animal.name} — ${t('escaped')}`}>
                        <AnimalMedallion animal={ev.animal} title={t('escaped')} />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-orange-500 border border-white flex items-center justify-center">
                          <PersonStanding className="h-2 w-2 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
