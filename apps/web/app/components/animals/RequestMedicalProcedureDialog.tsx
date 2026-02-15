'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Stethoscope, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ApiClient, { Animal } from '@/app/lib/api';
import { Input } from '@/components/ui/input';

interface RequestMedicalProcedureDialogProps {
  animal: Animal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Form schema
const formSchema = z.object({
  procedureType: z.string().min(1, 'Procedure type is required'),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assignedToId: z.string().optional(),
  dueDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function RequestMedicalProcedureDialog({
  animal,
  open,
  onOpenChange,
}: RequestMedicalProcedureDialogProps) {
  const t = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkedInventoryItemId, setLinkedInventoryItemId] = useState<string>('');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      procedureType: '',
      description: '',
      priority: 'medium',
      assignedToId: '',
      dueDate: '',
    },
  });

  const watchedProcedureType = form.watch('procedureType');
  const isVaccination = watchedProcedureType === 'vaccination';

  // Fetch vaccine inventory items when vaccination is selected
  const { data: vaccineItems } = useQuery({
    queryKey: ['inventory-vaccines', animal.species],
    queryFn: () => ApiClient.get('/inventory/items', { category: 'vaccine', allowed_species: animal.species }),
    enabled: isVaccination && open,
  });
  const vaccines = Array.isArray(vaccineItems) ? vaccineItems : [];

  const procedureTypes = [
    { value: 'checkup', label: t('medical.types.checkup') },
    { value: 'vaccination', label: t('medical.types.vaccination') },
    { value: 'neutering', label: t('medical.types.neutering') },
    { value: 'surgery', label: t('medical.types.surgery') },
    { value: 'dental', label: t('medical.types.dental') },
    { value: 'bloodwork', label: t('medical.types.bloodwork') },
    { value: 'xray', label: t('medical.types.xray') },
    { value: 'treatment', label: t('medical.types.treatment') },
    { value: 'emergency', label: t('medical.types.emergency') },
    { value: 'other', label: t('medical.types.other') },
  ];

  const priorities = [
    { value: 'low', label: t('tasks.priority.low') },
    { value: 'medium', label: t('tasks.priority.medium') },
    { value: 'high', label: t('tasks.priority.high') },
    { value: 'urgent', label: t('tasks.priority.urgent') },
  ];

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    try {
      // Get procedure type label for task title
      const procedureTypeLabel = procedureTypes.find(
        (pt) => pt.value === values.procedureType
      )?.label || values.procedureType;

      // Create task title: "Check-up: Rex"
      const title = `${procedureTypeLabel}: ${animal.name}`;

      // Create task
      await ApiClient.createTask({
        title,
        description: values.description,
        type: 'medical',
        priority: values.priority,
        assigned_to_id: values.assignedToId || undefined,
        due_at: values.dueDate || undefined,
        related_entity_type: 'animal',
        related_entity_id: animal.id,
        linked_inventory_item_id: linkedInventoryItemId || undefined,
        task_metadata: {
          procedure_type: values.procedureType,
          animal_name: animal.name,
          animal_species: animal.species,
          animal_public_code: animal.public_code,
        },
      });

      toast.success(t('medical.messages.procedureRequested'), {
        description: t('medical.messages.procedureRequestedDesc'),
      });

      // Reset form and close dialog
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to request medical procedure:', error);
      toast.error(t('medical.messages.error'), {
        description:
          error instanceof Error
            ? error.message
            : t('medical.messages.errorDesc'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            {t('medical.requestProcedure')}
          </DialogTitle>
          <DialogDescription>
            Request a medical procedure for {animal.name} (#{animal.public_code})
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Procedure Type */}
            <FormField
              control={form.control}
              name="procedureType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('medical.procedureType')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('medical.procedureType')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {procedureTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vaccine inventory picker — shown only for vaccination */}
            {isVaccination && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t('medical.vaccineFromStock')}
                </label>
                {vaccines.length === 0 ? (
                  <div className="flex items-center gap-2 p-2 rounded border border-yellow-300 bg-yellow-50/60 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {t('medical.noVaccineInStock')}
                  </div>
                ) : (
                  <Select value={linkedInventoryItemId} onValueChange={setLinkedInventoryItemId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('medical.vaccinePickerPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('medical.vaccineNone')}</SelectItem>
                      {vaccines.map((v: any) => (
                        <SelectItem key={v.item?.id ?? v.id} value={v.item?.id ?? v.id}>
                          {v.item?.name ?? v.name} ({v.total_quantity ?? 0} {v.item?.unit ?? v.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('medical.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the medical procedure needed..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('medical.priority')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {priorities.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* TODO: M4+ - Add Assign To field (fetch vet staff users with medical.manage permission) */}
            {/* TODO: M4+ - Add Due Date field (date picker) */}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t('medical.createTask')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
