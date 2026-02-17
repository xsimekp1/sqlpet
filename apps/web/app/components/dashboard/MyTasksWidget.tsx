'use client';

import { useEffect, useState } from 'react';
import { CheckSquare, ArrowRight, Loader2, Calendar } from 'lucide-react';
import { WidgetCard } from './WidgetCard';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import ApiClient, { Task } from '@/app/lib/api';
import { useAuth } from '@/app/context/AuthContext';

interface MyTasksWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

export function MyTasksWidget({ editMode, onRemove, dragHandleProps }: MyTasksWidgetProps) {
  const t = useTranslations('dashboard')
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const resp = await ApiClient.getTasks({ 
          assigned_to_id: user.id, 
          page_size: 10 
        });
        const pending = resp.items.filter(
          (task: Task) => task.status !== 'completed' && task.status !== 'cancelled'
        );
        setTasks(pending);
      } catch {
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [user?.id]);

  const formatDueDate = (dueAt: string | null) => {
    if (!dueAt) return null;
    const date = new Date(dueAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: `${Math.abs(diffDays)} dní zpožděno`, overdue: true };
    if (diffDays === 0) return { text: 'Dnes', overdue: false };
    if (diffDays === 1) return { text: 'Zítra', overdue: false };
    return { text: `${diffDays} dní`, overdue: false };
  };

  return (
    <WidgetCard
      id="my-tasks"
      title={t('myTasks')}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="h-full"
    >
      {loading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('noMyTasks')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.slice(0, 5).map((task) => {
            const due = formatDueDate(task.due_at);
            
            return (
              <Link
                key={task.id}
                href="/dashboard/tasks"
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${priorityColors[task.priority] || priorityColors.medium}`} />
                  <span className="text-sm truncate group-hover:text-primary">
                    {task.title}
                  </span>
                </div>
                {due && (
                  <span className={`text-xs shrink-0 ${due.overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                    {due.text}
                  </span>
                )}
              </Link>
            );
          })}
          
          {tasks.length > 5 && (
            <Link
              href="/dashboard/tasks"
              className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary pt-2"
            >
              <span>+{tasks.length - 5} dalších</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
