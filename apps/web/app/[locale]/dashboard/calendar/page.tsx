'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ApiClient } from '@/app/lib/api';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Baby, LogIn, PersonStanding, Heart, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CalendarEventAnimal {
  id: string;
  name: string;
  photo_url: string | null;
}

interface CalendarIntakeEvent {
  date: string;
  animal_id: string;
  animal_name: string;
  animal_photo_url: string | null;
}

interface CalendarLitterEvent {
  date: string;
  animal_id: string;
  animal_name: string;
  animal_photo_url: string | null;
}

interface CalendarEscapeEvent {
  date: string;
  animal_id: string;
  animal_name: string;
  animal_photo_url: string | null;
}

interface CalendarOutcomeEvent {
  date: string;
  animal_id: string;
  animal_name: string;
  animal_photo_url: string | null;
  outcome_type: string;
}

interface CalendarEventsData {
  intakes: CalendarIntakeEvent[];
  litters: CalendarLitterEvent[];
  escapes: CalendarEscapeEvent[];
  outcomes: CalendarOutcomeEvent[];
}

interface CalendarEvent {
  date: string;
  type: 'intake' | 'litter' | 'escaped' | 'planned_adoption' | 'planned_outcome';
  animal: CalendarEventAnimal;
}

function AnimalMedallion({ animal, title }: { animal: CalendarEventAnimal; title: string }) {
  return (
    <Link
      href={`/dashboard/animals/${animal.id}`}
      title={`${animal.name} — ${title}`}
      className="group relative inline-flex"
    >
      {animal.photo_url ? (
        <img
          src={animal.photo_url}
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

  // Single optimized API call - fetches all events for the month in one request
  const { data: eventsData, isLoading } = useQuery<CalendarEventsData>({
    queryKey: ['calendar-events', year, month],
    queryFn: () => ApiClient.getCalendarEvents(year, month + 1), // JS months are 0-indexed
    staleTime: 60 * 1000, // 1 minute
  });

  // Build events map: "YYYY-MM-DD" -> events[]
  const eventsMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};

    const addEvent = (dateStr: string, type: CalendarEvent['type'], animal: CalendarEventAnimal) => {
      if (!dateStr) return;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push({ date: dateStr, type, animal });
    };

    // Add intakes
    for (const intake of eventsData?.intakes ?? []) {
      addEvent(intake.date, 'intake', {
        id: intake.animal_id,
        name: intake.animal_name,
        photo_url: intake.animal_photo_url,
      });
    }

    // Add litters
    for (const litter of eventsData?.litters ?? []) {
      addEvent(litter.date, 'litter', {
        id: litter.animal_id,
        name: litter.animal_name,
        photo_url: litter.animal_photo_url,
      });
    }

    // Add escapes
    for (const escape of eventsData?.escapes ?? []) {
      addEvent(escape.date, 'escaped', {
        id: escape.animal_id,
        name: escape.animal_name,
        photo_url: escape.animal_photo_url,
      });
    }

    // Add outcomes
    for (const outcome of eventsData?.outcomes ?? []) {
      // planned vs actual - use different types for display
      const eventType = outcome.outcome_type === 'planned' ? 'planned_outcome' : 'planned_outcome';
      addEvent(outcome.date, eventType, {
        id: outcome.animal_id,
        name: outcome.animal_name,
        photo_url: outcome.animal_photo_url,
      });
    }

    return map;
  }, [eventsData]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

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
