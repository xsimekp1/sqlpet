'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient, Task } from '@/app/lib/api';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, Plus, Ban, ArrowUpDown, Bot, ChevronUp, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'all' | 'active';
type TaskType = 'general' | 'feeding' | 'medical' | 'cleaning' | 'maintenance' | 'administrative' | 'all';

export default function TasksPage() {
  const t = useTranslations('tasks');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Initialize filters from URL query params — default to 'active' (pending + in_progress)
  const initialStatus = (searchParams.get('status') as TaskStatus) || 'active';
  const initialType = (searchParams.get('type') as TaskType) || 'all';

  const [statusFilter, setStatusFilter] = useState<TaskStatus>(initialStatus);
  const [typeFilter, setTypeFilter] = useState<TaskType>(initialType);
  const [prioritySort, setPrioritySort] = useState<'desc' | 'asc' | null>(null);
  const [dueDateSort, setDueDateSort] = useState<'desc' | 'asc' | null>('asc');
  const [page, setPage] = useState(1);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Animation state for dismissing tasks
  const [dismissingTasks, setDismissingTasks] = useState<Set<string>>(new Set());
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());

  // Edit dialog state
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editDueAt, setEditDueAt] = useState('');
  const [feedingDeductions, setFeedingDeductions] = useState<any[]>([]);
  const [feedingDeductionsLoading, setFeedingDeductionsLoading] = useState(false);

  const openEditDialog = (task: Task) => {
    setEditTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditType(task.type);
    setEditPriority(task.priority);
    setEditDueAt(
      task.due_at
        ? format(new Date(task.due_at), "yyyy-MM-dd'T'HH:mm")
        : ''
    );
    setFeedingDeductions([]);
    if (task.type === 'feeding' && task.status === 'completed' && task.task_metadata?.feeding_log_id) {
      setFeedingDeductionsLoading(true);
      ApiClient.getFeedingLogTransactions(task.task_metadata.feeding_log_id)
        .then((txns) => setFeedingDeductions(txns))
        .catch(() => setFeedingDeductions([]))
        .finally(() => setFeedingDeductionsLoading(false));
    }
  };

  // Update filters when URL params change
  useEffect(() => {
    const status = searchParams.get('status') as TaskStatus;
    const type = searchParams.get('type') as TaskType;
    if (status && status !== statusFilter) setStatusFilter(status);
    if (type && type !== typeFilter) setTypeFilter(type);
  }, [searchParams]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  // Server-side pagination: 10 tasks per page, filters sent to API
  const { data: taskData, isLoading } = useQuery({
    queryKey: ['tasks', statusFilter, typeFilter, page],
    queryFn: () => ApiClient.getTasks({
      status: statusFilter === 'all' ? undefined : statusFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
      page,
      page_size: 10,
    }),
    staleTime: 30_000,
  });

  const tasks = taskData?.items || [];
  const totalTasks = taskData?.total ?? 0;
  const totalPages = Math.ceil(totalTasks / 10);

  // Client-side sort by priority or due date
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedTasks = (() => {
    let result = [...tasks];
    if (prioritySort) {
      result.sort((a, b) => {
        const aOrder = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
        const bOrder = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
        return prioritySort === 'desc' ? aOrder - bOrder : bOrder - aOrder;
      });
    } else if (dueDateSort) {
      result.sort((a, b) => {
        // Tasks without due date go to the end
        if (!a.due_at && !b.due_at) return 0;
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        const aTime = new Date(a.due_at).getTime();
        const bTime = new Date(b.due_at).getTime();
        return dueDateSort === 'asc' ? aTime - bTime : bTime - aTime;
      });
    }
    return result;
  })();

  // Complete task mutation with animation
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, isFeedingTask }: { taskId: string; isFeedingTask: boolean }) => {
      if (isFeedingTask) {
        return await ApiClient.completeFeedingTask(taskId);
      } else {
        return await ApiClient.completeTask(taskId);
      }
    },
    onMutate: async ({ taskId }) => {
      // Start animation
      setCompletingTasks(prev => new Set(prev).add(taskId));
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      // Snapshot current state for rollback
      const previousData = queryClient.getQueryData(['tasks', statusFilter, typeFilter, page]);
      // Wait for animation (400ms) before removing from DOM
      await new Promise(resolve => setTimeout(resolve, 400));
      // Optimistically remove task from list
      queryClient.setQueryData(['tasks', statusFilter, typeFilter, page], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((t: Task) => t.id !== taskId),
          total: old.total - 1,
        };
      });
      setCompletingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      return { previousData };
    },
    onSuccess: (data, variables) => {
      if (variables.isFeedingTask) {
        toast({ title: 'Krmný úkol splněn', description: 'Záznam krmení a odečet skladu provedeny.' });
        for (const d of (data as any)?.deductions ?? []) {
          if (d.lot_emptied) {
            toast({
              title: `Šarže ${d.lot_number ?? 'bez čísla'} spotřebována`,
              description: 'Zásoby šarže vyčerpány při krmení.',
            });
          }
        }
      } else if ((data as any)?.linked_inventory_item_id) {
        toast({ title: 'Úkol splněn', description: '1 ks vakcíny odečteno ze skladu.' });
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      } else {
        toast({ title: 'Úkol splněn' });
      }
    },
    onError: (error: Error, variables, context) => {
      // Remove from completing set on error
      setCompletingTasks(prev => {
        const next = new Set(prev);
        next.delete(variables.taskId);
        return next;
      });
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['tasks', statusFilter, typeFilter, page], context.previousData);
      }
      toast({ title: 'Chyba', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Reject/cancel task mutation with animation
  const rejectTaskMutation = useMutation({
    mutationFn: (taskId: string) => ApiClient.cancelTask(taskId, 'rejected'),
    onMutate: async (taskId) => {
      // Start dismissing animation
      setDismissingTasks(prev => new Set(prev).add(taskId));
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      // Snapshot current state for rollback
      const previousData = queryClient.getQueryData(['tasks', statusFilter, typeFilter, page]);
      // Wait for animation before removing
      await new Promise(resolve => setTimeout(resolve, 300));
      // Optimistically remove task from list (if filter shows only active tasks)
      queryClient.setQueryData(['tasks', statusFilter, typeFilter, page], (old: any) => {
        if (!old) return old;
        // If showing cancelled tasks, update status instead of removing
        if (statusFilter === 'cancelled' || statusFilter === 'all') {
          return {
            ...old,
            items: old.items.map((t: Task) =>
              t.id === taskId ? { ...t, status: 'cancelled' } : t
            ),
          };
        }
        // Otherwise remove from list
        return {
          ...old,
          items: old.items.filter((t: Task) => t.id !== taskId),
          total: old.total - 1,
        };
      });
      // Clear dismissing state
      setDismissingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      return { previousData };
    },
    onSuccess: () => {
      toast({ title: 'Úkol zamítnut' });
    },
    onError: (error: Error, taskId, context) => {
      // Remove from dismissing set on error
      setDismissingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['tasks', statusFilter, typeFilter, page], context.previousData);
      }
      toast({ title: 'Chyba', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const STATUS_LABELS: Record<string, string> = {
    pending: 'Čeká',
    in_progress: 'Probíhá',
    completed: 'Splněno',
    cancelled: 'Zrušeno',
  };

  const TYPE_LABELS: Record<string, string> = {
    feeding: 'Krmení',
    medical: 'Medicínský',
    cleaning: 'Úklid',
    maintenance: 'Údržba',
    administrative: 'Administrativní',
    general: 'Obecný',
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      in_progress: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {STATUS_LABELS[status] || status.replace('_', ' ')}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      feeding: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      medical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      cleaning: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      maintenance: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      administrative: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
      general: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    };
    return (
      <Badge className={colors[type] || colors.general} variant="outline">
        {TYPE_LABELS[type] || type}
      </Badge>
    );
  };

  const PRIORITY_LABELS: Record<string, string> = {
    low: 'Nízká',
    medium: 'Střední',
    high: 'Vysoká',
    urgent: 'Urgentní',
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      low: 'outline',
      medium: 'secondary',
      high: 'default',
      urgent: 'destructive',
    };
    if (priority === 'urgent') {
      return (
        <Badge variant={variants[priority]} className="animate-urgent-pulse">
          <img src="/petslog.png" alt="urgent" className="h-4 w-4 mr-1" />
          {PRIORITY_LABELS[priority] || priority}
        </Badge>
      );
    }
    return <Badge variant={variants[priority] || 'outline'}>{PRIORITY_LABELS[priority] || priority}</Badge>;
  };

  const getDueDateColor = (dueAt: string | null, status: string) => {
    if (!dueAt || status === 'completed' || status === 'cancelled') {
      return 'text-muted-foreground';
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueAt);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      // Overdue - red background
      return 'bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded';
    } else if (diffDays === 0) {
      // Today - amber/orange background
      return 'bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded';
    } else if (diffDays <= 2) {
      // Upcoming soon - lighter amber
      return 'bg-amber-50 text-amber-700';
    }
    return '';
  };

  const handleCompleteTask = (task: Task) => {
    const isFeedingTask = task.type === 'feeding';
    completeTaskMutation.mutate({ taskId: task.id, isFeedingTask });
  };

  const handleRejectTask = (task: Task) => {
    rejectTaskMutation.mutate(task.id);
  };

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (title: string) =>
      ApiClient.createTask({ title, priority: newTaskPriority, type: 'general' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewTaskTitle('');
      setShowNewTaskForm(false);
      setPage(1);
      toast({ title: 'Úkol vytvořen' });
    },
    onError: (error: Error) => {
      toast({ title: 'Chyba', description: error.message, variant: 'destructive' });
    },
  });

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return;
    createTaskMutation.mutate(newTaskTitle.trim());
  };

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: () =>
      ApiClient.updateTask(editTask!.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        type: editType as Task['type'],
        priority: editPriority as Task['priority'],
        due_at: editDueAt ? new Date(editDueAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditTask(null);
      toast({ title: 'Úkol uložen' });
    },
    onError: (e: Error) => toast({ title: 'Chyba', description: e.message, variant: 'destructive' }),
  });

  // Delete (cancel) task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: () => ApiClient.cancelTask(editTask!.id, 'deleted'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditTask(null);
      toast({ title: 'Úkol smazán' });
    },
    onError: (e: Error) => toast({ title: 'Chyba', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Načítám úkoly...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Úkoly</h1>
          <p className="text-muted-foreground hidden md:block">Správa a plnění úkolů organizace</p>
        </div>
        <Button onClick={() => setShowNewTaskForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-2" />
          Nový úkol
        </Button>
      </div>

      {/* Inline new-task form */}
      {showNewTaskForm && (
        <div className="flex flex-col gap-2 border rounded-lg p-3 bg-muted/30">
          <Input
            placeholder="Název úkolu..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
            className="w-full"
            autoFocus
          />
          <div className="flex gap-2 items-center">
            <Select
              value={newTaskPriority}
              onValueChange={(v) => setNewTaskPriority(v as 'low' | 'medium' | 'high')}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Nízká</SelectItem>
                <SelectItem value="medium">Střední</SelectItem>
                <SelectItem value="high">Vysoká</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleCreateTask}
              disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
            >
              Přidat
            </Button>
            <Button variant="outline" onClick={() => { setShowNewTaskForm(false); setNewTaskTitle(''); }}>
              Zrušit
            </Button>
          </div>
        </div>
      )}

      {/* Filters — instant frontend filtering, no API calls */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as TaskStatus)}
        >
          <SelectTrigger className="w-36 md:w-48">
            <SelectValue placeholder="Filtr stavu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktivní (čeká + probíhá)</SelectItem>
            <SelectItem value="all">Všechny stavy</SelectItem>
            <SelectItem value="pending">Čeká</SelectItem>
            <SelectItem value="in_progress">Probíhá</SelectItem>
            <SelectItem value="completed">Splněno</SelectItem>
            <SelectItem value="cancelled">Zrušeno</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as TaskType)}
        >
          <SelectTrigger className="w-36 md:w-48">
            <SelectValue placeholder="Filtr typu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny typy</SelectItem>
            <SelectItem value="general">Obecný</SelectItem>
            <SelectItem value="feeding">Krmení</SelectItem>
            <SelectItem value="medical">Medicínský</SelectItem>
            <SelectItem value="cleaning">Úklid</SelectItem>
            <SelectItem value="maintenance">Údržba</SelectItem>
            <SelectItem value="administrative">Administrativní</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={prioritySort ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setDueDateSort(null);
            setPrioritySort(prev => prev === 'desc' ? 'asc' : prev === 'asc' ? null : 'desc');
          }}
          title="Seřadit podle priority"
        >
          <ArrowUpDown className="h-4 w-4 mr-1" />
          {prioritySort === 'desc' ? '↑ Urgentní' : prioritySort === 'asc' ? '↓ Nízká' : 'Priorita'}
        </Button>

        {totalTasks > 0 && (
          <div className="flex items-center text-sm text-muted-foreground ml-auto">
            {totalTasks} úkolů celkem
          </div>
        )}
      </div>

      {/* Tasks Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Název</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Priorita</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead
                className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setPrioritySort(null);
                  setDueDateSort(prev => prev === 'asc' ? 'desc' : 'asc');
                }}
              >
                <div className="flex items-center gap-1">
                  Termín
                  {dueDateSort === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </TableHead>
              <TableHead className="w-10">Zadal</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Žádné úkoly. Vytvořte první úkol.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedTasks.map((task) => (
                <TableRow
                  key={task.id}
                  className={cn(
                    'transition-all duration-300',
                    (dismissingTasks.has(task.id) || completingTasks.has(task.id)) && 'animate-task-dismiss',
                    dismissingTasks.has(task.id) && 'bg-red-50 dark:bg-red-950/30 dismissing',
                    completingTasks.has(task.id) && 'bg-green-50 dark:bg-green-950/30 dismissing'
                  )}
                >
                  <TableCell className="max-w-[240px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="font-medium truncate cursor-pointer hover:underline"
                            onClick={() => openEditDialog(task)}
                          >
                            {task.title}
                          </div>
                        </TooltipTrigger>
                        {task.description && (
                          <TooltipContent side="bottom" className="max-w-xs text-sm">
                            {task.description}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>{getTypeBadge(task.type)}</TableCell>
                  <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                  <TableCell>{getStatusBadge(task.status)}</TableCell>
                  <TableCell>
                    {task.due_at ? (
                      <div className={`text-sm inline-block ${getDueDateColor(task.due_at, task.status)}`}>
                        {format(new Date(task.due_at), 'd. M. yyyy HH:mm')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.created_by_name ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold cursor-default select-none">
                              {task.created_by_name.charAt(0).toUpperCase()}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">{task.created_by_name}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : !task.created_by_name && task.type === 'feeding' ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="h-7 w-7 flex items-center justify-center cursor-default">
                              <Bot className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">Systém</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {(task.status === 'pending' || task.status === 'in_progress') && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleCompleteTask(task)}
                          disabled={completeTaskMutation.isPending || rejectTaskMutation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Splnit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                          onClick={() => handleRejectTask(task)}
                          disabled={completeTaskMutation.isPending || rejectTaskMutation.isPending}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Zamítnout
                        </Button>
                      </div>
                    )}
                    {task.status === 'completed' && (
                      <span className="text-sm text-green-600">✓ Splněno</span>
                    )}
                    {task.status === 'cancelled' && (
                      <span className="text-sm text-muted-foreground">Zamítnuto</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit task dialog */}
      <Dialog open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upravit úkol</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Název *</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Název úkolu..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Popis</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Popis úkolu..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Typ</label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Obecný</SelectItem>
                    <SelectItem value="feeding">Krmení</SelectItem>
                    <SelectItem value="medical">Medicínský</SelectItem>
                    <SelectItem value="cleaning">Úklid</SelectItem>
                    <SelectItem value="maintenance">Údržba</SelectItem>
                    <SelectItem value="administrative">Administrativní</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Priorita</label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Nízká</SelectItem>
                    <SelectItem value="medium">Střední</SelectItem>
                    <SelectItem value="high">Vysoká</SelectItem>
                    <SelectItem value="urgent">Urgentní</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Termín</label>
              <input
                type="datetime-local"
                value={editDueAt}
                onChange={(e) => setEditDueAt(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Stav</label>
              <div className="pt-1">{editTask && getStatusBadge(editTask.status)}</div>
            </div>
            {editTask?.type === 'feeding' && editTask.status === 'completed' && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Spotřeba zásob</label>
                {feedingDeductionsLoading ? (
                  <p className="text-sm text-muted-foreground">Načítám...</p>
                ) : feedingDeductions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Žádný odečet zásob</p>
                ) : (
                  <table className="w-full text-sm border rounded">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-2 py-1">Šarže</th>
                        <th className="text-right px-2 py-1">Množství</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedingDeductions.map((txn: any) => (
                        <tr key={txn.id} className="border-b last:border-0">
                          <td className="px-2 py-1 font-mono text-xs">
                            {txn.lot_id ? txn.lot_id.slice(0, 8) + '…' : '—'}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {typeof txn.quantity === 'number'
                              ? txn.quantity.toFixed(3) + ' kg'
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => {
                if (window.confirm('Opravdu smazat tento úkol?')) {
                  deleteTaskMutation.mutate();
                }
              }}
              disabled={deleteTaskMutation.isPending || updateTaskMutation.isPending}
            >
              Smazat
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditTask(null)}>
                Zrušit
              </Button>
              <Button
                onClick={() => updateTaskMutation.mutate()}
                disabled={!editTitle.trim() || updateTaskMutation.isPending || deleteTaskMutation.isPending}
              >
                Uložit
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      {totalTasks > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Strana {page} z {totalPages || 1}
            &nbsp;· {totalTasks} úkolů celkem
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
            >
              ← Předchozí
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
            >
              Další →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
