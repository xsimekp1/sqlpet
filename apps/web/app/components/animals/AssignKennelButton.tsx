'use client';

import { useState } from 'react';
import { MapPin, ChevronDown, Check, X, Loader2 } from 'lucide-react';
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
  const [open, setOpen] = useState(false);
  const [kennels, setKennels] = useState<Kennel[]>([]);
  const [loadingKennels, setLoadingKennels] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen);
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
        toast.error('Nelze načíst kotce: ' + (e.message || ''));
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
    setSaving(true);
    try {
      await ApiClient.moveAnimal({ animal_id: animal.id, target_kennel_id: kennel.id });
      toast.success(`${animal.name} přiřazen do ${kennel.name}`);
      onAssigned({ id: kennel.id, name: kennel.name, code: kennel.code });
      setOpen(false);
    } catch (e: any) {
      toast.error('Nelze přiřadit: ' + (e.message || 'Neznámá chyba'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (saving || !animal.current_kennel_id) return;
    setSaving(true);
    try {
      await ApiClient.moveAnimal({ animal_id: animal.id, target_kennel_id: null });
      toast.success(`${animal.name} odebrán z kotce`);
      onAssigned(null);
      setOpen(false);
    } catch (e: any) {
      toast.error('Nelze odebrat: ' + (e.message || 'Neznámá chyba'));
    } finally {
      setSaving(false);
    }
  };

  const getOccupancyBadge = (kennel: Kennel) => {
    const pct = kennel.occupied_count / kennel.capacity;
    if (kennel.occupied_count === 0) return <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">Prázdný</Badge>;
    if (pct < 1) return <Badge variant="outline" className="text-xs bg-green-50 text-green-700">{kennel.occupied_count}/{kennel.capacity}</Badge>;
    return <Badge variant="outline" className="text-xs bg-red-50 text-red-700">Plný {kennel.occupied_count}/{kennel.capacity}</Badge>;
  };

  const getStatusBadge = (kennel: Kennel) => {
    if (kennel.status === 'maintenance') return <Badge variant="secondary" className="text-xs">Údržba</Badge>;
    if (kennel.status === 'closed') return <Badge variant="destructive" className="text-xs">Zavřený</Badge>;
    return null;
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MapPin className="h-4 w-4" />
          {animal.current_kennel_code
            ? `Kotec: ${animal.current_kennel_code}`
            : 'Přiřadit kotec'}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <p className="text-sm font-semibold">Přiřadit do kotce</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {animal.current_kennel_name
              ? `Aktuálně: ${animal.current_kennel_name}`
              : 'Zvíře nemá přiřazený kotec'}
          </p>
        </div>

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
              Odebrat z kotce
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default AssignKennelButton;
