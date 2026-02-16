'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, MapPin, Calendar, User, Loader2, X, 
  ChevronLeft, ChevronRight, PawPrint, Table2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiClient, Finding, FindingListResponse } from '@/app/lib/api';
import { toast } from 'sonner';

interface Contact {
  id: string;
  name: string;
  email: string | null;
}

const DATE_PRESETS = [
  { value: 'all', label: 'Všechny záznamy' },
  { value: 'today', label: 'Dnes' },
  { value: 'week', label: 'Tento týden' },
  { value: 'month', label: 'Tento měsíc' },
  { value: 'year', label: 'Tento rok' },
];

const RADIUS_OPTIONS = [
  { value: '5', label: '5 km' },
  { value: '10', label: '10 km' },
  { value: '25', label: '25 km' },
  { value: '50', label: '50 km' },
];

export default function FindingsReportWidget() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'table'>('table');

  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [radius, setRadius] = useState('10');

  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchingContacts, setSearchingContacts] = useState(false);

  useEffect(() => {
    if (!contactSearch || contactSearch.length < 2) {
      setContacts([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingContacts(true);
      try {
        const result = await ApiClient.searchContacts(contactSearch);
        setContacts(result);
      } catch {
        setContacts([]);
      } finally {
        setSearchingContacts(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [contactSearch]);

  const getDateRange = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    switch (datePreset) {
      case 'today':
        return { from: today, to: today };
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { from: weekAgo.toISOString().split('T')[0], to: today };
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { from: monthAgo.toISOString().split('T')[0], to: today };
      }
      case 'year': {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return { from: yearAgo.toISOString().split('T')[0], to: today };
      }
      default:
        return { from: dateFrom || undefined, to: dateTo || undefined };
    }
  };

  const fetchFindings = async () => {
    setLoading(true);
    try {
      const dateRange = getDateRange();
      const params: any = {
        page,
        page_size: pageSize,
      };
      
      if (dateRange.from) params.date_from = dateRange.from;
      if (dateRange.to) params.date_to = dateRange.to;
      if (selectedContact) params.who_found_id = selectedContact.id;
      if (gpsLat !== null && gpsLng !== null) {
        params.lat = gpsLat;
        params.lng = gpsLng;
        params.radius_km = parseFloat(radius);
      }

      const result = await ApiClient.getFindings(params);
      setFindings(result.items);
      setTotal(result.total);
    } catch (err: any) {
      toast.error('Nepodařilo se načíst nálezy: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  const handleMapClick = (lat: number, lng: number) => {
    setGpsLat(lat);
    setGpsLng(lng);
  };

  const clearGpsFilter = () => {
    setGpsLat(null);
    setGpsLng(null);
  };

  const clearContactFilter = () => {
    setSelectedContact(null);
    setContactSearch('');
  };

  const hasFilters = datePreset !== 'all' || dateFrom || dateTo || selectedContact || gpsLat !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Nalezená zvířata (Nálezy)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              <Table2 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('map')}
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Období</Label>
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {datePreset === 'all' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Od</Label>
                <Input 
                  type="date" 
                  value={dateFrom} 
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-[140px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Do</Label>
                <Input 
                  type="date" 
                  value={dateTo} 
                  onChange={e => setDateTo(e.target.value)}
                  className="w-[140px]"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Nálezce</Label>
            <div className="relative">
              <Input
                placeholder="Hledat kontakt..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                className="w-[180px] pr-8"
                disabled={!!selectedContact}
              />
              {selectedContact && (
                <button
                  onClick={clearContactFilter}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
              {!selectedContact && contacts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-48 overflow-auto">
                  {contacts.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedContact(c);
                        setContactSearch(c.name);
                        setContacts([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    >
                      {c.name}
                      {c.email && <span className="text-muted-foreground ml-2">{c.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">GPS filtr</Label>
            <div className="flex items-center gap-1">
              {gpsLat !== null && gpsLng !== null ? (
                <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded">
                  <span className="text-xs">
                    {gpsLat.toFixed(4)}, {gpsLng.toFixed(4)}
                  </span>
                  <button onClick={clearGpsFilter}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Klikněte na mapu</span>
              )}
            </div>
          </div>

          {gpsLat !== null && gpsLng !== null && (
            <div className="space-y-1">
              <Label className="text-xs">Vzdálenost</Label>
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button 
            onClick={() => { setPage(1); fetchFindings(); }}
            disabled={loading}
            className="mb-0.5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Vyhledat
          </Button>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDatePreset('all');
                setDateFrom('');
                setDateTo('');
                setSelectedContact(null);
                setContactSearch('');
                clearGpsFilter();
                setPage(1);
                fetchFindings();
              }}
              className="mb-0.5 text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Vymazat
            </Button>
          )}
        </div>

        {/* Map View */}
        {viewMode === 'map' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Klikněte na mapu pro výběr bodu GPS filtru
            </p>
          )}

          {/* Map View - disabled until map library is resolved */}
          {viewMode === 'map' && (
            <div className="h-[300px] rounded-lg bg-muted flex items-center justify-center">
              <p className="text-muted-foreground">Mapa bude dostupná po vyřešení kompatibility</p>
            </div>
          )}

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Nalezeno {total} záznamů
        </div>

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="border rounded-lg overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Datum</th>
                  <th className="text-left px-3 py-2 font-medium">Nálezce</th>
                  <th className="text-left px-3 py-2 font-medium">Zvíře</th>
                  <th className="text-left px-3 py-2 font-medium">GPS</th>
                  <th className="text-left px-3 py-2 font-medium">Poznámky</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : findings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      Žádné záznamy nenalezeny
                    </td>
                  </tr>
                ) : (
                  findings.map(finding => (
                    <tr key={finding.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">
                        {new Date(finding.when_found).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="px-3 py-2">
                        {finding.who_found_name || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {finding.animal_id ? (
                          <Link 
                            href={`/dashboard/animals/${finding.animal_id}`}
                            className="flex items-center gap-1 hover:underline text-primary"
                          >
                            <PawPrint className="h-3 w-3" />
                            {finding.animal_name || finding.animal_public_code || 'Neznámé'}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Zvíře již neexistuje</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono">
                        {finding.where_lat && finding.where_lng ? (
                          <span className="text-muted-foreground">
                            {finding.where_lat.toFixed(4)}, {finding.where_lng.toFixed(4)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate">
                        {finding.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Stránka {page} z {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
