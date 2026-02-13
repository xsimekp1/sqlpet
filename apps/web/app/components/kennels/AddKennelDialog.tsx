'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ApiClient, { Kennel, KennelZone } from '@/app/lib/api';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(1, 'required'),
  zone_id: z.string().min(1, 'required'),
  type: z.enum(['indoor', 'outdoor', 'isolation', 'quarantine']),
  size_category: z.enum(['small', 'medium', 'large', 'xlarge']),
  capacity: z.number({ coerce: true }).min(1).max(50),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddKennelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function AddKennelDialog({ open, onOpenChange, onCreated }: AddKennelDialogProps) {
  const t = useTranslations('kennels');
  const [zones, setZones] = useState<KennelZone[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      zone_id: '',
      type: 'indoor',
      size_category: 'medium',
      capacity: 1,
      notes: '',
    },
  });

  useEffect(() => {
    if (open && zones.length === 0) {
      setLoadingZones(true);
      ApiClient.getZones()
        .then(setZones)
        .catch(() => toast.error('Failed to load zones'))
        .finally(() => setLoadingZones(false));
    }
  }, [open, zones.length]);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await ApiClient.createKennel({
        name: data.name,
        zone_id: data.zone_id,
        type: data.type,
        size_category: data.size_category,
        capacity: data.capacity,
        notes: data.notes || null,
      });
      toast.success(t('add.success'));
      form.reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(t('add.error') + ': ' + (e.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('add.title')}</DialogTitle>
          <DialogDescription>{t('add.description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('add.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder="např. Kotec A1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zone_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('add.zone')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingZones ? t('add.loadingZones') : t('add.zonePlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {zones.map(z => (
                        <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('add.type')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="indoor">{t('type.indoor')}</SelectItem>
                        <SelectItem value="outdoor">{t('type.outdoor')}</SelectItem>
                        <SelectItem value="isolation">{t('type.isolation')}</SelectItem>
                        <SelectItem value="quarantine">{t('type.quarantine')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="size_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('add.size')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="small">{t('size.small')}</SelectItem>
                        <SelectItem value="medium">{t('size.medium')}</SelectItem>
                        <SelectItem value="large">{t('size.large')}</SelectItem>
                        <SelectItem value="xlarge">{t('size.xlarge')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('add.capacity')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={50} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('add.notes')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('add.notesPlaceholder')} className="resize-none" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                {t('common_cancel')}
              </Button>
              <Button type="submit" disabled={submitting || loadingZones}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('add.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default AddKennelDialog;
