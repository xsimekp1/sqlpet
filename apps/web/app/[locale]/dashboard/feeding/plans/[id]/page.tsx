'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ApiClient from '@/app/lib/api';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
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
import { ArrowLeft, AlertTriangle, Plus, Trash2, Loader2, Flame, ChevronDown } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FeedingPlanFormData {
  animal_id: string;
  food_id?: string;
  amount_g?: number;
  amount_text?: string;
  start_date: string;
  end_date?: string;
  notes?: string;
}

export default function EditFeedingPlanPage() {
  const t = useTranslations('feeding');
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const planId = params.id as string;

  const { register, handleSubmit, watch, setValue, reset } = useForm<FeedingPlanFormData>();

  const [scheduleTimes, setScheduleTimes] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<number[]>([]);
  const [newTime, setNewTime] = useState('08:00');
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [originalAmountG, setOriginalAmountG] = useState<number | null>(null);
  const [showReductionWarning, setShowReductionWarning] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FeedingPlanFormData | null>(null);

  const watchedAmountG = watch('amount_g');

  // Fetch the existing plan
  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ['feeding-plan', planId],
    queryFn: () => ApiClient.get(`/feeding/plans/${planId}`),
    enabled: !!planId,
  });

  // Fetch animals
  const { data: animalsData } = useQuery({
    queryKey: ['animals'],
    queryFn: () => ApiClient.getAnimals({ page_size: 100 }),
    staleTime: 10 * 60 * 1000,
  });

  // Fetch food inventory items
  const { data: foodsData } = useQuery({
    queryKey: ['inventory-items', 'food'],
    queryFn: () => ApiClient.get('/inventory/items', { category: 'food' }),
    staleTime: 10 * 60 * 1000,
  });

  // Filter animals, but always include the currently selected one (even if terminal/no intake)
  const allAnimals = animalsData?.items || [];
  const activeAnimals = allAnimals.filter(
    (a: any) => !isTerminal(a.status) && a.current_intake_date !== null
  );
  // Make sure the current plan's animal is always in the list (compare as strings for UUID safety)
  const planAnimalId = planData?.animal_id ? String(planData.animal_id) : null;
  const currentAnimal = planAnimalId
    ? allAnimals.find((a: any) => String(a.id) === planAnimalId)
    : null;
  const animals = currentAnimal && !activeAnimals.find((a: any) => String(a.id) === String(currentAnimal.id))
    ? [currentAnimal, ...activeAnimals]
    : activeAnimals;
  const rawFoods = Array.isArray(foodsData) ? foodsData : [];
  const foods = rawFoods.map((s: any) => s.item ?? s);

  // Set form data when plan is loaded
  useEffect(() => {
    if (planData) {
      const animalId = planData.animal_id ? String(planData.animal_id) : '';
      const foodId = planData.food_id ? String(planData.food_id) : '';
      reset({
        animal_id: animalId,
        food_id: foodId,
        amount_g: planData.amount_g,
        amount_text: planData.amount_text,
        start_date: planData.start_date,
        end_date: planData.end_date,
        notes: planData.notes,
      });
      setSelectedAnimalId(animalId);
      setSelectedFoodId(foodId);
      // Store original amount for reduction warning
      if (planData.amount_g && originalAmountG === null) {
        setOriginalAmountG(planData.amount_g);
      }
      if (planData.schedule_json?.times) {
        setScheduleTimes(planData.schedule_json.times);
      }
      if (planData.schedule_json?.amounts) {
        setAmounts(planData.schedule_json.amounts);
      }
    }
  }, [planData, reset]);

  const selectedAnimal = animals.find((a: any) => a.id === selectedAnimalId);
  const filteredFoods = foods.filter(
    (f: any) => !f.allowed_species?.length || !selectedAnimal || f.allowed_species.includes(selectedAnimal.species)
  );

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async (data: FeedingPlanFormData) => {
      return await ApiClient.put(`/feeding/plans/${planId}`, {
        ...data,
        schedule_json: scheduleTimes.length > 0 ? { times: scheduleTimes, amounts: amounts } : null,
        food_id: data.food_id || undefined,
        amount_g: data.amount_g ? Number(data.amount_g) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeding-plans'] });
      queryClient.invalidateQueries({ queryKey: ['feeding-plan', planId] });
      toast({
        title: t('messages.planUpdated'),
        description: t('messages.planUpdatedDesc'),
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
        title: 'Validation Error',
        description: 'Add at least one feeding time',
        variant: 'destructive',
      });
      return;
    }

    // Validate amounts sum equals daily amount
    if (data.amount_g) {
      const total = amounts.reduce((sum, a) => sum + a, 0);
      if (Math.abs(total - data.amount_g) > 1) {
        toast({
          title: 'Validation Error',
          description: 'Sum of amounts must equal daily amount (±1g)',
          variant: 'destructive',
        });
        return;
      }
    }

    // Check for significant reduction (> 20%)
    if (originalAmountG && data.amount_g) {
      const reductionPercent = ((originalAmountG - data.amount_g) / originalAmountG) * 100;
      if (reductionPercent > 20) {
        // Store form data and show warning
        setPendingFormData(data);
        setShowReductionWarning(true);
        return;
      }
    }

    updatePlanMutation.mutate(data);
  };

  const confirmReduction = () => {
    if (pendingFormData) {
      updatePlanMutation.mutate(pendingFormData);
      setShowReductionWarning(false);
      setPendingFormData(null);
    }
  };

  const cancelReduction = () => {
    setShowReductionWarning(false);
    setPendingFormData(null);
  };

  const handlePresetSelect = (times: string[]) => {
    setScheduleTimes(times);
  };

  const addScheduleTime = () => {
    if (newTime && !scheduleTimes.includes(newTime)) {
      const updated = [...scheduleTimes, newTime].sort();
      setScheduleTimes(updated);
    }
  };

  const removeScheduleTime = (time: string) => {
    setScheduleTimes(scheduleTimes.filter(t => t !== time));
  };

  // Frequency presets
  const FREQUENCY_PRESETS = [
    { times: 1, label: '1×', schedule: ['07:00'] },
    { times: 2, label: '2×', schedule: ['07:00', '18:00'] },
    { times: 3, label: '3×', schedule: ['07:00', '12:00', '18:00'] },
  ];

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

  // MER calculation
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

  const selectedFood = foods.find((f: any) => String(f.id) === selectedFoodId);
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
          : even
      );
      setAmounts(newAmounts);
    }
  };

  // Calculate per-meal amount for display
  const perMealAmount = watchedAmountG && scheduleTimes.length > 0
    ? Math.round(Number(watchedAmountG) / scheduleTimes.length)
    : null;

  const [showAdvanced, setShowAdvanced] = useState(false);

  if (planLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl pb-24">
      {/* Header with back button and animal name */}
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/dashboard/feeding/plans`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            {selectedAnimal ? selectedAnimal.name : t('editPlan')}
          </h1>
          {selectedAnimal && (
            <p className="text-sm text-muted-foreground">
              {selectedAnimal.public_code} · {selectedFood?.name || 'bez krmiva'}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* CORE SECTION: Amount + Frequency + Result */}
        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Daily Amount with MER calculator */}
            <div className="space-y-2">
              <Label className="text-base font-medium">{t('fields.amountGrams')}</Label>
              <div className="flex gap-2">
                <Input
                  className="flex-1 bg-white text-lg h-12"
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

        {/* Advanced options - collapsible */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between" type="button">
              <span>Pokročilé nastavení</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
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
                      <SelectItem key={String(food.id)} value={String(food.id)}>
                        {food.name} {food.brand && `(${food.brand})`}
                        {food.kcal_per_100g && ` · ${food.kcal_per_100g} kcal/100g`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Animal change (rare) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Zvíře</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedAnimalId}
                  onValueChange={(value) => {
                    setSelectedAnimalId(value);
                    setValue('animal_id', value);
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t('selectAnimal')} />
                  </SelectTrigger>
                  <SelectContent>
                    {animals.map((animal: any) => (
                      <SelectItem key={String(animal.id)} value={String(animal.id)}>
                        {animal.name} ({animal.public_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

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

        {/* Sticky footer bar */}
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-background border-t p-4 z-50">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground truncate">
              {selectedAnimal && watchedAmountG && scheduleTimes.length > 0
                ? `${selectedAnimal.name}: ${watchedAmountG}g / ${scheduleTimes.length}× denně`
                : t('editPlan')}
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href={`/${locale}/dashboard/feeding/plans`}>
                <Button type="button" variant="outline">
                  {t('actions.cancel')}
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={updatePlanMutation.isPending}
              >
                {updatePlanMutation.isPending ? t('saving') : t('actions.savePlan')}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Significant reduction warning dialog */}
      <AlertDialog open={showReductionWarning} onOpenChange={setShowReductionWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              {t('significantReduction')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {originalAmountG && pendingFormData?.amount_g && (
                <>
                  {t('reductionWarningMessage', {
                    oldAmount: originalAmountG,
                    newAmount: pendingFormData.amount_g,
                    percent: Math.round(((originalAmountG - pendingFormData.amount_g) / originalAmountG) * 100),
                  })}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelReduction}>
              {t('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmReduction} className="bg-yellow-600 hover:bg-yellow-700">
              {t('confirmReduction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
