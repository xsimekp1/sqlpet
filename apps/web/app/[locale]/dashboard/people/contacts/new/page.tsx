'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/app/lib/api';
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
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

interface ContactFormData {
  name: string;
  type: 'donor' | 'veterinarian' | 'volunteer' | 'foster' | 'supplier' | 'partner' | 'other';
  profession?: string;
  email?: string;
  phone?: string;
  organization_name?: string;
  address?: string;
  bank_account?: string;
  tax_id?: string;
  notes?: string;
}

export default function NewContactPage() {
  const t = useTranslations('people');
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ContactFormData>();

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return await ApiClient.post('/contacts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({
        title: t('messages.personCreated'),
        description: t('messages.personCreatedDesc'),
      });
      router.push('/dashboard/people');
    },
    onError: (error: Error) => {
      toast({
        title: t('messages.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    createContactMutation.mutate(data);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/people">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('addPerson')}</h1>
          <p className="text-muted-foreground hidden md:block">
            Přidejte nový kontakt do databáze
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">{t('fields.name')} *</Label>
          <Input
            id="name"
            placeholder=""
            {...register('name', { required: true })}
          />
          {errors.name && (
            <p className="text-sm text-destructive">Jméno je povinné</p>
          )}
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label htmlFor="type">{t('fields.type')} *</Label>
          <Select
            onValueChange={(value) => setValue('type', value as any)}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Vyberte typ kontaktu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="donor">{t('types.donor')}</SelectItem>
              <SelectItem value="veterinarian">{t('types.veterinarian')}</SelectItem>
              <SelectItem value="volunteer">{t('types.volunteer')}</SelectItem>
              <SelectItem value="foster">{t('types.foster')}</SelectItem>
              <SelectItem value="supplier">{t('types.supplier')}</SelectItem>
              <SelectItem value="partner">{t('types.partner')}</SelectItem>
              <SelectItem value="other">{t('types.other')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Profession/Specialty */}
        <div className="space-y-2">
          <Label htmlFor="profession">Profese / Specializace</Label>
          <Input
            id="profession"
            placeholder="např. Účetní, Právník, Fotograf, IT podpora"
            {...register('profession')}
          />
          <p className="text-sm text-muted-foreground">
            Pro profesní služby: účetní, právník, fotograf, IT podpora, atd.
          </p>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">{t('fields.email')}</Label>
          <Input
            id="email"
            type="email"
            placeholder="email@example.com"
            {...register('email')}
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">{t('fields.phone')}</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+420 123 456 789"
            {...register('phone')}
          />
        </div>

        {/* Organization Name */}
        <div className="space-y-2">
          <Label htmlFor="organization_name">{t('fields.organization')}</Label>
          <Input
            id="organization_name"
            placeholder="např. Veterinární klinika ABC"
            {...register('organization_name')}
          />
          <p className="text-sm text-muted-foreground">
            Pokud kontakt zastupuje organizaci nebo firmu
          </p>
        </div>

        {/* Address */}
        <div className="space-y-2">
          <Label htmlFor="address">{t('fields.address')}</Label>
          <Textarea
            id="address"
            rows={3}
            placeholder="Ulice, město, PSČ"
            {...register('address')}
          />
        </div>

        {/* Financial Information Section */}
        <div className="pt-4 border-t">
          <h3 className="text-lg font-semibold mb-4">Finanční informace</h3>
          <div className="space-y-4">
            {/* Bank Account */}
            <div className="space-y-2">
              <Label htmlFor="bank_account">Bankovní účet / IBAN</Label>
              <Input
                id="bank_account"
                placeholder="např. CZ65 0800 0000 1920 0014 5399"
                {...register('bank_account')}
              />
              <p className="text-sm text-muted-foreground">
                Pro platby dodavatelům nebo přijímání plateb od dárců
              </p>
            </div>

            {/* Tax ID */}
            <div className="space-y-2">
              <Label htmlFor="tax_id">IČO / DIČ</Label>
              <Input
                id="tax_id"
                placeholder="např. 12345678"
                {...register('tax_id')}
              />
              <p className="text-sm text-muted-foreground">
                Identifikační číslo pro fakturaci
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">{t('fields.notes')}</Label>
          <Textarea
            id="notes"
            rows={4}
            placeholder=""
            {...register('notes')}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={createContactMutation.isPending}
          >
            {createContactMutation.isPending ? 'Ukládám...' : 'Vytvořit kontakt'}
          </Button>
          <Link href="/dashboard/people">
            <Button type="button" variant="outline">
              Zrušit
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
