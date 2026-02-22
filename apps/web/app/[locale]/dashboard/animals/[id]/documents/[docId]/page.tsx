'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ApiClient from '@/app/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Printer } from 'lucide-react';
import { toast } from 'sonner';

export default function DocumentViewerPage() {
  const router = useRouter();
  const params = useParams();
  const animalId = params.id as string;
  const docId = params.docId as string;
  const t = useTranslations('animals.documents');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const result = await ApiClient.get(`/documents/${docId}/preview`);
        setRenderedHtml(result?.rendered_html ?? null);
      } catch {
        toast.error(t('previewError'));
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [docId, t]);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/animals/${animalId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back')}
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          disabled={!renderedHtml}
          onClick={() => iframeRef.current?.contentWindow?.print()}
        >
          <Printer className="h-4 w-4 mr-2" />
          {t('print')}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-muted/30 flex justify-center p-8">
        {loading ? (
          <div className="w-[210mm] space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : renderedHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={renderedHtml}
            scrolling="no"
            style={{
              width: '210mm',
              minHeight: '297mm',
              border: 'none',
              background: 'white',
              boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
            }}
            title={t('preview')}
          />
        ) : (
          <div className="text-muted-foreground text-center py-16">
            {t('previewError')}
          </div>
        )}
      </div>
    </div>
  );
}
