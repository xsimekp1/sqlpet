'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ClipboardList, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
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
import ApiClient, { Task, Animal, Kennel } from '@/app/lib/api';

const schema = z.object({
  title: z.string().min(1, 'Název je povinný'),
  type: z.enum(['general', 'feeding', 'medical', 'cleaning', 'maintenance', 'administrative']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  due_at: z.string().optional(),
  description: z.string().optional(),
  entity_kind: z.enum(['none', 'animal', 'kennel']).optional(),
  entity_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (task: Task) => void;
}

export function CreateTaskDialog({ open, onOpenChange, onCreated }: CreateTaskDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [animals, setAnimals] = useState<Pick<Animal, 'id' | 'name' | 'public_code'>[]>([]);
  const [kennels, setKennels] = useState<Pick<Kennel, 'id' | 'name' | 'code'>[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      type: 'general',
      priority: 'medium',
      due_at: '',
      description: '',
      entity_kind: 'none',
      entity_id: '',
    },
  });

  const entityKind = form.watch('entity_kind');

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoadingEntities(true);
      try {
        const [animalsResp, kennelsResp] = await Promise.all([
          ApiClient.getAnimals({ page_size: 100 }).catch(() => ({ items: [] })),
          ApiClient.getKennels().catch(() => []),
        ]);
        setAnimals(animalsResp.items.map(a => ({ id: a.id, name: a.name, public_code: a.public_code })));
        setKennels((kennelsResp as Kennel[]).map(k => ({ id: k.id, name: k.name, code: k.code })));
      } finally {
        setLoadingEntities(false);
      }
    };
    load();
  }, [open]);

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const payload: Parameters<typeof ApiClient.createTask>[0] = {
        title: values.title,
        type: values.type,
        priority: values.priority,
        due_at: values.due_at || undefined,
        description: values.description || undefined,
      };
      if (values.entity_kind !== 'none' && values.entity_id) {
        payload.related_entity_type = values.entity_kind;
        payload.related_entity_id = values.entity_id;
      }
      const task = await ApiClient.createTask(payload);
      toast.success('Úkol byl vytvořen');
      form.reset();
      onCreated?.(task);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Nepodařilo se vytvořit úkol');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Nový úkol
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Název *</FormLabel>
                  <FormControl>
                    <Input placeholder="Název úkolu..." autoFocus {...field} />
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
                    <FormLabel>Typ</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="general">📋 Obecný</SelectItem>
                        <SelectItem value="feeding">🍖 Krmení</SelectItem>
                        <SelectItem value="medical">💊 Lékařský</SelectItem>
                        <SelectItem value="cleaning">🧹 Úklid</SelectItem>
                        <SelectItem value="maintenance">🔧 Údržba</SelectItem>
                        <SelectItem value="administrative">📄 Admin</SelectItem>
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
                    <FormLabel>Priorita</FormLabel>
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
                  <FormLabel>Termín</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Entity link */}
            <FormField
              control={form.control}
              name="entity_kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Navázat na entitu</FormLabel>
                  <Select onValueChange={v => { field.onChange(v); form.setValue('entity_id', ''); }} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">— Bez entity</SelectItem>
                      <SelectItem value="animal">🐾 Zvíře</SelectItem>
                      <SelectItem value="kennel">🏠 Kotec</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {entityKind === 'animal' && (
              <FormField
                control={form.control}
                name="entity_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zvíře</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingEntities ? 'Načítám...' : 'Vyberte zvíře'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {animals.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} #{a.public_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {entityKind === 'kennel' && (
              <FormField
                control={form.control}
                name="entity_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kotec</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingEntities ? 'Načítám...' : 'Vyberte kotec'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {kennels.map(k => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.code} – {k.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Popis</FormLabel>
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
                Vytvořit úkol
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
