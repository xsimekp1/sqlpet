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

const SPECIES_OPTIONS = [
  { value: 'dog',    label: '🐕 Pes',      autoName: 'Kotec' },
  { value: 'cat',    label: '🐈 Kočka',    autoName: 'Kotec' },
  { value: 'rodent', label: '🐹 Hlodavec', autoName: 'Klec' },
  { value: 'bird',   label: '🐦 Pták',     autoName: 'Voliéra' },
  { value: 'other',  label: '🐾 Jiné',     autoName: 'Kotec' },
] as const;

function getAutoName(species: string[]): string | null {
  if (species.length === 0) return null;
  const onlyBirds = species.every(s => s === 'bird');
  if (onlyBirds) return 'Voliéra';
  if (species.includes('dog') || species.includes('cat')) return 'Kotec';
  return 'Kotec';
}

const formSchema = z.object({
  name: z.string().min(1, 'errors.required'),
  zone_id: z.string().optional(),
  type: z.enum(['indoor', 'outdoor', 'isolation', 'quarantine']),
  capacity: z.number().min(1).max(50),
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
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      zone_id: '',
      type: 'indoor',
      capacity: 1,
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
    if (!open) {
      // Reset species + name-edited flag on close
      setSelectedSpecies([]);
      setNameManuallyEdited(false);
    }
  }, [open, zones.length]);

  // Auto-name when species changes (only if name wasn't manually edited)
  useEffect(() => {
    if (!nameManuallyEdited) {
      const auto = getAutoName(selectedSpecies);
      if (auto !== null) {
        form.setValue('name', auto);
      }
    }
  }, [selectedSpecies, nameManuallyEdited, form]);

  const toggleSpecies = (sp: string) => {
    setSelectedSpecies(prev =>
      prev.includes(sp) ? prev.filter(s => s !== sp) : [...prev, sp]
    );
  };

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      // zone_id: send null if empty or "none"
      const zoneId = data.zone_id && data.zone_id !== 'none' ? data.zone_id : null;
      await ApiClient.createKennel({
        name: data.name,
        zone_id: zoneId,
        type: data.type,
        capacity: data.capacity,
        allowed_species: selectedSpecies.length > 0 ? selectedSpecies : null,
      });
      toast.success(t('add.success'));
      form.reset();
      setSelectedSpecies([]);
      setNameManuallyEdited(false);
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('add.title')}</DialogTitle>
          <DialogDescription>{t('add.description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Species (multi-select chips) */}
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">{t('add.allowedSpecies')}</p>
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
              {selectedSpecies.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('add.allowedSpeciesHint')}:{' '}
                  <span className="font-medium">{getAutoName(selectedSpecies)}</span>
                </p>
              )}
            </div>

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('add.name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="např. Kotec A1"
                      {...field}
                      onChange={e => {
                        field.onChange(e);
                        setNameManuallyEdited(e.target.value !== '' && e.target.value !== getAutoName(selectedSpecies));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Zone - only show if zones exist */}
            {loadingZones ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('add.loadingZones')}
              </div>
            ) : zones.length > 0 && (
              <FormField
                control={form.control}
                name="zone_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('add.zone')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('add.zonePlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">— Bez zóny —</SelectItem>
                        {zones.map(z => (
                          <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('add.type')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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

            {/* Capacity */}
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('add.capacity')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      {...field}
                      onChange={e => field.onChange(e.target.valueAsNumber)}
                    />
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
