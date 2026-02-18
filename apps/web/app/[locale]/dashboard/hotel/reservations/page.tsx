'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Loader2, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  animal_name: string;
  animal_species: string;
  reserved_from: string;
  reserved_to: string;
  total_price: number | null;
  status: string;
}

interface TimelineEntry {
  date: string;
  kennel_id: string;
  kennel_name: string;
  reservation_id: string | null;
  animal_name: string | null;
  status: string | null;
  entry_type: 'reservation' | 'empty';
}

interface TimelineData {
  start_date: string;
  end_date: string;
  kennels: { id: string; name: string }[];
  timeline: TimelineEntry[];
}

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
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [loadingTable, setLoadingTable] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  useEffect(() => {
    loadReservations();
    loadTimeline();
  }, [statusFilter]);

  const loadReservations = async () => {
    setLoadingTable(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/hotel/reservations${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      setReservations(data);
    } catch {
      toast.error('Nepodařilo se načíst rezervace');
    } finally {
      setLoadingTable(false);
    }
  };

  const loadTimeline = async () => {
    setLoadingTimeline(true);
    try {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const res = await fetch(`/api/hotel/reservations/timeline?start_date=${startDate}&end_date=${endDate}`, { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      setTimelineData(data);
    } catch {
      toast.error('Nepodařilo se načíst timeline');
    } finally {
      setLoadingTimeline(false);
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

      <div className="flex gap-4 items-center justify-between">
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
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingTable ? (
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
                      <Badge variant="outline">{res.kennel_name || '-'}</Badge>
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
                            <Button size="sm" variant="outline" onClick={() => handleCheckin(res.id)}>
                              <Check className="h-4 w-4 mr-1" />
                              Check-in
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleCancel(res.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : res.status === 'checked_in' ? (
                          <Button size="sm" variant="outline" onClick={() => handleCheckout(res.id)}>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline - přehled obsazenosti</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTimeline ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !timelineData || timelineData.timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>Žádná data pro timeline</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="flex border-b sticky top-0 bg-background z-10">
                  <div className="w-32 flex-shrink-0 p-2 font-medium text-sm border-r">Kotec</div>
                  {(() => {
                    const dates: string[] = [];
                    const current = new Date(timelineData.start_date);
                    const end = new Date(timelineData.end_date);
                    while (current <= end) {
                      dates.push(current.toISOString().split('T')[0]);
                      current.setDate(current.getDate() + 1);
                    }
                    return dates.map(d => {
                      const dayOfWeek = new Date(d).getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      return (
                        <div key={d} className={`flex-1 min-w-[40px] p-1 text-center text-xs border-r ${isWeekend ? 'bg-gray-200' : ''}`}>
                          <div className="font-medium">{format(new Date(d), 'd.M')}</div>
                          <div className={`text-muted-foreground text-[10px] ${isWeekend ? 'font-semibold' : ''}`}>{format(new Date(d), 'EEE')}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
                
                {timelineData.kennels.map(kennel => {
                  const kennelEntries = timelineData.timeline.filter(t => t.kennel_id === kennel.id);
                  
                  // Find reservation spans for calculating middle day
                  const reservationSpans: Record<string, {from: string, to: string}> = {};
                  kennelEntries.forEach(entry => {
                    if (entry.reservation_id && entry.entry_type === 'reservation') {
                      if (!reservationSpans[entry.reservation_id]) {
                        reservationSpans[entry.reservation_id] = { from: entry.date, to: entry.date };
                      } else {
                        reservationSpans[entry.reservation_id].to = entry.date;
                      }
                    }
                  });

                  return (
                    <div key={kennel.id} className="flex border-b hover:bg-muted/30">
                      <div className="w-32 flex-shrink-0 p-2 font-medium text-sm border-r flex items-center">
                        {kennel.name}
                      </div>
                      <div className="flex-1 flex">
                        {kennelEntries.map((entry, idx) => {
                          const dayOfWeek = new Date(entry.date).getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          
                          // Calculate if this is the middle day of the reservation
                          const span = entry.reservation_id ? reservationSpans[entry.reservation_id] : null;
                          const isActuallyMiddle = (() => {
                            if (!span || !entry.reservation_id) return false;
                            const fromDate = new Date(span.from);
                            const toDate = new Date(span.to);
                            const currentDate = new Date(entry.date);
                            const totalDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
                            const currentDayNum = Math.round((currentDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
                            return currentDayNum === Math.floor(totalDays / 2);
                          })();

                          return (
                            <div 
                              key={idx} 
                              className={`flex-1 min-w-[40px] h-12 border-r flex items-center justify-center text-xs cursor-pointer ${
                                entry.entry_type === 'reservation' 
                                  ? entry.status === 'pending' 
                                    ? 'bg-yellow-100 hover:bg-yellow-200' 
                                    : entry.status === 'confirmed'
                                    ? 'bg-blue-100 hover:bg-blue-200'
                                    : entry.status === 'checked_in'
                                    ? 'bg-green-100 hover:bg-green-200'
                                    : 'bg-gray-100 hover:bg-gray-200'
                                  : isWeekend 
                                    ? 'bg-gray-100 hover:bg-gray-200' 
                                    : 'bg-muted/20 hover:bg-muted/40'
                              }`}
                              title={entry.animal_name ? `${entry.animal_name} (${entry.status}) - klikněte pro editaci` : 'Volno'}
                              onClick={() => entry.reservation_id && setSelectedReservationId(entry.reservation_id)}
                            >
                              {entry.reservation_id && isActuallyMiddle && entry.animal_name && (
                                <span className="truncate px-1 font-medium text-[10px]">
                                  {entry.animal_name.substring(0, 6)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}