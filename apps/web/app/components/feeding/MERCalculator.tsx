'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ApiClient, { MERCalculation, MERCalculateRequest } from '@/app/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

interface MERCalculatorProps {
  animalId: string;
  weightKg: number | null;
  /** Called after successful calculation so parent can prefill form */
  onApply?: (result: MERCalculation) => void;
  /** Compact mode – hide the breakdown table */
  compact?: boolean;
}

const HEALTH_OPTIONS = [
  { value: 'healthy',        label: 'Zdravý' },
  { value: 'recovery',       label: 'Rekonvalescence' },
  { value: 'critical',       label: 'Kritický stav' },
  { value: 'cancer',         label: 'Onkologické onemocnění' },
  { value: 'obese_program',  label: 'Redukční program' },
  { value: 'kidney_disease', label: 'Onemocnění ledvin' },
  { value: 'pregnant',       label: 'Březost' },
  { value: 'lactating',      label: 'Laktace' },
];

const ENVIRONMENT_OPTIONS = [
  { value: 'indoor',          label: 'Vnitřní prostředí' },
  { value: 'outdoor_summer',  label: 'Venkovní kotec – léto (> 20 °C)' },
  { value: 'outdoor_cool',    label: 'Venkovní kotec – podzim (10–20 °C)' },
  { value: 'outdoor_winter',  label: 'Venkovní kotec – zima (< 10 °C)' },
  { value: 'outdoor_cold',    label: 'Venkovní kotec – mráz (< 0 °C)' },
];

const WEIGHT_GOAL_OPTIONS = [
  { value: 'maintain', label: 'Udržet váhu' },
  { value: 'lose',     label: 'Zhubnout (-20 %)' },
  { value: 'gain',     label: 'Přibrat (+20 %)' },
];

export default function MERCalculator({
  animalId,
  weightKg,
  onApply,
  compact = false,
}: MERCalculatorProps) {
  const [healthModifier, setHealthModifier] = useState('healthy');
  const [environment, setEnvironment] = useState('indoor');
  const [weightGoal, setWeightGoal] = useState('maintain');
  const [foodKcal, setFoodKcal] = useState('');
  const [mealsPerDay, setMealsPerDay] = useState('2');
  const [result, setResult] = useState<MERCalculation | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async () => {
    if (!weightKg) {
      toast.error('Nejprve zadejte váhu zvířete.');
      return;
    }
    setLoading(true);
    try {
      const params: MERCalculateRequest = {
        animal_id: animalId,
        health_modifier: healthModifier,
        environment,
        weight_goal: weightGoal,
        meals_per_day: parseInt(mealsPerDay, 10) || 2,
      };
      if (foodKcal && parseFloat(foodKcal) > 0) {
        params.food_kcal_per_100g = parseFloat(foodKcal);
      }
      const calc = await ApiClient.calculateMER(params);
      setResult(calc);
    } catch (err: any) {
      toast.error(err?.message || 'Chyba při výpočtu MER');
    } finally {
      setLoading(false);
    }
  };

  if (!weightKg) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Nejprve zadejte váhu zvířete pro výpočet energetických potřeb.</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Doporučení krmení (RER/MER)</span>
        </div>
        <Button size="sm" onClick={handleCalculate} disabled={loading}>
          {loading ? 'Počítám…' : result ? 'Přepočítat' : 'Vypočítat'}
        </Button>
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Zdravotní stav</Label>
          <Select value={healthModifier} onValueChange={setHealthModifier}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEALTH_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Prostředí</Label>
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENVIRONMENT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cíl váhy</Label>
          <Select value={weightGoal} onValueChange={setWeightGoal}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEIGHT_GOAL_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Krmivo (kcal/100g)</Label>
          <Input
            type="number"
            min={0}
            max={600}
            step={1}
            value={foodKcal}
            onChange={e => setFoodKcal(e.target.value)}
            placeholder="340"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-sm font-medium">
              RER: <strong>{result.rer} kcal/den</strong>
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="text-sm font-medium text-primary">
              MER: <strong>{result.mer_kcal} kcal/den</strong>
            </span>
            {result.food_recommendation && (
              <>
                <span className="text-muted-foreground">≈</span>
                <span className="text-xs text-muted-foreground">
                  {result.food_recommendation.meals_per_day}× denně
                </span>
              </>
            )}
          </div>

          {/* Breakdown */}
          {!compact && (
            <div className="rounded-md border p-3 space-y-1">
              <div className="flex items-center gap-1 mb-2">
                <Info className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Jak se k tomu přišlo</span>
              </div>
              <div className="font-mono text-xs space-y-0.5 text-muted-foreground">
                <div>RER = 70 × {result.weight_kg}^0.75 = <span className="text-foreground font-semibold">{result.rer} kcal</span></div>
                {Object.entries(result.factors).map(([key, factor]: [string, any]) => {
                  const factorLabels: Record<string, string> = {
                    activity: 'Aktivita',
                    bcs: 'BCS',
                    age: 'Věk',
                    health: 'Zdraví',
                    environment: 'Prostředí',
                    breed_size: 'Velikost',
                    weight_goal: 'Cíl váhy',
                  };
                  return (
                    <div key={key} className={factor.value === 1.0 ? 'opacity-50' : ''}>
                      × {factorLabels[key] || key}:{' '}
                      <span className={factor.value !== 1.0 ? 'text-foreground font-semibold' : ''}>
                        {factor.value.toFixed(2)}
                      </span>{' '}
                      <span className="text-muted-foreground/70">({factor.label})</span>
                    </div>
                  );
                })}
                <div className="border-t pt-1 mt-1">
                  MER = {result.rer} × {result.mer_total_factor.toFixed(4)} ={' '}
                  <span className="text-primary font-bold">{result.mer_kcal} kcal/den</span>
                </div>
                {result.food_recommendation && (
                  <div>
                    Krmivo: {result.food_recommendation.kcal_per_100g} kcal/100g →{' '}
                    {result.food_recommendation.meals_per_day}× denně
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Apply button */}
          {onApply && (
            <Button variant="outline" size="sm" onClick={() => onApply(result)} className="w-full">
              Použít doporučení v plánu krmení
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
