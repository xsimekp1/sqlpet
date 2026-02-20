'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const PRESETS = [
  { times: 1, schedule: ['08:00'] },
  { times: 2, schedule: ['08:00', '18:00'] },
  { times: 3, schedule: ['08:00', '13:00', '18:00'] },
  { times: 4, schedule: ['07:00', '12:00', '17:00', '22:00'] },
  { times: 5, schedule: ['07:00', '11:00', '15:00', '19:00', '23:00'] },
  { times: 6, schedule: ['06:00', '10:00', '14:00', '18:00', '22:00', '02:00'] },
];

interface TimePresetsButtonsProps {
  onSelect: (times: string[]) => void;
}

export function TimePresetsButtons({ onSelect }: TimePresetsButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Label className="w-full text-sm text-muted-foreground">Quick presets:</Label>
      {PRESETS.map(preset => (
        <Button
          key={preset.times}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelect(preset.schedule)}
        >
          {preset.times}× per day
        </Button>
      ))}
    </div>
  );
}
