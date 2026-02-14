'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient, Task } from '@/app/lib/api';
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
import { CheckCircle2, Circle, Clock, XCircle, AlertCircle, Plus, Ban } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'all';
type TaskType = 'general' | 'feeding' | 'medical' | 'cleaning' | 'maintenance' | 'administrative' | 'all';

export default function TasksPage() {
  const t = useTranslations('tasks');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Initialize filters from URL query params
  const initialStatus = (searchParams.get('status') as TaskStatus) || 'all';
  const initialType = (searchParams.get('type') as TaskType) || 'all';

  const [statusFilter, setStatusFilter] = useState<TaskStatus>(initialStatus);
  const [typeFilter, setTypeFilter] = useState<TaskType>(initialType);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Update filters when URL params change
  useEffect(() => {
    const status = searchParams.get('status') as TaskStatus;
    const type = searchParams.get('type') as TaskType;
    if (status && status !== statusFilter) setStatusFilter(status);
    if (type && type !== typeFilter) setTypeFilter(type);
  }, [searchParams]);

  // Fetch ALL tasks once — filter on frontend to avoid re-fetching on every filter change
  const { data: taskData, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => ApiClient.getTasks({ page_size: 500 }),
    staleTime: 30_000,
  });

  const allTasks = taskData?.items || [];

  // Frontend filtering — instant, no API calls
  const tasks = useMemo(() => {
    return allTasks.filter(task => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (typeFilter !== 'all' && task.type !== typeFilter) return false;
      return true;
    });
  }, [allTasks, statusFilter, typeFilter]);

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, isFeedingTask }: { taskId: string; isFeedingTask: boolean }) => {
      if (isFeedingTask) {
        return await ApiClient.completeFeedingTask(taskId);
      } else {
        return await ApiClient.completeTask(taskId);
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (variables.isFeedingTask) {
        toast({ title: 'Krmný úkol splněn', description: 'Záznam krmení a odečet skladu provedeny.' });
      } else {
        toast({ title: 'Úkol splněn' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Chyba', description: error.message, variant: 'destructive' });
    },
  });

  // Reject/cancel task mutation
  const rejectTaskMutation = useMutation({
    mutationFn: (taskId: string) => ApiClient.cancelTask(taskId, 'rejected'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Úkol zamítnut' });
    },
    onError: (error: Error) => {
      toast({ title: 'Chyba', description: error.message, variant: 'destructive' });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <Circle className="h-4 w-4 text-yellow-600" />;
    }
  };

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
    return <Badge variant={variants[priority] || 'outline'}>{PRIORITY_LABELS[priority] || priority}</Badge>;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Načítám úkoly...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Úkoly</h1>
          <p className="text-muted-foreground">Správa a plnění úkolů organizace</p>
        </div>
        <Button onClick={() => setShowNewTaskForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-2" />
          Nový úkol
        </Button>
      </div>

      {/* Inline new-task form */}
      {showNewTaskForm && (
        <div className="flex gap-2 items-center border rounded-lg p-3 bg-muted/30">
          <Input
            placeholder="Název úkolu..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
            className="flex-1"
            autoFocus
          />
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
      )}

      {/* Filters — instant frontend filtering, no API calls */}
      <div className="flex gap-4">
        <div className="w-48">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as TaskStatus)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filtr stavu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny stavy</SelectItem>
              <SelectItem value="pending">Čeká</SelectItem>
              <SelectItem value="in_progress">Probíhá</SelectItem>
              <SelectItem value="completed">Splněno</SelectItem>
              <SelectItem value="cancelled">Zrušeno</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as TaskType)}
          >
            <SelectTrigger>
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
        </div>

        {(statusFilter !== 'all' || typeFilter !== 'all') && (
          <div className="flex items-center text-sm text-muted-foreground">
            {tasks.length} z {allTasks.length} úkolů
          </div>
        )}
      </div>

      {/* Tasks Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Název</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Priorita</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead>Termín</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {allTasks.length === 0
                        ? 'Žádné úkoly. Vytvořte první úkol.'
                        : 'Žádné úkoly odpovídají filtru.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{getStatusIcon(task.status)}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {task.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(task.type)}</TableCell>
                  <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                  <TableCell>{getStatusBadge(task.status)}</TableCell>
                  <TableCell>
                    {task.due_at ? (
                      <div className="text-sm">
                        {format(new Date(task.due_at), 'd. M. yyyy HH:mm')}
                      </div>
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

      {/* Summary */}
      {allTasks.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Zobrazeno {tasks.length} z {allTasks.length} úkolů
          </div>
          <div className="flex gap-4">
            <span>Čeká: {allTasks.filter((t) => t.status === 'pending').length}</span>
            <span>Splněno: {allTasks.filter((t) => t.status === 'completed').length}</span>
            <span>Zamítnuto: {allTasks.filter((t) => t.status === 'cancelled').length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
