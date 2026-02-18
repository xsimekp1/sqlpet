'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Loader2, Calendar, DollarSign, User, Home, Check, X, AlertCircle, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Link from 'next/link';
import { format } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const org = typeof window !== 'undefined' ? localStorage.getItem('selectedOrg') : null;
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (org) {
    try {
      headers['x-organization-id'] = JSON.parse(org).id;
    } catch {}
  }
  return headers;
}

interface HotelReservation {
  id: string;
  kennel_id: string;
  kennel_name: string | null;
  contact_id: string | null;
  animal_name: string;
  animal_species: string;
  animal_breed: string | null;
  reserved_from: string;
  reserved_to: string;
  price_per_day: number | null;
  total_price: number | null;
  is_paid: boolean;
  requires_single_cage: boolean;
  status: string;
  notes: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Čeká',
  confirmed: 'Potvrzeno',
  checked_in: 'Nastoupila',
  checked_out: 'Odjela',
  cancelled: 'Zrušeno',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  checked_in: 'bg-green-100 text-green-800 border-green-200',
  checked_out: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

export default function HotelReservationsPage() {
  const t = useTranslations('hotel');
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    loadReservations();
  }, [statusFilter]);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/hotel/reservations${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      setReservations(data);
    } catch {
      toast.error('Nepodařilo se načíst rezervace');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/hotel/reservations/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Unauthorized');
      toast.success('Rezervace zrušena');
      loadReservations();
    } catch {
      toast.error('Nepodařilo se zrušit rezervaci');
    }
  };

  const handleCheckin = async (id: string) => {
    try {
      const res = await fetch(`/api/hotel/reservations/${id}/checkin`, { 
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Unauthorized');
      toast.success('Check-in proveden');
      loadReservations();
    } catch (error: any) {
      toast.error(error.message || 'Nepodařilo se provést check-in');
    }
  };

  const handleCheckout = async (id: string) => {
    try {
      const res = await fetch(`/api/hotel/reservations/${id}/checkout`, { 
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Unauthorized');
      toast.success('Check-out proveden');
      loadReservations();
    } catch (error: any) {
      toast.error(error.message || 'Nepodařilo se provést check-out');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hotelové rezervace</h1>
          <p className="text-muted-foreground">Správa hotelových pobytů pro zvířata</p>
        </div>
        <Link href="/dashboard/hotel/reservations/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nová rezervace
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Select value={statusFilter || undefined} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Všechny statusy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny statusy</SelectItem>
            <SelectItem value="pending">Čeká na potvrzení</SelectItem>
            <SelectItem value="confirmed">Potvrzeno</SelectItem>
            <SelectItem value="completed">Dokončeno</SelectItem>
            <SelectItem value="cancelled">Zrušeno</SelectItem>
          </SelectContent>
        </Select>
        </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : reservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>Žádné rezervace</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Od</TableHead>
                  <TableHead>Do</TableHead>
                  <TableHead>Zvíře</TableHead>
                  <TableHead>Druh</TableHead>
                  <TableHead>Kotec</TableHead>
                  <TableHead>Cena</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((res) => (
                  <TableRow key={res.id}>
                    <TableCell>{format(new Date(res.reserved_from), 'd.M.yyyy')}</TableCell>
                    <TableCell>{format(new Date(res.reserved_to), 'd.M.yyyy')}</TableCell>
                    <TableCell className="font-medium">{res.animal_name}</TableCell>
                    <TableCell className="capitalize">{res.animal_species}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{res.kennel_name || (res.kennel_id ? `Kotec ${res.kennel_id.slice(0, 8)}` : '-')}</Badge>
                    </TableCell>
                    <TableCell>
                      {res.total_price ? `${res.total_price} Kč` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[res.status]}>
                        {STATUS_LABELS[res.status] || res.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {res.status === 'pending' || res.status === 'confirmed' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCheckin(res.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Check-in
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleCancel(res.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : res.status === 'checked_in' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCheckout(res.id)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Check-out
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent reservations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Poslední rezervace</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {reservations
                .filter(r => r.status !== 'cancelled' && r.status !== 'checked_out')
                .sort((a, b) => new Date(b.reserved_from).getTime() - new Date(a.reserved_from).getTime())
                .slice(0, 10)
                .map((res) => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {res.animal_name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{res.animal_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(res.reserved_from), 'd.M.yyyy')} - {format(new Date(res.reserved_to), 'd.M.yyyy')}
                        </p>
                      </div>
                    </div>
                    <Badge className={STATUS_COLORS[res.status]}>
                      {STATUS_LABELS[res.status] || res.status}
                    </Badge>
                  </div>
                ))}
              {reservations.filter(r => r.status !== 'cancelled' && r.status !== 'checked_out').length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">Žádné aktivní rezervace</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
