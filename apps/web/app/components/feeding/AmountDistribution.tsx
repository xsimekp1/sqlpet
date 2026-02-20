'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface AmountDistributionProps {
  dailyAmount: number;
  scheduleTimes: string[];
  amounts: number[];
  onAmountsChange: (amounts: number[]) => void;
}

export function AmountDistribution({
  dailyAmount,
  scheduleTimes,
  amounts,
  onAmountsChange
}: AmountDistributionProps) {
  const [mode, setMode] = useState<'equal' | 'custom'>('equal');

  // Auto-split when mode is equal
  useEffect(() => {
    if (mode === 'equal' && scheduleTimes.length > 0 && dailyAmount > 0) {
      const perMeal = Math.round(dailyAmount / scheduleTimes.length);
      onAmountsChange(scheduleTimes.map(() => perMeal));
    }
  }, [mode, dailyAmount, scheduleTimes.length]);

  const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
  const isValid = Math.abs(totalAmount - dailyAmount) <= 1; // Allow 1g rounding

  return (
    <div className="space-y-4">
      <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'equal' | 'custom')}>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="equal" id="equal" />
          <Label htmlFor="equal">Equal split (automatic)</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="custom" id="custom" />
          <Label htmlFor="custom">Custom amounts per feeding</Label>
        </div>
      </RadioGroup>

      {mode === 'custom' && (
        <div className="grid gap-2">
          {scheduleTimes.map((time, idx) => (
            <div key={time} className="flex items-center gap-2">
              <Label className="w-16">{time}</Label>
              <Input
                type="number"
                value={amounts[idx] || 0}
                onChange={(e) => {
                  const updated = [...amounts];
                  updated[idx] = parseInt(e.target.value) || 0;
                  onAmountsChange(updated);
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">g</span>
            </div>
          ))}
        </div>
      )}

      {scheduleTimes.length > 0 && dailyAmount > 0 && (
        <Alert variant={isValid ? "default" : "destructive"}>
          <AlertTitle>
            Total: {totalAmount}g / {dailyAmount}g
          </AlertTitle>
          {!isValid && (
            <AlertDescription>
              Sum of amounts must equal daily amount (±1g)
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  );
}
