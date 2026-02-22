'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ApiClient from '@/app/lib/api';
import { toast } from 'sonner';

export default function ReportPreviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const template = searchParams.get('template') ?? 'annual_intake_report';
  const year = Number(searchParams.get('year') ?? new Date().getFullYear());

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ApiClient.previewOrgDocument(template, year)
      .then((r) => setHtml(r.rendered_html))
      .catch(() => toast.error('Nepodařilo se načíst dokument'))
      .finally(() => setLoading(false));
  }, [template, year]);

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zpět
        </Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={handlePrint} disabled={!html}>
          <Printer className="h-4 w-4 mr-2" />
          Tisk
        </Button>
      </div>

      {/* Document area */}
      <div className="flex-1 overflow-auto bg-muted/30 flex justify-center p-8">
        {loading && (
          <div className="flex items-center gap-2 mt-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Generuji dokument…
          </div>
        )}
        {!loading && !html && (
          <p className="text-destructive mt-24">Dokument se nepodařilo načíst.</p>
        )}
        {html && (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            scrolling="no"
            style={{
              width: '210mm',
              minHeight: '297mm',
              border: 'none',
              background: 'white',
              boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
            }}
            title="Náhled dokumentu"
          />
        )}
      </div>
    </div>
  );
}
