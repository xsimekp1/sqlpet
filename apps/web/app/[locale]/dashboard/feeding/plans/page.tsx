'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/app/lib/api';
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
import { Plus, CheckCircle2, XCircle, AlertCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

type ActiveFilter = 'all' | 'active' | 'inactive';

export default function FeedingPlansPage() {
  const t = useTranslations('feeding');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');

  // Epic 8 - Lazy fallback: Ensure feeding tasks exist for 48h window when user opens feeding page
  useEffect(() => {
    ApiClient.ensureFeedingTasksWindow(48).catch(console.error);
  }, []);

  // Fetch feeding plans
  const { data: plansData, isLoading } = useQuery({
    queryKey: ['feeding-plans', activeFilter],
    queryFn: () =>
      ApiClient.get('/feeding/plans', {
        is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
      }),
  });

  const plans = plansData?.items || [];

  // Deactivate plan mutation
  const deactivatePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return await ApiClient.delete(`/feeding/plans/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeding-plans'] });
      toast({
        title: t('messages.planDeactivated'),
        description: t('messages.planDeactivatedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('messages.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDeactivate = (planId: string) => {
    if (confirm('Are you sure you want to deactivate this feeding plan?')) {
      deactivatePlanMutation.mutate(planId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading plans...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('plans')}</h1>
          <p className="text-muted-foreground">
            Manage feeding schedules for animals
          </p>
        </div>
        <Link href="/dashboard/feeding/plans/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('createPlan')}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="w-48">
          <Select
            value={activeFilter}
            onValueChange={(value) => setActiveFilter(value as ActiveFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="active">{t('active')}</SelectItem>
              <SelectItem value="inactive">{t('inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Plans Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Animal</TableHead>
              <TableHead>Food</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Times/Day</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {t('noPlans')}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan: any) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    {plan.is_active ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {plan.animal?.name || 'Unknown'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {plan.animal?.public_code || ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    {plan.food ? (
                      <div>
                        <div className="font-medium">{plan.food.name}</div>
                        {plan.food.brand && (
                          <div className="text-sm text-muted-foreground">
                            {plan.food.brand}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {plan.amount_g ? (
                      <span>{plan.amount_g}g</span>
                    ) : plan.amount_text ? (
                      <span className="text-sm">{plan.amount_text}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {plan.times_per_day || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {plan.schedule_json && Array.isArray(plan.schedule_json) ? (
                      <div className="flex flex-wrap gap-1">
                        {plan.schedule_json.map((time: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {time}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(plan.start_date), 'MMM d, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {plan.end_date ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(plan.end_date), 'MMM d, yyyy')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Ongoing</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/dashboard/feeding/plans/${plan.id}`}>
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      </Link>
                      {plan.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeactivate(plan.id)}
                          disabled={deactivatePlanMutation.isPending}
                        >
                          {t('actions.deactivate')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {plans.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {plans.length} plan{plans.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-4">
            <span>
              {t('summary.active')}: {plans.filter((p: any) => p.is_active).length}
            </span>
            <span>
              {t('summary.inactive')}: {plans.filter((p: any) => !p.is_active).length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
