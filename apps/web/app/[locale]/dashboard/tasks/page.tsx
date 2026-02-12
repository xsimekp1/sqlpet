'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient, Task } from '@/lib/api';
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
import { CheckCircle2, Circle, Clock, XCircle, AlertCircle } from 'lucide-react';
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

  // Update filters when URL params change
  useEffect(() => {
    const status = searchParams.get('status') as TaskStatus;
    const type = searchParams.get('type') as TaskType;
    if (status && status !== statusFilter) setStatusFilter(status);
    if (type && type !== typeFilter) setTypeFilter(type);
  }, [searchParams]);

  // Fetch tasks
  const { data: taskData, isLoading } = useQuery({
    queryKey: ['tasks', statusFilter, typeFilter],
    queryFn: () =>
      ApiClient.getTasks({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      }),
  });

  const tasks = taskData?.items || [];

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
        toast({
          title: 'Feeding task completed',
          description: 'Feeding log created and inventory deducted automatically',
        });
      } else {
        toast({
          title: 'Task completed',
          description: 'The task has been marked as completed',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      in_progress: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace('_', ' ')}
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
        {type}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      low: 'outline',
      medium: 'secondary',
      high: 'default',
      urgent: 'destructive',
    };
    return <Badge variant={variants[priority] || 'outline'}>{priority}</Badge>;
  };

  const handleCompleteTask = (task: Task) => {
    const isFeedingTask = task.type === 'feeding';
    completeTaskMutation.mutate({ taskId: task.id, isFeedingTask });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            Manage and complete tasks for your organization
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="w-48">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as TaskStatus)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as TaskType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="feeding">Feeding</SelectItem>
              <SelectItem value="medical">Medical</SelectItem>
              <SelectItem value="cleaning">Cleaning</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="administrative">Administrative</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No tasks found. Create your first task to get started.
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
                        {format(new Date(task.due_at), 'MMM d, yyyy HH:mm')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {task.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleCompleteTask(task)}
                        disabled={completeTaskMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Complete
                      </Button>
                    )}
                    {task.status === 'completed' && (
                      <span className="text-sm text-green-600">✓ Done</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-4">
            <span>
              Pending: {tasks.filter((t) => t.status === 'pending').length}
            </span>
            <span>
              Completed: {tasks.filter((t) => t.status === 'completed').length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
