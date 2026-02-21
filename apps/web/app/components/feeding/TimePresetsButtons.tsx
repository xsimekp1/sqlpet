'use client';

import { cn } from '@/lib/utils';

const PRESETS = [
  {
    times: 1,
    label: '1× denně',
    sublabel: 'ráno',
    schedule: ['07:00'],
  },
  {
    times: 2,
    label: '2× denně',
    sublabel: 'ráno + večer',
    schedule: ['07:00', '18:00'],
  },
  {
    times: 3,
    label: '3× denně',
    sublabel: 'ráno · poledne · večer',
    schedule: ['07:00', '12:00', '18:00'],
  },
];

interface TimePresetsButtonsProps {
  onSelect: (times: string[]) => void;
  scheduleTimes: string[];
}

export function TimePresetsButtons({ onSelect, scheduleTimes }: TimePresetsButtonsProps) {
  const activeIndex = PRESETS.findIndex(
    (p) =>
      p.schedule.length === scheduleTimes.length &&
      p.schedule.every((t, i) => scheduleTimes[i] === t),
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {PRESETS.map((preset, i) => (
        <button
          type="button"
          key={preset.times}
          onClick={() => onSelect(preset.schedule)}
          className={cn(
            'flex flex-col items-center gap-0.5 rounded-lg border p-3 text-sm transition-colors',
            activeIndex === i
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input bg-background hover:bg-accent',
          )}
        >
          <span className="font-semibold">{preset.label}</span>
          <span className="text-xs text-muted-foreground">{preset.sublabel}</span>
        </button>
      ))}
    </div>
  );
}
