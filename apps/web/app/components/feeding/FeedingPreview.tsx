'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, addDays } from 'date-fns';

interface FeedingPreviewProps {
  scheduleTimes: string[];
  amounts: number[];
}

export function FeedingPreview({ scheduleTimes, amounts }: FeedingPreviewProps) {
  const today = new Date();
  const tomorrow = addDays(today, 1);

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">
          Today ({format(today, 'MMM d, yyyy')})
        </h4>
        {scheduleTimes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feeding times scheduled</p>
        ) : (
          <div className="space-y-1">
            {scheduleTimes.map((time, idx) => (
              <div key={time} className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{time}</Badge>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{amounts[idx] || 0}g</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-medium mb-2">
          Tomorrow ({format(tomorrow, 'MMM d, yyyy')})
        </h4>
        {scheduleTimes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feeding times scheduled</p>
        ) : (
          <div className="space-y-1">
            {scheduleTimes.map((time, idx) => (
              <div key={time} className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{time}</Badge>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{amounts[idx] || 0}g</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
