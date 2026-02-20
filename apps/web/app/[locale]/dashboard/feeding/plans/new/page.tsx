'use client';

import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { isTerminal } from '@/app/lib/constants';
import { TimePresetsButtons } from '@/app/components/feeding/TimePresetsButtons';
import { AmountDistribution } from '@/app/components/feeding/AmountDistribution';
import { FeedingPreview } from '@/app/components/feeding/FeedingPreview';

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
    (a: any) => !isTerminal(a.status) && a.current_intake_date !== null
  );
  const rawFoods = Array.isArray(foodsData) ? foodsData : [];
  const foods = rawFoods.map((s: any) => s.item ?? s);

  const selectedAnimal = animals.find((a: any) => a.id === selectedAnimalId);
  const filteredFoods = foods.filter(
    (f: any) => !f.allowed_species?.length || !selectedAnimal || f.allowed_species.includes(selectedAnimal.species)
  );

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: FeedingPlanFormData) => {
      return await ApiClient.post('/feeding/plans', {
        ...data,
        schedule_json: scheduleTimes.length > 0 ? { times: scheduleTimes, amounts: amounts } : null,
        food_id: undefined, // Not used in MVP
        amount_g: data.amount_g ? Number(data.amount_g) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeding-plans'] });
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
    setScheduleTimes(scheduleTimes.filter(t => t !== time));
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-4">
        <Link href={`/${locale}/dashboard/feeding/plans`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('createPlan')}</h1>
          <p className="text-muted-foreground">
            {t('createPlanDesc')}
          </p>
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
                <SelectTrigger className="bg-white data-[placeholder]:text-muted-foreground">
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
              <Select
                value={selectedFoodId}
                onValueChange={setSelectedFoodId}
              >
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
              <Label htmlFor="amount_g">{t('fields.amountGrams')} *</Label>
              <Input
                className="bg-white"
                id="amount_g"
                type="number"
                step="1"
                placeholder="e.g. 200"
                {...register('amount_g', { required: true })}
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
              <p className="text-sm text-muted-foreground">
                {t('endDateDesc')}
              </p>
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
            <TimePresetsButtons onSelect={handlePresetSelect} />

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
              <FeedingPreview
                scheduleTimes={scheduleTimes}
                amounts={amounts}
              />
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

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <Button
            type="submit"
            disabled={createPlanMutation.isPending}
          >
            {createPlanMutation.isPending ? t('creating') : t('actions.createPlan')}
          </Button>
          <Link href={`/${locale}/dashboard/feeding/plans`}>
            <Button type="button" variant="outline">
              {t('actions.cancel')}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
