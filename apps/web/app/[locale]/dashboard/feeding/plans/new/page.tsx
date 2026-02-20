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
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, AlertTriangle, Plus, Trash2 } from 'lucide-react';
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

export default function NewFeedingPlanPage() {
  const t = useTranslations('feeding');
  const { toast } = useToast();
  const router = useRouter();
  const locale = useLocale();
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
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [recommendedAmount, setRecommendedAmount] = useState<number | null>(null);
  const [calculationDetails, setCalculationDetails] = useState<{
    mer: number;
    kcalPer100g: number;
  } | null>(null);

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
  // GET /inventory/items returns List[InventoryStockResponse] — each element is {item: {...}, total_quantity, ...}
  const rawFoods = Array.isArray(foodsData) ? foodsData : [];
  const foods = rawFoods.map((s: any) => s.item ?? s);

  const watchedAnimalId = watch('animal_id');
  const selectedAnimal = animals.find((a: any) => a.id === selectedAnimalId);
  const filteredFoods = foods.filter(
    (f: any) => !f.allowed_species?.length || !selectedAnimal || f.allowed_species.includes(selectedAnimal.species)
  );

  // Calculate MER (calorie needs) for an animal
  const calculateAnimalMER = (animal: any): number | null => {
    const weight = animal?.weight_current_kg;
    if (!weight || weight <= 0) return null;
    
    // RER = 70 × weight_kg^0.75
    const rer = 70 * Math.pow(weight, 0.75);
    
    // Activity factor - default for shelter neutered animals
    let activityFactor = 1.4;
    if (animal.species === 'cat') activityFactor = 1.2;
    if (animal.altered_status === 'intact') {
      activityFactor = animal.species === 'cat' ? 1.4 : 1.8;
    }
    
    return Math.round(rer * activityFactor);
  };

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: FeedingPlanFormData) => {
      return await ApiClient.post('/feeding/plans', {
        ...data,
        // Backend expects Dict[str,Any]|null — wrap times array; send null when empty
        schedule_json: scheduleTimes.length > 0 ? { times: scheduleTimes } : null,
        // food_id references foods.id (diet definitions), not inventory items — omit for now
        food_id: undefined,
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

  const calculateRecommendedAmount = (animal: any, food: any) => {
    const weight = animal.weight_current_kg;
    
    if (!weight || weight <= 0) {
      toast({
        title: 'Zvíře nemá zadanou váhu',
        description: 'Nelze navrhnout optimální krmnou dávku. Prosím zadejte aktuální váhu zvířete.',
        variant: 'destructive',
      });
      setRecommendedAmount(null);
      setCalculationDetails(null);
      return;
    }

    const kcalPer100g = food.kcal_per_100g;
    if (!kcalPer100g || kcalPer100g <= 0) {
      toast({
        title: 'Krmivo nemá kalorickou hodnotu',
        description: 'Krmivo nemá zadanou hodnotu kcal_per_100g. Nelze vypočítat dávku.',
        variant: 'destructive',
      });
      setRecommendedAmount(null);
      setCalculationDetails(null);
      return;
    }

    // Use stored MER from animal, or calculate if not available
    let mer = animal.mer_kcal_per_day;
    if (!mer && weight) {
      // RER = 70 × weight_kg^0.75
      const rer = 70 * Math.pow(weight, 0.75);
      
      // Activity factor based on altered status and age
      // Default to neutered_adult for shelter animals
      let activityFactor = 1.4; // default for neutered adult
      if (animal.species === 'cat') {
        activityFactor = 1.2;
      }
      if (animal.altered_status === 'intact') {
        activityFactor = animal.species === 'cat' ? 1.4 : 1.8;
      }
      mer = rer * activityFactor;
    }
    
    const amountGPerDay = (mer / kcalPer100g) * 100;
    
    // Round according to rules:
    // 0-200g: round to nearest 10
    // 201-400g: round to nearest 20
    // 400g+: round to nearest 50
    let roundedAmount: number;
    if (amountGPerDay <= 200) {
      roundedAmount = Math.round(amountGPerDay / 10) * 10;
    } else if (amountGPerDay <= 400) {
      roundedAmount = Math.round(amountGPerDay / 20) * 20;
    } else {
      roundedAmount = Math.round(amountGPerDay / 50) * 50;
    }
    
    // Ensure minimum of 10g
    roundedAmount = Math.max(10, roundedAmount);

    setRecommendedAmount(roundedAmount);
    setCalculationDetails({
      mer: Math.round(mer),
      kcalPer100g: kcalPer100g
    });
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
      setCalculationDetails(null);
    }
  };

  const applyRecommendedAmount = () => {
    if (recommendedAmount) {
      setValue('amount_g', recommendedAmount);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/feeding/plans">
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-lg border">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
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
                  {animals.map((animal: any) => {
                    return (
                      <SelectItem key={animal.id} value={animal.id}>
                        {animal.name} ({animal.public_code})
                      </SelectItem>
                    );
                  })}
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
              <p className="text-sm text-muted-foreground">
                {t('foodLinkDesc')}
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
            <div className="space-y-2">
              <Label htmlFor="amount_g">{t('fields.amountGrams')}</Label>
              <Input className="bg-white"
                id="amount_g"
                type="number"
                step="1"
                placeholder="např. 200"
                {...register('amount_g')}
              />
              {recommendedAmount && calculationDetails && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      Doporučená denní dávka: <span className="font-medium text-green-600">{recommendedAmount}g</span> (váha: {selectedAnimal?.weight_current_kg}kg)
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={applyRecommendedAmount}
                      className="h-6 text-xs text-green-600 hover:text-green-700"
                    >
                      Použít
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    Výpočet: {calculationDetails.mer} kcal/den ÷ {calculationDetails.kcalPer100g} kcal/100g × 100 = {Math.round((calculationDetails.mer / calculationDetails.kcalPer100g) * 100)}g
                  </p>
                </div>
              )}
            </div>

            {/* Amount text */}
            <div className="space-y-2">
              <Label htmlFor="amount_text">{t('fields.amountText')}</Label>
              <Input className="bg-white"
                id="amount_text"
                placeholder="např. 1 kelímek, půl konzervy"
                {...register('amount_text')}
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Times per day */}
            <div className="space-y-2">
              <Label htmlFor="times_per_day">{t('fields.timesPerDay')}</Label>
              <Input className="bg-white"
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
                <Input className="bg-white"
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
                <Input className="bg-white"
                  id="start_date"
                  type="date"
                  {...register('start_date', { required: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">{t('fields.endDate')}</Label>
                <Input className="bg-white"
                  id="end_date"
                  type="date"
                  {...register('end_date')}
                />
                <p className="text-sm text-muted-foreground">
                  {t('endDateDesc')}
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
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t">
          <Button
            type="submit"
            disabled={createPlanMutation.isPending}
          >
            {createPlanMutation.isPending ? t('creating') : t('actions.createPlan')}
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
