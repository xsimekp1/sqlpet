'use client';

import React, { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertTriangle, Plus, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { isTerminal } from '@/app/lib/constants';

interface FeedingPlanFormData {
  animal_id: string;
  food_id?: string;
  amount_g?: number;
  amount_text?: string;
  times_per_day?: number;
  schedule_json?: string[];
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

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<FeedingPlanFormData>();

  const [scheduleTimes, setScheduleTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState('08:00');
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [recommendedAmount, setRecommendedAmount] = useState<number | null>(null);

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

  const animals = (animalsData?.items || []).filter(
    (a: any) => !isTerminal(a.status) && a.current_intake_date !== null
  );
  const rawFoods = Array.isArray(foodsData) ? foodsData : [];
  const foods = rawFoods.map((s: any) => s.item ?? s);

  // Set form data when plan is loaded
  React.useEffect(() => {
    if (planData) {
      reset({
        animal_id: planData.animal_id,
        food_id: planData.food_id,
        amount_g: planData.amount_g,
        amount_text: planData.amount_text,
        times_per_day: planData.times_per_day,
        start_date: planData.start_date,
        end_date: planData.end_date,
        notes: planData.notes,
      });
      setSelectedAnimalId(planData.animal_id);
      setSelectedFoodId(planData.food_id || '');
      if (planData.schedule_json?.times) {
        setScheduleTimes(planData.schedule_json.times);
      }
    }
  }, [planData]);

  const watchedAnimalId = watch('animal_id');
  const selectedAnimal = animals.find((a: any) => a.id === watchedAnimalId);
  const filteredFoods = foods.filter(
    (f: any) => !f.allowed_species?.length || !selectedAnimal || f.allowed_species.includes(selectedAnimal.species)
  );

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async (data: FeedingPlanFormData) => {
      return await ApiClient.put(`/feeding/plans/${planId}`, {
        ...data,
        schedule_json: scheduleTimes.length > 0 ? { times: scheduleTimes } : null,
        food_id: data.food_id || undefined,
        amount_g: data.amount_g ? Number(data.amount_g) : undefined,
        times_per_day: data.times_per_day ? Number(data.times_per_day) : undefined,
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
    updatePlanMutation.mutate(data);
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

  const calculateRecommendedAmount = (animal: any, food: any) => {
    const weight = animal.weight_current_kg;
    
    if (!weight || weight <= 0) {
      toast({
        title: 'Zvíře nemá zadanou váhu',
        description: 'Nelze navrhnout optimální krmnou dávku. Prosím zadejte aktuální váhu zvířete.',
        variant: 'destructive',
      });
      setRecommendedAmount(null);
      return;
    }

    const kcalPer100g = food.kcal_per_100g;
    if (!kcalPer100g || kcalPer100g <= 0) {
      setRecommendedAmount(null);
      return;
    }

    // Use stored MER from animal, or calculate if not available
    let mer = animal.mer_kcal_per_day;
    if (!mer && weight) {
      const rer = 70 * Math.pow(weight, 0.75);
      let activityFactor = 1.4;
      if (animal.species === 'cat') {
        activityFactor = 1.2;
      }
      if (animal.altered_status === 'intact') {
        activityFactor = animal.species === 'cat' ? 1.4 : 1.8;
      }
      mer = rer * activityFactor;
    }
    
    const amountGPerDay = (mer / kcalPer100g) * 100;
    
    let roundedAmount: number;
    if (amountGPerDay <= 200) {
      roundedAmount = Math.round(amountGPerDay / 10) * 10;
    } else if (amountGPerDay <= 400) {
      roundedAmount = Math.round(amountGPerDay / 20) * 20;
    } else {
      roundedAmount = Math.round(amountGPerDay / 50) * 50;
    }
    
    roundedAmount = Math.max(10, roundedAmount);
    setRecommendedAmount(roundedAmount);
  };

  const handleFoodChange = (value: string) => {
    setSelectedFoodId(value);
    setValue('food_id', value);
    
    if (value && selectedAnimal) {
      const food = foods.find((f: any) => f.id === value);
      if (food) {
        calculateRecommendedAmount(selectedAnimal, food);
      }
    } else {
      setRecommendedAmount(null);
    }
  };

  const applyRecommendedAmount = () => {
    if (recommendedAmount) {
      setValue('amount_g', recommendedAmount);
    }
  };

  if (planLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/feeding/plans">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('editPlan')}</h1>
          <p className="text-muted-foreground">
            {t('editPlanDesc')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-background p-6 rounded-lg border">
        {/* Animal Selection */}
        <div className="space-y-2">
          <Label htmlFor="animal_id">{t('fields.animal')} *</Label>
          <Select
            value={selectedAnimalId}
            onValueChange={(value) => { setSelectedAnimalId(value); setValue('animal_id', value); }}
            required
          >
            <SelectTrigger className="bg-background">
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
            onValueChange={handleFoodChange}
          >
            <SelectTrigger className="bg-background">
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
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="amount_g">{t('fields.amountGrams')}</Label>
            {recommendedAmount && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={applyRecommendedAmount}
                className="h-7 text-xs"
              >
                Použít doporučených {recommendedAmount}g
              </Button>
            )}
          </div>
          <Input
            id="amount_g"
            type="number"
            step="1"
            placeholder="např. 200"
            {...register('amount_g')}
          />
        </div>

        {/* Amount text */}
        <div className="space-y-2">
          <Label htmlFor="amount_text">{t('fields.amountText')}</Label>
          <Input
            id="amount_text"
            placeholder="např. 1 kelímek, půl konzervy"
            {...register('amount_text')}
          />
        </div>

        {/* Times per day */}
        <div className="space-y-2">
          <Label htmlFor="times_per_day">{t('fields.timesPerDay')}</Label>
          <Input
            id="times_per_day"
            type="number"
            min="1"
            placeholder="e.g. 2"
            {...register('times_per_day')}
          />
        </div>

        {/* Schedule */}
        <div className="space-y-2">
          <Label>{t('fields.schedule')}</Label>
          <div className="flex gap-2">
            <Input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
            <Button type="button" onClick={addScheduleTime} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              {t('addTime')}
            </Button>
          </div>
          {scheduleTimes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
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
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_date">{t('fields.startDate')} *</Label>
            <Input
              id="start_date"
              type="date"
              {...register('start_date', { required: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">{t('fields.endDate')}</Label>
            <Input
              id="end_date"
              type="date"
              {...register('end_date')}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">{t('fields.notes')}</Label>
          <Textarea
            id="notes"
            rows={3}
            placeholder="Any special instructions or notes..."
            {...register('notes')}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={updatePlanMutation.isPending}
          >
            {updatePlanMutation.isPending ? t('saving') : t('actions.savePlan')}
          </Button>
          <Link href="/dashboard/feeding/plans">
            <Button type="button" variant="outline">
              {t('actions.cancel')}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
