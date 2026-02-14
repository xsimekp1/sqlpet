'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, ChevronDown, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import ApiClient, { Animal, Kennel } from '@/app/lib/api';
import { toast } from 'sonner';

interface AssignKennelButtonProps {
  animal: Animal;
  onAssigned: (kennel: Pick<Kennel, 'id' | 'name' | 'code'> | null) => void;
}

export function AssignKennelButton({ animal, onAssigned }: AssignKennelButtonProps) {
  const t = useTranslations('kennels');
  const [open, setOpen] = useState(false);
  const [kennels, setKennels] = useState<Kennel[]>([]);
  const [loadingKennels, setLoadingKennels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingKennel, setPendingKennel] = useState<Kennel | null>(null);

  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setPendingKennel(null);
    if (nextOpen && kennels.length === 0) {
      setLoadingKennels(true);
      try {
        const data = await ApiClient.getKennels();
        // Sort by occupancy: empty → partial → full
        const sorted = [...data].sort((a, b) => {
          const pctA = a.occupied_count / a.capacity;
          const pctB = b.occupied_count / b.capacity;
          return pctA - pctB;
        });
        setKennels(sorted);
      } catch (e: any) {
        toast.error(t('assignButton.loadError', { msg: e.message || '' }));
      } finally {
        setLoadingKennels(false);
      }
    }
  };

  const handleSelectKennel = async (kennel: Kennel) => {
    if (saving) return;
    // Skip if already assigned to this kennel
    if (animal.current_kennel_id === kennel.id) {
      setOpen(false);
      return;
    }
    // Quarantine warning: if animal is in quarantine and kennel is occupied, ask for confirmation
    if (animal.status === 'quarantine' && kennel.occupied_count > 0 && pendingKennel?.id !== kennel.id) {
      setPendingKennel(kennel);
      return;
    }
    setPendingKennel(null);
    setSaving(true);
    try {
      await ApiClient.moveAnimal({ animal_id: animal.id, target_kennel_id: kennel.id });
      toast.success(t('assignButton.assigned', { name: animal.name, kennel: kennel.name }));
      onAssigned({ id: kennel.id, name: kennel.name, code: kennel.code });
      setOpen(false);
    } catch (e: any) {
      toast.error(t('assignButton.assignError', { msg: e.message || t('assignButton.unknownError') }));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (saving || !animal.current_kennel_id) return;
    setSaving(true);
    try {
      await ApiClient.moveAnimal({ animal_id: animal.id, target_kennel_id: null });
      toast.success(t('assignButton.removed', { name: animal.name }));
      onAssigned(null);
      setOpen(false);
    } catch (e: any) {
      toast.error(t('assignButton.removeError', { msg: e.message || t('assignButton.unknownError') }));
    } finally {
      setSaving(false);
    }
  };

  const getOccupancyBadge = (kennel: Kennel) => {
    const pct = kennel.occupied_count / kennel.capacity;
    if (kennel.occupied_count === 0) return <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">{t('occupancy.empty')}</Badge>;
    if (pct < 1) return <Badge variant="outline" className="text-xs bg-green-50 text-green-700">{kennel.occupied_count}/{kennel.capacity}</Badge>;
    return <Badge variant="outline" className="text-xs bg-red-50 text-red-700">{t('occupancy.full')} {kennel.occupied_count}/{kennel.capacity}</Badge>;
  };

  const getStatusBadge = (kennel: Kennel) => {
    if (kennel.status === 'maintenance') return <Badge variant="secondary" className="text-xs">{t('status.maintenance')}</Badge>;
    if (kennel.status === 'closed') return <Badge variant="destructive" className="text-xs">{t('status.closed')}</Badge>;
    return null;
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MapPin className="h-4 w-4" />
          {animal.current_kennel_code
            ? t('assignButton.trigger', { code: animal.current_kennel_code })
            : t('assignButton.triggerEmpty')}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <p className="text-sm font-semibold">{t('assignButton.popoverTitle')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {animal.current_kennel_name
              ? t('assignButton.currentKennel', { name: animal.current_kennel_name })
              : t('assignButton.noKennel')}
          </p>
        </div>

        {/* Quarantine confirmation panel */}
        {pendingKennel && (
          <div className="p-3 border-b bg-amber-50 dark:bg-amber-950/30 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ {animal.name} je v karanténě. Kotec {pendingKennel.code} má{' '}
                {pendingKennel.occupied_count}{' '}
                {pendingKennel.occupied_count === 1 ? 'zvíře' : 'zvířat'}.
                Opravdu je chcete dávat dohromady?
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingKennel(null)}
                className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={() => handleSelectKennel(pendingKennel)}
                disabled={saving}
                className="px-3 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Přesto přesunout'}
              </button>
            </div>
          </div>
        )}

        {loadingKennels ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            {kennels.map(kennel => {
              const isCurrentKennel = kennel.id === animal.current_kennel_id;
              const isDisabled = kennel.status !== 'available' || (kennel.occupied_count >= kennel.capacity && !isCurrentKennel);

              return (
                <button
                  key={kennel.id}
                  onClick={() => !isDisabled && handleSelectKennel(kennel)}
                  disabled={isDisabled || saving}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors border-b last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isCurrentKennel ? 'bg-primary/5' : ''
                  }`}
                >
                  {isCurrentKennel ? (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-medium text-muted-foreground">{kennel.code}</span>
                      <span className="text-sm font-medium truncate">{kennel.name}</span>
                    </div>
                    {kennel.zone_name && (
                      <span className="text-xs text-muted-foreground">{kennel.zone_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {getOccupancyBadge(kennel)}
                    {getStatusBadge(kennel)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {animal.current_kennel_id && (
          <div className="p-2 border-t">
            <button
              onClick={handleRemove}
              disabled={saving}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              {t('assignButton.removeFromKennel')}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default AssignKennelButton;
