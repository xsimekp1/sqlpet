'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
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
import { useForm } from 'react-hook-form';

interface InventoryItemFormData {
  name: string;
  category: 'medication' | 'vaccine' | 'food' | 'supply' | 'other';
  unit?: string;
  reorder_threshold?: number;
}

export default function NewInventoryItemPage() {
  const t = useTranslations('inventory');
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<InventoryItemFormData>();

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: InventoryItemFormData) => {
      return await ApiClient.post('/inventory/items', {
        ...data,
        reorder_threshold: data.reorder_threshold ? Number(data.reorder_threshold) : undefined,
      });
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
          <p className="text-muted-foreground">
            Add a new inventory item to track
          </p>
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
          {errors.name && (
            <p className="text-sm text-destructive">Name is required</p>
          )}
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category">{t('fields.category')} *</Label>
          <Select
            onValueChange={(value) => setValue('category', value as any)}
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

        {/* Unit */}
        <div className="space-y-2">
          <Label htmlFor="unit">{t('fields.unit')}</Label>
          <Input
            id="unit"
            placeholder="e.g. kg, pcs, box, dose"
            {...register('unit')}
          />
          <p className="text-sm text-muted-foreground">
            Unit of measurement for this item
          </p>
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
          <p className="text-sm text-muted-foreground">
            Alert when stock falls below this level
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={createItemMutation.isPending}
          >
            {createItemMutation.isPending ? 'Creating...' : t('actions.createItem')}
          </Button>
          <Link href="/dashboard/inventory">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
