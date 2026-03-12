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
import { formatDate } from '@/app/lib/dateFormat';
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
    queryFn: () => {
      // Don't send is_active param when showing all plans
      const params: Record<string, any> = {};
      if (activeFilter !== 'all') {
        params.is_active = activeFilter === 'active';
      }
      return ApiClient.get('/feeding/plans', params);
    },
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
    if (confirm(t('confirmDeactivate'))) {
      deactivatePlanMutation.mutate(planId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('plans')}</h1>
          <p className="text-muted-foreground">
            {t('plansDescription')}
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
              <SelectValue placeholder={t('filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allPlans')}</SelectItem>
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
              <TableHead>{t('fields.animal')}</TableHead>
              <TableHead>{t('fields.food')}</TableHead>
              <TableHead>{t('fields.amount')}</TableHead>
              <TableHead>{t('timesPerDay')}</TableHead>
              <TableHead>{t('schedule')}</TableHead>
              <TableHead>{t('fields.startDate')}</TableHead>
              <TableHead>{t('fields.endDate')}</TableHead>
              <TableHead className="text-right">{t('actions.title')}</TableHead>
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
                    <Link
                      href={`/dashboard/animals/${plan.animal_id}`}
                      className="hover:underline"
                    >
                      <div className="font-medium">
                        {plan.animal_name || 'Unknown'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {plan.animal_public_code || ''}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {plan.food_name ? (
                      <div>
                        <div className="font-medium">{plan.food_name}</div>
                        {plan.food_brand && (
                          <div className="text-sm text-muted-foreground">
                            {plan.food_brand}
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
                      {formatDate(plan.start_date)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {plan.end_date ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {formatDate(plan.end_date)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t('ongoing')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
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
            {t('showingPlans', { count: plans.length })}
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
