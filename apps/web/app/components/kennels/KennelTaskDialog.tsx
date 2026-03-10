'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ClipboardList, Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ApiClient, { Task } from '@/app/lib/api';

const QUICK_SUGGESTIONS = [
  'Vyčistit kotec',
  'Dezinfekce',
  'Opravit závadu',
  'Výměna steliva',
];

const schema = z.object({
  title: z.string().min(1, 'Název je povinný'),
  type: z.enum(['cleaning', 'maintenance', 'general']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  due_at: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface KennelTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kennelId: string;
  onCreated: (task: Task) => void;
  editTask?: Task;
  onUpdated?: (task: Task) => void;
}

export function KennelTaskDialog({ open, onOpenChange, kennelId, onCreated, editTask, onUpdated }: KennelTaskDialogProps) {
  const t = useTranslations('kennels');
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!editTask;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: editTask?.title ?? '',
      type: (editTask?.type as any) ?? 'general',
      priority: (editTask?.priority as any) ?? 'medium',
      due_at: editTask?.due_at ? editTask.due_at.split('T')[0] : '',
      description: editTask?.description ?? '',
    },
  });

  // Reset form when editTask changes
  const { reset } = form;
  useState(() => {
    reset({
      title: editTask?.title ?? '',
      type: (editTask?.type as any) ?? 'general',
      priority: (editTask?.priority as any) ?? 'medium',
      due_at: editTask?.due_at ? editTask.due_at.split('T')[0] : '',
      description: editTask?.description ?? '',
    });
  });

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      if (isEdit && editTask) {
        const task = await ApiClient.updateTask(editTask.id, {
          title: values.title,
          type: values.type,
          priority: values.priority,
          due_at: values.due_at || undefined,
          description: values.description || undefined,
        });
        toast.success('Úkol upraven');
        onUpdated?.(task);
      } else {
        const task = await ApiClient.createTask({
          title: values.title,
          type: values.type,
          priority: values.priority,
          due_at: values.due_at || undefined,
          description: values.description || undefined,
          related_entity_type: 'kennel',
          related_entity_id: kennelId,
        });
        toast.success(t('task.success'));
        form.reset();
        onCreated(task);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || t('task.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {isEdit ? 'Upravit úkol' : t('task.dialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Upravte detaily úkolu' : 'Vytvořte nový úkol pro tento kotec'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Quick suggestions */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">{t('task.suggestions')}</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => form.setValue('title', s)}
                    className="text-xs px-2.5 py-1 rounded-full border bg-muted/50 hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('task.titleLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Název úkolu..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('task.typeLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cleaning">🧹 Úklid</SelectItem>
                        <SelectItem value="maintenance">🔧 Údržba</SelectItem>
                        <SelectItem value="general">📋 Obecný</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('task.priorityLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">🟢 Nízká</SelectItem>
                        <SelectItem value="medium">🟡 Střední</SelectItem>
                        <SelectItem value="high">🟠 Vysoká</SelectItem>
                        <SelectItem value="urgent">🔴 Urgentní</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="due_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('task.dueDateLabel')}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('task.descriptionLabel')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Volitelný popis..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Zrušit
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? 'Uložit změny' : t('task.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
