'use client';

import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Baby, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { OffspringCollarPreview } from './OffspringCollarPreview';
import {
  assignLitterColors,
  hasCollarDuplicates,
  CollarColor,
} from '@/app/lib/collarColors';

interface BirthDialogProps {
  animalId: string;
  animalName: string;
  species: 'dog' | 'cat';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after successful birth registration */
  onBirthRegistered?: (count: number) => void;
}

export default function BirthDialog({
  animalId,
  animalName,
  species,
  open,
  onOpenChange,
  onBirthRegistered,
}: BirthDialogProps) {
  const t = useTranslations('birth');
  const [step, setStep] = useState<1 | 2>(1);

  // Default litter size based on species
  const defaultLitterSize = species === 'cat' ? 4 : 6;
  const [litterCount, setLitterCount] = useState(defaultLitterSize);
  const [birthDate, setBirthDate] = useState(new Date().toISOString().split('T')[0]);
  const [motherLactating, setMotherLactating] = useState(true);
  const [namingScheme, setNamingScheme] = useState<'number' | 'letter' | 'color'>('number');
  const [collarColors, setCollarColors] = useState<(CollarColor | null)[]>([]);
  const [loading, setLoading] = useState(false);

  // When litter count changes and we're on step 2, auto-assign colors
  useEffect(() => {
    if (step === 2 && namingScheme === 'color') {
      const colors = assignLitterColors(litterCount);
      setCollarColors(colors);
    }
  }, [step, litterCount, namingScheme]);

  const getOffspringLabel = (count: number): string => {
    if (count === 1) return t('offspringOne');
    if (count >= 2 && count <= 4) return t('offspringFew');
    return t('offspringMany');
  };

  const handleNext = () => {
    if (step === 1) {
      // Validate and go to step 2
      if (litterCount < 1 || litterCount > 20) {
        toast.error(t('invalidCount'));
        return;
      }
      setStep(2);
    } else {
      // Submit birth
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await ApiClient.registerBirth(animalId, {
        litter_count: litterCount,
        birth_date: birthDate || undefined,
        naming_scheme: namingScheme,
        collar_colors: namingScheme === 'color' ? collarColors.map(c => c || 'none') : undefined,
      });
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-pink-500" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? t('description', { name: animalName }) : t('assignColorsDescription')}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('litterCount')}</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setLitterCount(Math.max(1, litterCount - 1))}
                  disabled={litterCount <= 1}
                  className="h-10 w-10"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="flex items-center justify-center w-16 h-10 text-lg font-semibold border rounded-md bg-white">
                  {litterCount}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setLitterCount(Math.min(20, litterCount + 1))}
                  disabled={litterCount >= 20}
                  className="h-10 w-10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {getOffspringLabel(litterCount)}
                </span>
              </div>
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
            <div className="space-y-1.5">
              <Label htmlFor="naming-scheme">{t('namingScheme')}</Label>
              <Select value={namingScheme} onValueChange={(val) => setNamingScheme(val as any)}>
                <SelectTrigger id="naming-scheme" className="w-64 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">{t('namingSchemes.number')}</SelectItem>
                  <SelectItem value="letter">{t('namingSchemes.letter')}</SelectItem>
                  <SelectItem value="color">{t('namingSchemes.color')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {namingScheme === 'number' && t('namingSchemes.numberDesc')}
                {namingScheme === 'letter' && t('namingSchemes.letterDesc')}
                {namingScheme === 'color' && t('namingSchemes.colorDesc')}
              </p>
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
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            {namingScheme === 'color' ? (
              <>
                <OffspringCollarPreview
                  count={litterCount}
                  motherName={animalName}
                  colors={collarColors}
                  onColorsChange={setCollarColors}
                />
                {hasCollarDuplicates(collarColors) && (
                  <Alert variant="default" className="border-orange-200 bg-orange-50">
                    <AlertDescription className="text-sm text-orange-800">
                      {t('duplicateColorsWarning')}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">{t('offspringPreview')}</h4>
                <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-2">
                  {Array.from({ length: litterCount }).map((_, i) => {
                    let name = '';
                    if (namingScheme === 'letter') {
                      let letterIndex = i;
                      let letters = '';
                      while (true) {
                        letters = String.fromCharCode(65 + (letterIndex % 26)) + letters;
                        letterIndex = Math.floor(letterIndex / 26);
                        if (letterIndex === 0) break;
                        letterIndex -= 1;
                      }
                      name = `${animalName} – ${letters}`;
                    } else {
                      name = `${animalName} – mládě ${i + 1}`;
                    }
                    return (
                      <div key={i} className="flex items-center gap-3 p-2 border rounded-lg bg-white">
                        <Baby className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
              {t('back')}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('cancel')}
          </Button>
          <Button onClick={handleNext} disabled={loading}>
            {loading
              ? t('submitting')
              : step === 1
                ? t('next')
                : t('confirmBirth')
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
