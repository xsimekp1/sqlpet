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
import { ArrowLeft, AlertTriangle, Plus, Trash2, Flame } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { isTerminal } from '@/app/lib/constants';
import { TimePresetsButtons } from '@/app/components/feeding/TimePresetsButtons';
import { AmountDistribution } from '@/app/components/feeding/AmountDistribution';
import { FeedingPreview } from '@/app/components/feeding/FeedingPreview';
import { calcMER, snapToNice } from '@/app/lib/energy';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface FeedingPlanFormData {
  animal_id: string;
  food_id?: string;
  amount_g?: number;
  amount_text?: string;
  start_date: string;
  end_date?: string;
  notes?: string;
}

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

  const gramsPerMeal: number | null =
    gramsPerDay && scheduleTimes.length > 0
      ? Math.round(gramsPerDay / scheduleTimes.length)
      : null;

  const showCalcPanel = selectedAnimal != null && (merKcal != null || kcalPer100g != null);

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

    createPlanMutation.mutate(data);
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
    setScheduleTimes(scheduleTimes.filter((t) => t !== time));
  };

  const reqCls = (filled: boolean) =>
    filled ? 'bg-white' : 'bg-amber-50 border-amber-300 focus-visible:ring-amber-400';

  return (
    <div className="space-y-6 max-w-6xl pb-24">
      <div className="flex items-center gap-4">
        <Link href={`/${locale}/dashboard/feeding/plans`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('createPlan')}</h1>
          <p className="text-muted-foreground">{t('createPlanDesc')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section A: Animal & Food Basics */}
        <Card>
          <CardHeader>
            <CardTitle>Animal & Food</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            {/* Animal Selection */}
            <div className="space-y-2">
              <Label htmlFor="animal_id">{t('fields.animal')} *</Label>
              <Select
                value={selectedAnimalId}
                onValueChange={(value) => {
                  setSelectedAnimalId(value);
                  setValue('animal_id', value);
                }}
                required
              >
                <SelectTrigger className={`${reqCls(!!selectedAnimalId)} data-[placeholder]:text-muted-foreground`}>
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

            {/* Food Selection */}
            <div className="space-y-2">
              <Label htmlFor="food_id">{t('fields.food')}</Label>
              <Select value={selectedFoodId} onValueChange={setSelectedFoodId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={t('selectFoodOptional')} />
                </SelectTrigger>
                <SelectContent>
                  {filteredFoods.map((food: any) => (
                    <SelectItem key={food.id} value={food.id}>
                      {food.name} {food.brand && `(${food.brand})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAnimal && filteredFoods.length === 0 && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No food items found for species &quot;{selectedAnimal.species}&quot;.{' '}
                    <Link
                      href={`/${locale}/dashboard/inventory/items/new?category=food&species=${selectedAnimal.species}`}
                      className="underline font-medium"
                    >
                      Add food
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="amount_g">{t('fields.amountGrams')} *</Label>
                {showCalcPanel && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-orange-500 hover:text-orange-700">
                        <Flame className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 text-sm" align="start">
                      <div className="space-y-2">
                        <p className="font-semibold text-orange-800">Výpočet doporučené dávky</p>
                        {merKcal && kcalPer100g ? (
                          <>
                            <div className="flex flex-col gap-1 text-muted-foreground">
                              <span>Kalorická potřeba: <strong className="text-foreground">{merKcal} kcal/den</strong></span>
                              <span>Krmivo: <strong className="text-foreground">{kcalPer100g} kcal/100g</strong></span>
                            </div>
                            <p>Doporučená denní dávka: <strong>{gramsPerDay} g/den</strong>
                              {gramsPerMeal && <span className="text-muted-foreground ml-1">(≈ {gramsPerMeal} g/dávku)</span>}
                            </p>
                            <Button type="button" size="sm" variant="outline" className="w-full border-orange-300 hover:bg-orange-50" onClick={applyRecommendation}>
                              ↗ Použít → {gramsPerDay} g
                            </Button>
                          </>
                        ) : merKcal ? (
                          <p className="text-muted-foreground">Vyberte krmivo s kcal hodnotou.</p>
                        ) : (
                          <p className="text-muted-foreground">Zvíře nemá zadanou váhu.</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              <Input
                className={reqCls(!!watchedAmountG)}
                id="amount_g"
                type="number"
                step="1"
                placeholder="e.g. 200"
                {...register('amount_g', { required: true })}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setValue('amount_g', Math.round(v));
                }}
              />
            </div>

            {/* Amount text */}
            <div className="space-y-2">
              <Label htmlFor="amount_text">{t('fields.amountText')}</Label>
              <Input
                className="bg-white"
                id="amount_text"
                placeholder="e.g. 1 cup, half a can"
                {...register('amount_text')}
              />
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label htmlFor="start_date">{t('fields.startDate')} *</Label>
              <Input
                className="bg-white"
                id="start_date"
                type="date"
                {...register('start_date', { required: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">{t('fields.endDate')}</Label>
              <Input
                className="bg-white"
                id="end_date"
                type="date"
                {...register('end_date')}
              />
              <p className="text-sm text-muted-foreground">{t('endDateDesc')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Section B: Feeding Schedule with Presets */}
        <Card>
          <CardHeader>
            <CardTitle>Feeding Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick preset buttons */}
            <TimePresetsButtons onSelect={handlePresetSelect} scheduleTimes={scheduleTimes} />

            {/* Current times list */}
            {scheduleTimes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {scheduleTimes.map((time) => (
                  <div
                    key={time}
                    className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-md"
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
            )}

            {/* Manual add time */}
            <div className="flex gap-2">
              <Input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="bg-white"
              />
              <Button type="button" onClick={addScheduleTime} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add time
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section C: Amount Distribution */}
        {scheduleTimes.length > 0 && watchedAmountG && (
          <Card>
            <CardHeader>
              <CardTitle>Amount Distribution</CardTitle>
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

        {/* Section D: Live Preview */}
        {scheduleTimes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Preview (Today / Tomorrow)</CardTitle>
            </CardHeader>
            <CardContent>
              <FeedingPreview scheduleTimes={scheduleTimes} amounts={amounts} />
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Any special instructions or notes..."
              {...register('notes')}
            />
          </CardContent>
        </Card>

        {/* Sticky footer bar */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground truncate">
            {selectedAnimal
              ? `${selectedAnimal.name} · ${scheduleTimes.length > 0 ? `${scheduleTimes.length}× denně` : 'bez rozvrhu'}`
              : 'Krmný plán'}
            {watchedAmountG ? ` · ${watchedAmountG} g/den` : ''}
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/${locale}/dashboard/feeding/plans`}>
              <Button type="button" variant="outline">
                {t('actions.cancel')}
              </Button>
            </Link>
            <Button
              type="submit"
              size="lg"
              disabled={createPlanMutation.isPending}
              className="gap-2"
            >
              {createPlanMutation.isPending ? t('creating') : t('actions.createPlan')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
