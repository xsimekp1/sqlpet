'use client';

import { useState } from 'react';
import ApiClient from '@/app/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Baby } from 'lucide-react';
import { toast } from 'sonner';

interface BirthDialogProps {
  animalId: string;
  animalName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after successful birth registration */
  onBirthRegistered?: (count: number) => void;
}

export default function BirthDialog({
  animalId,
  animalName,
  open,
  onOpenChange,
  onBirthRegistered,
}: BirthDialogProps) {
  const [litterCount, setLitterCount] = useState(1);
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (litterCount < 1 || litterCount > 20) {
      toast.error('Zadejte počet mláďat (1–20)');
      return;
    }
    setLoading(true);
    try {
      const result = await ApiClient.registerBirth(
        animalId,
        litterCount,
        birthDate || undefined,
      );
      toast.success(`Zaevidováno ${result.created} mláďat. Byli přidáni do kotce.`);
      onOpenChange(false);
      onBirthRegistered?.(result.created);
    } catch (err: any) {
      toast.error(err?.message || 'Chyba při registraci porodu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-pink-500" />
            Zaevidovat porod
          </DialogTitle>
          <DialogDescription>
            Zaevidujete porod u <strong>{animalName}</strong>. Systém vytvoří zadaný počet mláďat
            stejného druhu a plemene, přidá je do jejího kotce a nastaví datum narození.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="litter-count">Počet mláďat</Label>
            <Input
              id="litter-count"
              type="number"
              min={1}
              max={20}
              value={litterCount}
              onChange={e => setLitterCount(parseInt(e.target.value, 10) || 1)}
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth-date">Datum porodu (volitelné, výchozí: dnes)</Label>
            <Input
              id="birth-date"
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              className="w-48"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Zrušit
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Ukládám…' : `Zaregistrovat ${litterCount} ${litterCount === 1 ? 'mládě' : litterCount < 5 ? 'mláďata' : 'mláďat'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
