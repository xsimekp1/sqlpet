'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ApiClient from '@/app/lib/api';
import { useTranslations } from 'next-intl';
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
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

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

export default function NewFeedingPlanPage() {
  const t = useTranslations('feeding');
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FeedingPlanFormData>({
    defaultValues: {
      start_date: new Date().toISOString().split('T')[0],
      schedule_json: [],
    },
  });

  const [scheduleTimes, setScheduleTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState('08:00');
  const [selectedAnimalId, setSelectedAnimalId] = useState('');

  // Fetch animals
  const { data: animalsData } = useQuery({
    queryKey: ['animals'],
    queryFn: () => ApiClient.getAnimals({ page_size: 100 }),
  });

  // Fetch foods
  const { data: foodsData } = useQuery({
    queryKey: ['foods'],
    queryFn: () => ApiClient.get('/feeding/foods'),
  });

  const animals = animalsData?.items || [];
  const foods = foodsData?.items || [];

  const watchedAnimalId = watch('animal_id');
  const selectedAnimal = animals.find((a: any) => a.id === watchedAnimalId);
  const filteredFoods = foods.filter(
    (f: any) => !f.species || !selectedAnimal || f.species === selectedAnimal.species
  );

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: FeedingPlanFormData) => {
      return await ApiClient.post('/feeding/plans', {
        ...data,
        schedule_json: scheduleTimes,
        amount_g: data.amount_g ? Number(data.amount_g) : undefined,
        times_per_day: data.times_per_day ? Number(data.times_per_day) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeding-plans'] });
      toast({
        title: t('messages.planCreated'),
        description: t('messages.planCreatedDesc'),
      });
      router.push('/dashboard/feeding/plans');
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
    createPlanMutation.mutate(data);
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
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/feeding/plans">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('createPlan')}</h1>
          <p className="text-muted-foreground">
            Create a new feeding schedule for an animal
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Animal Selection */}
        <div className="space-y-2">
          <Label htmlFor="animal_id">{t('fields.animal')} *</Label>
          <Select
            value={selectedAnimalId}
            onValueChange={(value) => { setSelectedAnimalId(value); setValue('animal_id', value); }}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an animal" />
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
            onValueChange={(value) => setValue('food_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select food (optional)" />
            </SelectTrigger>
            <SelectContent>
              {filteredFoods.map((food: any) => (
                <SelectItem key={food.id} value={food.id}>
                  {food.name} {food.brand && `(${food.brand})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Link to a specific food for automatic inventory deduction
          </p>
          {selectedAnimal && filteredFoods.length === 0 && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Sklad neobsahuje žádné krmivo vhodné pro druh &ldquo;{selectedAnimal.species}&rdquo;.{' '}
                <Link
                  href={`/dashboard/inventory/items/new?category=food&species=${selectedAnimal.species}`}
                  className="underline font-medium"
                >
                  Přidat krmivo
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Amount */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount_g">{t('fields.amountGrams')}</Label>
            <Input
              id="amount_g"
              type="number"
              step="0.01"
              placeholder="e.g. 200"
              {...register('amount_g')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount_text">{t('fields.amountText')}</Label>
            <Input
              id="amount_text"
              placeholder="e.g. 1 cup, half can"
              {...register('amount_text')}
            />
          </div>
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
              Add Time
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
            <p className="text-sm text-muted-foreground">
              Leave empty for ongoing plan
            </p>
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
            disabled={createPlanMutation.isPending}
          >
            {createPlanMutation.isPending ? 'Creating...' : t('actions.createPlan')}
          </Button>
          <Link href="/dashboard/feeding/plans">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
