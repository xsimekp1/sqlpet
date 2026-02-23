'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Printer, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import ApiClient from '@/app/lib/api';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface OrgOption {
  id: string;
  name: string;
  slug: string;
  registration_number: string | null;
  address: string | null;
}

interface DpaResponse {
  org: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    registration_number: string | null;
  };
  dpa_html: string;
  generated_at: string;
}

export default function SuperadminGdprPage() {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [dpaData, setDpaData] = useState<DpaResponse | null>(null);

  const { data: orgs = [], isLoading: orgsLoading } = useQuery<OrgOption[]>({
    queryKey: ['superadmin', 'gdpr', 'organizations'],
    queryFn: () => ApiClient.get('/superadmin/gdpr/organizations'),
  });

  const handleGenerate = async () => {
    if (!selectedOrgId) {
      toast.error('Vyberte organizaci');
      return;
    }
    setGenerating(true);
    try {
      const data = await ApiClient.get<DpaResponse>(`/superadmin/gdpr/dpa/${selectedOrgId}`);
      setDpaData(data);
    } catch (err: any) {
      toast.error(err.message || 'Chyba při generování DPA');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-3 mb-2 print:hidden">
        <Link href="/cs/dashboard/admin/registered-shelters" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            DPA Generátor
          </h1>
          <p className="text-muted-foreground text-sm">
            Generování Smlouvy o zpracování osobních údajů (GDPR čl. 28) pro organizaci
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Vyberte organizaci</CardTitle>
          <CardDescription>
            Vygenerujte předvyplněnou DPA smlouvu pro libovolnou organizaci. Pouze superadmin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1 flex-1 min-w-48">
              <Label className="text-xs text-muted-foreground">Organizace</Label>
              {orgsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Načítám organizace...
                </div>
              ) : (
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger className="bg-white w-full">
                    <SelectValue placeholder="— Vyberte organizaci —" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                        {org.registration_number && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            IČO: {org.registration_number}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button onClick={handleGenerate} disabled={generating || !selectedOrgId}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generuji...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Vygenerovat DPA
                </>
              )}
            </Button>
            {dpaData && (
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Tisknout / Uložit PDF
              </Button>
            )}
          </div>

          {dpaData && (
            <div className="mt-3 p-3 bg-muted/50 rounded text-xs text-muted-foreground flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Vygenerováno: <strong>{new Date(dpaData.generated_at).toLocaleString('cs-CZ')}</strong>
                {' · '}
                Organizace: <strong>{dpaData.org.name}</strong>
                {dpaData.org.registration_number && ` · IČO: ${dpaData.org.registration_number}`}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DPA Preview */}
      {dpaData ? (
        <div className="bg-white border rounded-lg shadow-sm">
          {/* Print header (visible only in print) */}
          <div className="hidden print:block p-8 pb-0 text-xs text-muted-foreground">
            Vygenerováno: {new Date(dpaData.generated_at).toLocaleString('cs-CZ')}
          </div>
          <div
            className="p-8 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: dpaData.dpa_html }}
          />
        </div>
      ) : (
        <Card className="print:hidden">
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Vyberte organizaci a klikněte na &quot;Vygenerovat DPA&quot;</p>
            <p className="text-sm mt-1">Zobrazí se předvyplněná Smlouva o zpracování osobních údajů.</p>
          </CardContent>
        </Card>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          body { font-size: 11pt; }
          @page { margin: 2cm; }
        }
      `}</style>
    </div>
  );
}
