'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Loader2, Check, X, AlertCircle, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
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
import { format, addDays, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { cs, enUS } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
  
  // Floating timeline: starts yesterday, shows 30 days
  const [timelineStart, setTimelineStart] = useState(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  });
  const timelineEnd = useMemo(() => addDays(timelineStart, 30), [timelineStart]);
  const [hoveredReservation, setHoveredReservation] = useState<string | null>(null);

  useEffect(() => {
    loadReservations();
    loadTimeline();
  }, [statusFilter, timelineStart]);

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
      const startDate = timelineStart.toISOString().split('T')[0];
      const endDate = timelineEnd.toISOString().split('T')[0];
      
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

  const shiftTimeline = (days: number) => {
    setTimelineStart(prev => addDays(prev, days));
  };

  const resetToToday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setTimelineStart(yesterday);
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline - přehled obsazenosti
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground mr-2">
                {format(timelineStart, 'd.M.yyyy')} – {format(timelineEnd, 'd.M.yyyy')}
              </div>
              <Button variant="outline" size="sm" onClick={() => shiftTimeline(-7)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={resetToToday}>
                Dnes
              </Button>
              <Button variant="outline" size="sm" onClick={() => shiftTimeline(7)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
                          const entryDate = new Date(entry.date);
                          const dayOfWeek = entryDate.getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          const isFirstOfMonth = entryDate.getDate() === 1;
                          
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

                          // Status colors matching KennelTimeline style
                          const getStatusColor = () => {
                            if (entry.entry_type !== 'reservation') {
                              return isWeekend ? 'bg-gray-100' : 'bg-muted/20';
                            }
                            switch (entry.status) {
                              case 'pending':
                                return 'bg-yellow-400';
                              case 'confirmed':
                                return 'bg-blue-500';
                              case 'checked_in':
                                return 'bg-green-500';
                              case 'checked_out':
                                return 'bg-gray-400';
                              case 'cancelled':
                                return 'bg-red-300';
                              default:
                                return 'bg-gray-300';
                            }
                          };

                          const isHovered = hoveredReservation === entry.reservation_id;

                          return (
                            <TooltipProvider key={idx}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    className={cn(
                                      "flex-1 min-w-[40px] h-12 border-r flex items-center justify-center text-xs cursor-pointer transition-all duration-200",
                                      getStatusColor(),
                                      entry.entry_type === 'reservation' && "border-l-4",
                                      entry.entry_type === 'reservation' && (entry.status === 'pending' ? 'border-yellow-500' : entry.status === 'confirmed' ? 'border-blue-600' : entry.status === 'checked_in' ? 'border-green-600' : 'border-gray-500'),
                                      isHovered && "scale-[1.02] shadow-lg z-10 rounded-md"
                                    )}
                                    style={{
                                      // Add subtle month separator
                                      borderLeft: isFirstOfMonth ? '2px solid #94a3b8' : undefined,
                                      marginLeft: isFirstOfMonth ? '-1px' : undefined,
                                    }}
                                    title={entry.animal_name ? `${entry.animal_name} (${entry.status}) - klikněte pro editaci` : 'Volno'}
                                    onClick={() => entry.reservation_id && setSelectedReservationId(entry.reservation_id)}
                                    onMouseEnter={() => entry.reservation_id && setHoveredReservation(entry.reservation_id)}
                                    onMouseLeave={() => setHoveredReservation(null)}
                                  >
                                    {entry.reservation_id && isActuallyMiddle && entry.animal_name && (
                                      <span className="truncate px-1 font-medium text-white text-[10px] drop-shadow-md">
                                        {entry.animal_name.substring(0, 8)}
                                      </span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                {entry.animal_name && (
                                  <TooltipContent>
                                    <div className="text-sm">
                                      <p className="font-medium">{entry.animal_name}</p>
                                      <p className="text-muted-foreground capitalize">{STATUS_LABELS[entry.status] || entry.status}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {format(entryDate, 'd.M.yyyy')}
                                      </p>
                                    </div>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
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