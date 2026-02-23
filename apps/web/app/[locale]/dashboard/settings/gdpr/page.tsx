'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Download, Loader2, Shield, LogIn, HardDrive, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ApiClient from '@/app/lib/api';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface LoginLogItem {
  id: string;
  user_id: string | null;
  email: string;
  ip: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
}

interface LoginLogsResponse {
  items: LoginLogItem[];
  total: number;
  page: number;
  size: number;
}

export default function GdprSettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [successFilter, setSuccessFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const queryParams: Record<string, any> = { page, size: 50 };
  if (successFilter !== 'all') queryParams.success = successFilter === 'true';
  if (fromDate) queryParams.from_date = fromDate;
  if (toDate) queryParams.to_date = toDate;

  const { data: logsData, isLoading: logsLoading } = useQuery<LoginLogsResponse>({
    queryKey: ['gdpr', 'login-logs', page, successFilter, fromDate, toDate],
    queryFn: () => ApiClient.get('/admin/gdpr/login-logs', queryParams),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const orgRaw = typeof window !== 'undefined' ? localStorage.getItem('selectedOrg') : null;
      const orgId = orgRaw ? JSON.parse(orgRaw).id : null;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (orgId) headers['x-organization-id'] = orgId;

      const res = await fetch(`${apiUrl}/admin/gdpr/export`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Export failed' }));
        throw new Error(err.detail || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : 'gdpr_export.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Export stažen');
    } catch (err: any) {
      toast.error(err.message || 'Chyba při exportu');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = logsData ? Math.ceil(logsData.total / 50) : 1;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/cs/dashboard/settings" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            GDPR &amp; Ochrana osobních údajů
          </h1>
          <p className="text-muted-foreground text-sm">Správa osobních dat, export a záznamy přihlášení</p>
        </div>
      </div>

      {/* Export section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export osobních dat (GDPR čl. 20)
          </CardTitle>
          <CardDescription>
            Stáhněte ZIP soubor se všemi osobními daty vaší organizace: kontakty, uživatelé, audit logy a záznamy přihlášení (posledních 12 měsíců).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generuji export...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Stáhnout export (ZIP)
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              Obsah: <code>contacts.csv</code>, <code>users.csv</code>, <code>audit_logs.csv</code>, <code>login_logs.csv</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Login logs section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            Záznamy přihlášení
          </CardTitle>
          <CardDescription>
            Přehled pokusů o přihlášení uživatelů vaší organizace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Výsledek</Label>
              <Select value={successFilter} onValueChange={(v) => { setSuccessFilter(v); setPage(1); }}>
                <SelectTrigger className="w-36 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vše</SelectItem>
                  <SelectItem value="true">Úspěšné</SelectItem>
                  <SelectItem value="false">Neúspěšné</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Od data</Label>
              <Input
                type="datetime-local"
                className="bg-white w-48"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Do data</Label>
              <Input
                type="datetime-local"
                className="bg-white w-48"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              />
            </div>
            {(successFilter !== 'all' || fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSuccessFilter('all'); setFromDate(''); setToDate(''); setPage(1); }}
              >
                Resetovat filtry
              </Button>
            )}
          </div>

          {/* Table */}
          {logsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logsData && logsData.items.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      <th className="text-left px-3 py-2 font-medium">IP adresa</th>
                      <th className="text-left px-3 py-2 font-medium">Výsledek</th>
                      <th className="text-left px-3 py-2 font-medium">Důvod selhání</th>
                      <th className="text-left px-3 py-2 font-medium">Čas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsData.items.map((log, i) => (
                      <tr key={log.id} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                        <td className="px-3 py-2 font-mono text-xs">{log.email}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{log.ip || '—'}</td>
                        <td className="px-3 py-2">
                          {log.success ? (
                            <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Úspěch
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                              <XCircle className="h-3 w-3 mr-1" />
                              Selhání
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {log.failure_reason ? (
                            <span className="font-mono">{log.failure_reason}</span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('cs-CZ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    Celkem: {logsData.total} záznamů
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Předchozí
                    </Button>
                    <span className="flex items-center text-sm px-2">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Další
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <LogIn className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>Žádné záznamy přihlášení nenalezeny.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Zálohování dat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Data jsou automaticky zálohována poskytovatelem infrastruktury Railway. Zálohy jsou šifrované a uchovávány po dobu minimálně 7 dní (na placených plánech déle).
          </p>
          <p>
            Pro nastavení delší doby uchovávání záloh přejděte do Railway dashboard → Settings → Database.
          </p>
          <p>
            <strong className="text-foreground">Právo na výmaz (čl. 17 GDPR):</strong> Smazání konkrétní osoby z databáze je procesní záležitost — kontaktujte správce systému. Zálohy obsahující smazaná data expirují automaticky dle retention policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
