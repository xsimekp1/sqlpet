'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { QrCode, Loader2, Download } from 'lucide-react';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import ApiClient, { Animal } from '@/app/lib/api';
import { toast } from 'sonner';

export default function AnimalQRSheetPage() {
  const t = useTranslations();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnimals() {
      try {
        const data = await ApiClient.getAnimals({ status: 'all', page_size: 500 });
        setAnimals(data.items);
      } catch (error) {
        console.error('Failed to load animals:', error);
        toast.error('Nepodařilo se načíst zvířata');
      } finally {
        setLoading(false);
      }
    }
    loadAnimals();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">QR kódy zvířat</h1>
          <p className="text-muted-foreground">
            Celkem: {animals.length} zvířat
          </p>
        </div>
        <Button onClick={handlePrint}>
          <Download className="h-4 w-4 mr-2" />
          Tisknout
        </Button>
      </div>

      {/* QR Grid - printable */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 print:grid-cols-3 print:gap-2">
        {animals.map((animal) => (
          <Card key={animal.id} className="print:border print:shadow-none">
            <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
              <div className="bg-white p-2 rounded">
                <QRCode
                  value={`https://sqlpet.vercel.app/cs/dashboard/animals/${animal.id}`}
                  size={120}
                  level="M"
                />
              </div>
              <div className="text-center">
                <p className="font-mono font-bold text-sm">{animal.public_code}</p>
                <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {animal.name}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {animals.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <QrCode className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Žádná zvířata k zobrazení</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
