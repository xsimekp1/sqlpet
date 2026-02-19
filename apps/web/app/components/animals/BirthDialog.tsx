'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('birth');
  const [litterCount, setLitterCount] = useState(1);
  const [birthDate, setBirthDate] = useState(new Date().toISOString().split('T')[0]);
  const [motherLactating, setMotherLactating] = useState(true);
  const [loading, setLoading] = useState(false);

  const getOffspringLabel = (count: number): string => {
    if (count === 1) return t('offspringOne');
    if (count >= 2 && count <= 4) return t('offspringFew');
    return t('offspringMany');
  };

  const handleSubmit = async () => {
    if (litterCount < 1 || litterCount > 20) {
      toast.error(t('invalidCount'));
      return;
    }
    setLoading(true);
    try {
      const result = await ApiClient.registerBirth(
        animalId,
        litterCount,
        birthDate || undefined,
      );
      toast.success(t('success', { count: result.created }));
      
      // Set mother as lactating if checkbox is checked
      if (motherLactating) {
        await ApiClient.updateAnimal(animalId, { is_lactating: true } as any);
        toast.success(t('motherLactatingSet'));
      }
      
      onOpenChange(false);
      onBirthRegistered?.(result.created);
    } catch (err: any) {
      toast.error(err?.message || t('error'));
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
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('description', { name: animalName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="litter-count">{t('litterCount')}</Label>
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
            <Label htmlFor="birth-date">{t('birthDate')}</Label>
            <Input
              id="birth-date"
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              className="w-48"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mother-lactating"
              checked={motherLactating}
              onChange={(e) => setMotherLactating(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="mother-lactating" className="text-sm font-normal">
              {t('motherLactating') || 'Matka kojí'}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? t('submitting') : `${t('submit')} ${litterCount} ${getOffspringLabel(litterCount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
