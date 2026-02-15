'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/app/lib/api';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { UNIT_OPTIONS } from '@/app/lib/constants';

const SPECIES_OPTIONS = [
  { value: 'dog',    label: '🐕 Pes' },
  { value: 'cat',    label: '🐈 Kočka' },
  { value: 'rabbit', label: '🐇 Králík' },
  { value: 'bird',   label: '🐦 Pták' },
  { value: 'other',  label: '🐾 Jiné' },
] as const;

interface InventoryItemFormData {
  name: string;
  category: 'medication' | 'vaccine' | 'food' | 'supply' | 'other';
  unit?: string;
  reorder_threshold?: number;
  // Food-specific
  kcal_per_100g?: number;
  price_per_unit?: number;
  food_type?: string;
  shelf_life_days?: number;
  unit_weight_g?: number;
}

export default function NewInventoryItemPage() {
  const t = useTranslations('inventory');
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<InventoryItemFormData>();
  const category = useWatch({ control, name: 'category' });
  const isFood = category === 'food';

  // Controlled value for category Select (needed for pre-fill to show visually)
  const [categoryValue, setCategoryValue] = useState('');

  // Species selection state
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);

  // Pre-fill from URL params (e.g. ?category=food&species=dog)
  useEffect(() => {
    const defaultCategory = searchParams.get('category');
    const defaultSpecies = searchParams.get('species');
    if (defaultCategory) {
      setCategoryValue(defaultCategory);
      setValue('category', defaultCategory as any);
    }
    if (defaultSpecies) {
      setSelectedSpecies([defaultSpecies]);
    }
  }, []);

  const toggleSpecies = (sp: string) => {
    setSelectedSpecies(prev =>
      prev.includes(sp) ? prev.filter(s => s !== sp) : [...prev, sp]
    );
  };

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: InventoryItemFormData) => {
      const body: Record<string, any> = {
        ...data,
        reorder_threshold: data.reorder_threshold ? Number(data.reorder_threshold) : undefined,
      };
      if (isFood) {
        if (data.kcal_per_100g) body.kcal_per_100g = Number(data.kcal_per_100g);
        if (data.price_per_unit) body.price_per_unit = Number(data.price_per_unit);
        if (selectedSpecies.length > 0) body.allowed_species = selectedSpecies;
        if (data.food_type) body.food_type = data.food_type;
        if (data.shelf_life_days) body.shelf_life_days = Number(data.shelf_life_days);
        if (data.unit_weight_g) body.unit_weight_g = Number(data.unit_weight_g);
      }
      return await ApiClient.post('/inventory/items', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast({
        title: t('messages.itemCreated'),
        description: t('messages.itemCreatedDesc'),
      });
      router.push('/dashboard/inventory');
    },
    onError: (error: Error) => {
      toast({
        title: t('messages.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: InventoryItemFormData) => {
    if (!data.category) {
      toast({
        title: 'Kategorie je povinná',
        description: 'Vyberte kategorii položky skladu',
        variant: 'destructive',
      });
      return;
    }
    createItemMutation.mutate(data);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/inventory">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('createItem')}</h1>
          <p className="text-muted-foreground">Add a new inventory item to track</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">{t('fields.name')} *</Label>
          <Input
            id="name"
            placeholder="e.g. Dog Food - Premium Dry"
            {...register('name', { required: true })}
          />
          {errors.name && <p className="text-sm text-destructive">Name is required</p>}
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category">{t('fields.category')} *</Label>
          <Select
            value={categoryValue}
            onValueChange={(value) => { setCategoryValue(value); setValue('category', value as any); }}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="medication">{t('categories.medication')}</SelectItem>
              <SelectItem value="vaccine">{t('categories.vaccine')}</SelectItem>
              <SelectItem value="food">{t('categories.food')}</SelectItem>
              <SelectItem value="supply">{t('categories.supply')}</SelectItem>
              <SelectItem value="other">{t('categories.other')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Food-specific fields */}
        {isFood && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
            <p className="text-sm font-medium">🦴 Parametry krmiva</p>

            {/* Kcal per 100g */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kcal_per_100g">{t('fields.kcalPer100g')}</Label>
                <Input
                  id="kcal_per_100g"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="např. 350"
                  {...register('kcal_per_100g')}
                />
                <p className="text-xs text-muted-foreground">kcal / 100 g</p>
              </div>

              {/* Price per unit */}
              <div className="space-y-2">
                <Label htmlFor="price_per_unit">{t('fields.pricePerUnit')}</Label>
                <Input
                  id="price_per_unit"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="např. 299.90"
                  {...register('price_per_unit')}
                />
                <p className="text-xs text-muted-foreground">Kč / jednotka</p>
              </div>
            </div>

            {/* Food type */}
            <div className="space-y-2">
              <Label htmlFor="food_type">Typ krmiva</Label>
              <Select onValueChange={(v) => setValue('food_type', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dry">Suché (granule)</SelectItem>
                  <SelectItem value="wet">Vlhké (kapsy)</SelectItem>
                  <SelectItem value="canned">Konzerva</SelectItem>
                  <SelectItem value="treats">Pamlsky</SelectItem>
                  <SelectItem value="raw">Syrové (BARF)</SelectItem>
                  <SelectItem value="other">Jiné</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Shelf life + unit weight */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shelf_life_days">Trvanlivost po otevření (dny)</Label>
                <Input
                  id="shelf_life_days"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="např. 30"
                  {...register('shelf_life_days')}
                />
                <p className="text-xs text-muted-foreground">Trvanlivost po otevření / použití</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_weight_g">Hmotnost balení (g)</Label>
                <Input
                  id="unit_weight_g"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="např. 400"
                  {...register('unit_weight_g')}
                />
                <p className="text-xs text-muted-foreground">Pro konzervy / balení</p>
              </div>
            </div>

            {/* Allowed species */}
            <div className="space-y-2">
              <Label>{t('fields.allowedSpecies')}</Label>
              <div className="flex gap-1.5 flex-wrap">
                {SPECIES_OPTIONS.map(sp => (
                  <button
                    key={sp.value}
                    type="button"
                    onClick={() => toggleSpecies(sp.value)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      selectedSpecies.includes(sp.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:bg-accent'
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Vyberte pro jaká zvířata je toto krmivo určeno (lze zvolit více druhů).
              </p>
            </div>
          </div>
        )}

        {/* Unit */}
        <div className="space-y-2">
          <Label htmlFor="unit">{t('fields.unit')}</Label>
          <Controller
            name="unit"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Select unit..." />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map(u => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Reorder Threshold */}
        <div className="space-y-2">
          <Label htmlFor="reorder_threshold">{t('fields.reorderThreshold')}</Label>
          <Input
            id="reorder_threshold"
            type="number"
            step="0.01"
            placeholder="e.g. 10"
            {...register('reorder_threshold')}
          />
          <p className="text-sm text-muted-foreground">Alert when stock falls below this level</p>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={createItemMutation.isPending}>
            {createItemMutation.isPending ? 'Creating...' : t('actions.createItem')}
          </Button>
          <Link href="/dashboard/inventory">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
