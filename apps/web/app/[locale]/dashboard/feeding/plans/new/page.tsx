'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ApiClient from '@/app/lib/api';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertTriangle, Plus, Trash2, Flame, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { isTerminal } from '@/app/lib/constants';
import { AmountDistribution } from '@/app/components/feeding/AmountDistribution';
import { calcMER, snapToNice } from '@/app/lib/energy';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FeedingPlanFormData {
  animal_id: string;
  food_id?: string;
  amount_g?: number;
  amount_text?: string;
  start_date: string;
  end_date?: string;
  notes?: string;
}

// Frequency presets
const FREQUENCY_PRESETS = [
  { times: 1, label: '1×', schedule: ['07:00'] },
  { times: 2, label: '2×', schedule: ['07:00', '18:00'] },
  { times: 3, label: '3×', schedule: ['07:00', '12:00', '18:00'] },
];

export default function NewFeedingPlanPage() {
  const t = useTranslations('feeding');
  const { toast } = useToast();
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch, setValue } = useForm<FeedingPlanFormData>({
    defaultValues: {
      start_date: new Date().toISOString().split('T')[0],
    },
  });

  const [scheduleTimes, setScheduleTimes] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<number[]>([]);
  const [newTime, setNewTime] = useState('08:00');
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const watchedAmountG = watch('amount_g');

  // Fetch animals
  const { data: animalsData } = useQuery({
    queryKey: ['animals'],
    queryFn: () => ApiClient.getAnimals({ page_size: 100 }),
    staleTime: 10 * 60 * 1000,
  });

  // Fetch food inventory items (category=food)
  const { data: foodsData } = useQuery({
    queryKey: ['inventory-items', 'food'],
    queryFn: () => ApiClient.get('/inventory/items', { category: 'food' }),
    staleTime: 10 * 60 * 1000,
  });

  const animals = (animalsData?.items || []).filter(
    (a: any) => !isTerminal(a.status) && a.current_intake_date !== null,
  );
  const rawFoods = Array.isArray(foodsData) ? foodsData : [];
  const foods = rawFoods.map((s: any) => s.item ?? s);

  const selectedAnimal = animals.find((a: any) => a.id === selectedAnimalId);
  const filteredFoods = foods.filter(
    (f: any) =>
      !f.allowed_species?.length ||
      !selectedAnimal ||
      f.allowed_species.includes(selectedAnimal.species),
  );

  // MER / dosage calculation
  const merKcal: number | null = selectedAnimal
    ? selectedAnimal.mer_kcal_per_day ??
      (selectedAnimal.weight_current_kg
        ? calcMER(
            Number(selectedAnimal.weight_current_kg),
            selectedAnimal.age_group,
            selectedAnimal.altered_status,
            selectedAnimal.is_pregnant ?? false,
            selectedAnimal.is_lactating ?? false,
            selectedAnimal.is_critical ?? false,
            selectedAnimal.is_diabetic ?? false,
            selectedAnimal.is_cancer ?? false,
            selectedAnimal.species,
          )
        : null)
    : null;

  const selectedFood = foods.find((f: any) => f.id === selectedFoodId);
  const kcalPer100g: number | null = selectedFood?.kcal_per_100g ?? null;

  const gramsPerDay: number | null =
    merKcal && kcalPer100g ? snapToNice(Math.round(merKcal / (kcalPer100g / 100))) : null;

  const applyRecommendation = () => {
    if (!gramsPerDay) return;
    setValue('amount_g', gramsPerDay);
    if (scheduleTimes.length > 0) {
      const even = Math.round(gramsPerDay / scheduleTimes.length);
      const newAmounts = scheduleTimes.map((_, i) =>
        i === scheduleTimes.length - 1
          ? gramsPerDay - even * (scheduleTimes.length - 1)
          : even,
      );
      setAmounts(newAmounts);
    }
  };

  const handleFrequencyChange = (preset: typeof FREQUENCY_PRESETS[0]) => {
    setScheduleTimes(preset.schedule);
    // Auto-distribute amounts equally
    if (watchedAmountG) {
      const perMeal = Math.round(Number(watchedAmountG) / preset.times);
      const newAmounts = preset.schedule.map((_, i) =>
        i === preset.schedule.length - 1
          ? Number(watchedAmountG) - perMeal * (preset.schedule.length - 1)
          : perMeal
      );
      setAmounts(newAmounts);
    }
  };

  // Calculate per-meal amount for display
  const perMealAmount = watchedAmountG && scheduleTimes.length > 0
    ? Math.round(Number(watchedAmountG) / scheduleTimes.length)
    : null;

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: FeedingPlanFormData) => {
      const payload = {
        animal_id: data.animal_id,
        start_date: data.start_date,
        end_date: data.end_date ? data.end_date : null,
        amount_g: data.amount_g ? Number(data.amount_g) : undefined,
        amount_text: data.amount_text || undefined,
        schedule_json: scheduleTimes.length > 0 ? { times: scheduleTimes, amounts: amounts } : null,
        inventory_item_id: selectedFoodId || undefined,
      };
      return await ApiClient.post('/feeding/plans', payload);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['feeding-plans'] });
      if (data?.closed_plans_count > 0) {
        toast({
          title: t('messages.previousPlanClosed'),
          description: t('messages.previousPlanClosedDesc'),
        });
      }
      toast({
        title: t('messages.planCreated'),
        description: t('messages.planCreatedDesc'),
      });
      router.push(`/${locale}/dashboard/feeding/plans`);
    },
    onError: (error: Error) => {
      toast({
        title: t('messages.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: FeedingPlanFormData) => {
    // Validate times array not empty
    if (scheduleTimes.length === 0) {
      toast({
        title: 'Chyba',
        description: 'Vyberte frekvenci krmení',
        variant: 'destructive',
      });
      return;
    }

    // Validate amounts sum equals daily amount
    if (data.amount_g) {
      const total = amounts.reduce((sum, a) => sum + a, 0);
      if (Math.abs(total - data.amount_g) > 1) {
        toast({
          title: 'Chyba',
          description: 'Součet dávek musí odpovídat denní dávce (±1g)',
          variant: 'destructive',
        });
        return;
      }
    }

    createPlanMutation.mutate(data);
  };

  const addScheduleTime = () => {
    if (newTime && !scheduleTimes.includes(newTime)) {
      const updated = [...scheduleTimes, newTime].sort();
      setScheduleTimes(updated);
    }
  };

  const removeScheduleTime = (time: string) => {
    setScheduleTimes(scheduleTimes.filter((t) => t !== time));
  };

  return (
    <div className="space-y-4 max-w-2xl pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/dashboard/feeding/plans`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">{t('createPlan')}</h1>
          <p className="text-sm text-muted-foreground">{t('createPlanDesc')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Step 1: Select Animal */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label className="text-base font-medium">{t('fields.animal')}</Label>
              <Select
                value={selectedAnimalId}
                onValueChange={(value) => {
                  setSelectedAnimalId(value);
                  setValue('animal_id', value);
                }}
              >
                <SelectTrigger className={cn(
                  'h-12 text-base',
                  selectedAnimalId ? 'bg-white' : 'bg-amber-50 border-amber-300'
                )}>
                  <SelectValue placeholder={t('selectAnimal')} />
                </SelectTrigger>
                <SelectContent>
                  {animals.map((animal: any) => (
                    <SelectItem key={animal.id} value={animal.id}>
                      {animal.name} ({animal.public_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Amount + Frequency (only show when animal selected) */}
        {selectedAnimalId && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Daily Amount with MER calculator */}
              <div className="space-y-2">
                <Label className="text-base font-medium">{t('fields.amountGrams')}</Label>
                <div className="flex gap-2">
                  <Input
                    className={cn(
                      'flex-1 text-lg h-12',
                      watchedAmountG ? 'bg-white' : 'bg-amber-50 border-amber-300'
                    )}
                    id="amount_g"
                    type="number"
                    step="1"
                    placeholder="200"
                    {...register('amount_g', { required: true })}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) {
                        setValue('amount_g', Math.round(v));
                        // Recalculate distribution
                        if (scheduleTimes.length > 0) {
                          const perMeal = Math.round(v / scheduleTimes.length);
                          const newAmounts = scheduleTimes.map((_, i) =>
                            i === scheduleTimes.length - 1
                              ? Math.round(v) - perMeal * (scheduleTimes.length - 1)
                              : perMeal
                          );
                          setAmounts(newAmounts);
                        }
                      }
                    }}
                  />
                  <span className="flex items-center text-lg text-muted-foreground">g/den</span>
                  {gramsPerDay && (
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 h-12"
                      onClick={applyRecommendation}
                    >
                      <Flame className="h-4 w-4 mr-2" />
                      {gramsPerDay} g
                    </Button>
                  )}
                </div>
                {merKcal && (
                  <p className="text-xs text-muted-foreground">
                    MER: {merKcal} kcal/den {kcalPer100g && `· Krmivo: ${kcalPer100g} kcal/100g`}
                  </p>
                )}
              </div>

              {/* Frequency selector - big buttons */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Frekvence</Label>
                <div className="grid grid-cols-3 gap-2">
                  {FREQUENCY_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.times}
                      onClick={() => handleFrequencyChange(preset)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg border-2 p-4 transition-colors',
                        scheduleTimes.length === preset.times
                          ? 'border-primary bg-primary/10 text-primary'
                          : scheduleTimes.length === 0
                            ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                            : 'border-input bg-background hover:bg-accent'
                      )}
                    >
                      <span className="text-2xl font-bold">{preset.label}</span>
                      <span className="text-xs text-muted-foreground">denně</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Result summary - the key insight */}
              {watchedAmountG && scheduleTimes.length > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Výsledek:</span>
                    <span className="text-lg font-semibold">
                      {perMealAmount} g × {scheduleTimes.length} = {watchedAmountG} g/den
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {scheduleTimes.map((time, idx) => (
                      <span key={time} className="text-sm text-muted-foreground">
                        {time}: <strong className="text-foreground">{amounts[idx] || perMealAmount}g</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Advanced options - collapsible */}
        {selectedAnimalId && (
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between" type="button">
                <span>Pokročilé nastavení</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              {/* Food selection */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Krmivo</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedFoodId} onValueChange={setSelectedFoodId}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={t('selectFoodOptional')} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredFoods.map((food: any) => (
                        <SelectItem key={food.id} value={food.id}>
                          {food.name} {food.brand && `(${food.brand})`}
                          {food.kcal_per_100g && ` · ${food.kcal_per_100g} kcal/100g`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAnimal && filteredFoods.length === 0 && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Žádné krmivo pro druh &quot;{selectedAnimal.species}&quot;.{' '}
                        <Link
                          href={`/${locale}/dashboard/inventory/items/new?category=food&species=${selectedAnimal.species}`}
                          className="underline font-medium"
                        >
                          Přidat krmivo
                        </Link>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Custom times */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Vlastní časy krmení</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {scheduleTimes.map((time) => (
                      <div
                        key={time}
                        className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-md"
                      >
                        <span className="text-sm font-medium">{time}</span>
                        <button
                          type="button"
                          onClick={() => removeScheduleTime(time)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="bg-white w-32"
                    />
                    <Button type="button" onClick={addScheduleTime} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Přidat
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Custom distribution */}
              {scheduleTimes.length > 0 && watchedAmountG && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Rozdělení dávek</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AmountDistribution
                      dailyAmount={Number(watchedAmountG)}
                      scheduleTimes={scheduleTimes}
                      amounts={amounts}
                      onAmountsChange={setAmounts}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Dates */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Platnost plánu</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('fields.startDate')}</Label>
                    <Input
                      className="bg-white"
                      type="date"
                      {...register('start_date', { required: true })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('fields.endDate')}</Label>
                    <Input
                      className="bg-white"
                      type="date"
                      {...register('end_date')}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Poznámky</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    id="notes"
                    rows={2}
                    placeholder="Speciální instrukce..."
                    className="bg-white"
                    {...register('notes')}
                  />
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Sticky footer bar */}
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-background border-t p-4 z-50">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground truncate">
              {selectedAnimal && watchedAmountG && scheduleTimes.length > 0
                ? `${selectedAnimal.name}: ${watchedAmountG}g / ${scheduleTimes.length}× denně`
                : selectedAnimal
                  ? selectedAnimal.name
                  : t('createPlan')}
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href={`/${locale}/dashboard/feeding/plans`}>
                <Button type="button" variant="outline">
                  {t('actions.cancel')}
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={createPlanMutation.isPending || !selectedAnimalId || !watchedAmountG || scheduleTimes.length === 0}
              >
                {createPlanMutation.isPending ? t('creating') : t('actions.createPlan')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
