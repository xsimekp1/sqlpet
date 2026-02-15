'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ApiClient from '@/app/lib/api';
import { toast } from 'sonner';

interface IntakeRecord {
  id: string;
  animal_id: string;
  animal_name: string | null;
  animal_species: string | null;
  reason: string;
  intake_date: string;
  planned_end_date: string | null;
  funding_source: string | null;
  notes: string | null;
}

const REASON_LABELS: Record<string, string> = {
  found: 'Nález',
  return: 'Návrat',
  surrender: 'Odevzdání',
  official: 'Úřední příděl',
  transfer: 'Převod',
  other: 'Jiné',
};

const REASON_COLORS: Record<string, string> = {
  found: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  return: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  surrender: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  official: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  transfer: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

export default function IntakePage() {
  const [intakes, setIntakes] = useState<IntakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasonFilter, setReasonFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = reasonFilter ? `?reason=${reasonFilter}` : '';
        const data = await ApiClient.get(`/intakes${params}`);
        setIntakes(data);
      } catch {
        toast.error('Nepodařilo se načíst příjmy');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [reasonFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Příjmy zvířat</h1>
          <p className="text-muted-foreground mt-1">Přehled všech příjmů zvířat do útulku</p>
        </div>
        <Link href="/dashboard/intake/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nový příjem
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={reasonFilter || '__all__'} onValueChange={v => setReasonFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Všechny důvody" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Všechny důvody</SelectItem>
            {Object.entries(REASON_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : intakes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Žádné příjmy</p>
            <Link href="/dashboard/intake/new" className="mt-4">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Nový příjem
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Zvíře</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Důvod příjmu</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Datum příjmu</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plánovaný konec</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Způsob financování</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Poznámky</th>
                </tr>
              </thead>
              <tbody>
                {intakes.map(intake => (
                  <tr key={intake.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/animals/${intake.animal_id}`}
                        className="text-primary hover:underline font-medium text-sm"
                      >
                        {intake.animal_name ?? `${intake.animal_id.slice(0, 8)}…`}
                      </Link>
                      {intake.animal_species && (
                        <span className="ml-2 text-xs text-muted-foreground capitalize">{intake.animal_species}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${REASON_COLORS[intake.reason] ?? ''}`}>
                        {REASON_LABELS[intake.reason] ?? intake.reason}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(intake.intake_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {intake.planned_end_date
                        ? new Date(intake.planned_end_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {intake.funding_source ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                      {intake.notes ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
