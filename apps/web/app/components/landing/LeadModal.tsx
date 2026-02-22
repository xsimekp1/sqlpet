'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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

const schema = z.object({
  name: z.string().min(1, 'Jméno je povinné'),
  email: z.string().min(1, 'Email je povinný').email('Neplatný formát emailu'),
  shelter: z.string().min(1, 'Název útulku je povinný'),
  interest: z.enum(['free', 'demo', 'beta']),
});

type FormData = z.infer<typeof schema>;

interface LeadModalProps {
  open: boolean;
  onClose: () => void;
  defaultInterest?: 'free' | 'demo' | 'beta';
}

export function LeadModal({ open, onClose, defaultInterest = 'free' }: LeadModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { interest: defaultInterest },
  });

  // Reset form with new defaultInterest when modal opens
  useEffect(() => {
    if (open) {
      reset({ interest: defaultInterest, name: '', email: '', shelter: '' });
    }
  }, [open, defaultInterest, reset]);

  const onSubmit = async (data: FormData) => {
    // TODO: POST na /api/leads endpoint
    console.log('Lead form submitted:', data);
    await new Promise((r) => setTimeout(r, 500)); // simulate request
    toast.success('Děkujeme! Ozveme se do 24 hodin.');
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Začít s Petslog</DialogTitle>
          <DialogDescription>
            Vyplňte formulář a my vás kontaktujeme do 24 hodin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="lead-name">Jméno</Label>
            <Input
              id="lead-name"
              {...register('name')}
              placeholder="Jan Novák"
              className="mt-1"
            />
            {errors.name && (
              <p className="text-destructive text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="lead-email">Email</Label>
            <Input
              id="lead-email"
              type="email"
              {...register('email')}
              placeholder="jan@utulek.cz"
              className="mt-1"
            />
            {errors.email && (
              <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="lead-shelter">Název útulku</Label>
            <Input
              id="lead-shelter"
              {...register('shelter')}
              placeholder="Útulek pro zvířata Brno"
              className="mt-1"
            />
            {errors.shelter && (
              <p className="text-destructive text-xs mt-1">{errors.shelter.message}</p>
            )}
          </div>

          <div>
            <Label>Zájem</Label>
            <Select
              defaultValue={defaultInterest}
              onValueChange={(v) => setValue('interest', v as 'free' | 'demo' | 'beta')}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Vyzkoušet zdarma</SelectItem>
                <SelectItem value="demo">Domluvit ukázku</SelectItem>
                <SelectItem value="beta">Beta program</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Zrušit
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Odesílám...' : 'Odeslat'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
